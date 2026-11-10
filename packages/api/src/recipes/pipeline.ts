import {
  RECIPE_NOT_FOUND_MESSAGE,
  isCompleteCleanRecipe,
  type NormalizedRecipeUrl,
  type RecipeExtractionMethod,
} from '@kinexus/domain';

import { fetchPublicHtml, stripHtml, type FetchPublicHtmlOptions } from '../scrape/index.js';
import { RecipeImportFailure, failureFromUnknown, notARecipeFailure } from './errors.js';
import { extractJsonLdRecipe } from './extract-jsonld.js';
import { extractMicrodataRecipe } from './extract-microdata.js';
import { extractProvechoRecipe } from './extract-provecho.js';
import { fetchVideoMetadata, videoMetadataToText, videoTextIsUsable } from './extract-video.js';
import { collectRecipeImageCandidates } from './image-candidates.js';
import { logRecipeImport } from './log.js';
import type { ExtractedRecipeCore } from './parse.js';
import {
  structureRecipeForHousehold,
  wrapCleanRecipe,
  type ImportAiContext,
  type StructureResult,
} from './structure-llm.js';
import { getImportById, saveImport } from './store.js';

export type RecipeImportRuntime = FetchPublicHtmlOptions & {
  structure?: (content: string) => Promise<StructureResult>;
  aiContext?: ImportAiContext;
  now?: () => Date;
};

const defaultRuntime = (): RecipeImportRuntime => ({});

export async function processRecipeImport(
  id: string,
  normalized: NormalizedRecipeUrl,
  runtime: RecipeImportRuntime = defaultRuntime(),
): Promise<void> {
  const started = Date.now();
  const current = await getImportById(id);
  if (!current) throw new RecipeImportFailure('extraction_failed', 'Import not found');
  assertNotExpired(current.expiresAt);

  const aiContext =
    runtime.aiContext ??
    (current.requestUserId && current.requestHouseholdId
      ? { userId: current.requestUserId, householdId: current.requestHouseholdId }
      : undefined);
  const effectiveRuntime: RecipeImportRuntime = { ...runtime, aiContext };

  await saveImport({
    ...current,
    status: 'running',
    progress: 15,
    phaseLabel: 'Fetching…',
  });

  try {
    if (normalized.sourceKind === 'web') {
      await runWebImport(id, normalized, effectiveRuntime);
    } else {
      await runVideoImport(id, normalized, effectiveRuntime);
    }
    const row = await getImportById(id);
    logRecipeImport({
      jobId: id,
      host: normalized.displayHost,
      sourceKind: normalized.sourceKind,
      videoId: normalized.videoId,
      provider: row?.provider ?? undefined,
      latencyMs: Date.now() - started,
      status: row?.status ?? 'succeeded',
      method: row?.extractionMethod ?? row?.recipe?.extraction.method,
    });
  } catch (err) {
    const failure = failureFromUnknown(err);
    const row = (await getImportById(id)) ?? current;
    await saveImport({
      ...row,
      status: 'failed',
      progress: 100,
      phaseLabel: failure.code === 'not_a_recipe' ? RECIPE_NOT_FOUND_MESSAGE : failure.code === 'timeout' ? 'Timed out' : 'Failed',
      errorCode: failure.code,
      errorMessage: failure.message,
    });
    logRecipeImport({
      jobId: id,
      host: normalized.displayHost,
      sourceKind: normalized.sourceKind,
      videoId: normalized.videoId,
      provider: row?.provider ?? undefined,
      latencyMs: Date.now() - started,
      status: 'failed',
      errorCode: failure.code,
    });
  }
}

async function runWebImport(id: string, normalized: NormalizedRecipeUrl, runtime: RecipeImportRuntime): Promise<void> {
  const row = await requireRow(id);
  assertNotExpired(row.expiresAt);
  await saveImport({ ...row, progress: 25, phaseLabel: 'Reading the recipe…' });

  const response = await fetchPublicHtml(normalized.canonicalUrl, runtime);
  if ([401, 402, 403, 429].includes(response.status)) {
    throw new RecipeImportFailure('blocked', 'That site blocked the import. Paste the recipe text instead.');
  }
  if (!response.ok) {
    throw new RecipeImportFailure('fetch_failed', `Could not fetch that URL (HTTP ${response.status})`);
  }

  const html = (await response.text()).slice(0, 2_000_000);
  const extracted = await extractRecipeFromHtml(html, runtime, true);
  if (!extracted.ok) {
    await rememberProvider(id, extracted.provider);
    if (extracted.aiBlocked) {
      throw new RecipeImportFailure(
        extracted.aiBlocked === 'no_access' ? 'ai_no_access' : 'ai_key_paused',
        extracted.aiBlocked === 'no_access'
          ? 'AI is turned off for you in this household. Ask an admin.'
          : "Your household's AI key isn't working. AI is paused until an admin fixes it.",
      );
    }
    throw notARecipeFailure();
  }
  const withImages = await withCoverCandidates(extracted.core, normalized, runtime);
  await persistSuccess(id, normalized, withImages, extracted.method, extracted.provider, extracted.aiBlocked);
}

async function runVideoImport(
  id: string,
  normalized: NormalizedRecipeUrl,
  runtime: RecipeImportRuntime,
): Promise<void> {
  assertNotExpired((await requireRow(id)).expiresAt);
  await saveImport({ ...(await requireRow(id)), progress: 30, phaseLabel: 'Reading the recipe…' });
  const meta = await fetchVideoMetadata(
    normalized.sourceKind as Exclude<NormalizedRecipeUrl['sourceKind'], 'web'>,
    normalized.canonicalUrl,
    runtime,
  );
  const text = meta ? videoMetadataToText(meta) : '';
  if (!meta) {
    throw new RecipeImportFailure(
      'video_no_transcript',
      'That link isn’t supported yet. Paste the recipe text, or try a recipe page or a public YouTube, TikTok, Instagram, or Facebook video.',
    );
  }

  if (meta.linkedUrls?.length) {
    await saveImport({ ...(await requireRow(id)), progress: 45, phaseLabel: 'Reading the recipe…' });
    const linked = await tryLinkedRecipePages(meta.linkedUrls, runtime);
    if (linked.ok) {
      const core = await withCoverCandidates(
        {
          ...linked.core,
          imageUrl: linked.core.imageUrl ?? meta.thumbnailUrl,
          authorName: linked.core.authorName ?? meta.authorName,
          siteName: linked.core.siteName ?? meta.siteName,
        },
        normalized,
        runtime,
        meta.thumbnailUrl,
      );
      await persistSuccess(id, normalized, core, linked.method, linked.provider);
      return;
    }
    await rememberProvider(id, linked.provider);
  }

  if (!videoTextIsUsable(meta, text)) {
    const sawVideo = Boolean(meta.description || meta.captions || meta.extraText || (meta.title && meta.title.length >= 12));
    if (!sawVideo) {
      throw new RecipeImportFailure(
        'video_no_transcript',
        'That link isn’t supported yet. Paste the recipe text, or try a recipe page or a public YouTube, TikTok, Instagram, or Facebook video.',
      );
    }
    throw notARecipeFailure();
  }

  assertNotExpired((await requireRow(id)).expiresAt);
  await saveImport({ ...(await requireRow(id)), progress: 60, phaseLabel: 'Summarizing with AI…' });
  const structured = await runStructure(text, runtime, 'video');
  if (!structured.ok) {
    await rememberProvider(id, structured.provider);
    if (structured.reason === 'ai_blocked' && structured.blocked) {
      throw new RecipeImportFailure(
        structured.blocked === 'no_access' ? 'ai_no_access' : 'ai_key_paused',
        structured.blocked === 'no_access'
          ? 'AI is turned off for you in this household. Ask an admin.'
          : "Your household's AI key isn't working. AI is paused until an admin fixes it.",
      );
    }
    throw notARecipeFailure();
  }

  const method: RecipeExtractionMethod =
    normalized.sourceKind === 'youtube' && meta.hasCaptions ? 'transcript-llm' : 'caption-llm';
  const core = await withCoverCandidates(
    {
      ...structured.core,
      imageUrl: structured.core.imageUrl ?? meta.thumbnailUrl,
      authorName: structured.core.authorName ?? meta.authorName,
      siteName: structured.core.siteName ?? meta.siteName,
    },
    normalized,
    runtime,
    meta.thumbnailUrl,
  );
  await persistSuccess(id, normalized, core, method, structured.provider);
}

async function withCoverCandidates(
  core: ExtractedRecipeCore,
  normalized: NormalizedRecipeUrl,
  runtime: RecipeImportRuntime,
  thumbnailUrl?: string,
): Promise<ExtractedRecipeCore> {
  const collected = await collectRecipeImageCandidates({
    youtubeVideoId: normalized.sourceKind === 'youtube' ? normalized.videoId : undefined,
    seedUrls: [core.imageUrl, thumbnailUrl],
    options: runtime,
  });
  const imageCandidates = collected.imageCandidates.length
    ? collected.imageCandidates
    : core.imageUrl
      ? [core.imageUrl]
      : undefined;
  return {
    ...core,
    imageUrl: collected.imageUrl ?? imageCandidates?.[0] ?? core.imageUrl,
    imageCandidates,
  };
}

type HtmlExtract =
  | {
      ok: true;
      core: ExtractedRecipeCore;
      method: RecipeExtractionMethod;
      provider?: string;
      aiBlocked?: 'no_access' | 'key_paused';
    }
  | { ok: false; provider?: string; aiBlocked?: 'no_access' | 'key_paused' };

async function tryLinkedRecipePages(urls: string[], runtime: RecipeImportRuntime): Promise<HtmlExtract> {
  let provider: string | undefined;
  for (const raw of urls.slice(0, 2)) {
    try {
      const response = await fetchPublicHtml(raw, runtime);
      if (!response.ok) continue;
      const html = (await response.text()).slice(0, 2_000_000);
      const extracted = await extractRecipeFromHtml(html, runtime, true);
      if (extracted.ok) return extracted;
      provider = extracted.provider ?? provider;
    } catch {
      // skip blocked / SSRF / dead comment links
    }
  }
  return { ok: false, provider };
}

async function extractRecipeFromHtml(
  html: string,
  runtime: RecipeImportRuntime,
  allowLlm: boolean,
): Promise<HtmlExtract> {
  const provecho = extractProvechoRecipe(html);
  if (provecho && isCompleteCleanRecipe(provecho)) {
    return { ok: true, core: provecho, method: 'json-ld' };
  }
  const jsonLd = extractJsonLdRecipe(html);
  if (jsonLd && isCompleteCleanRecipe(jsonLd)) {
    return { ok: true, core: jsonLd, method: 'json-ld' };
  }
  const microdata = extractMicrodataRecipe(html);
  if (microdata && isCompleteCleanRecipe(microdata)) {
    return { ok: true, core: microdata, method: 'microdata' };
  }
  if (!allowLlm) {
    const partial = jsonLd ?? extractJsonLdRecipe(html, { complete: false }) ?? microdata ?? provecho;
    if (partial) return { ok: true, core: partial, method: jsonLd || provecho ? 'json-ld' : 'microdata' };
    return { ok: false };
  }
  const structured = await runStructure(
    webTextForLlm(html, jsonLd ?? extractJsonLdRecipe(html, { complete: false })),
    runtime,
    'web',
  );
  if (!structured.ok) {
    if (structured.reason === 'ai_blocked') {
      const partialJsonLd = jsonLd ?? extractJsonLdRecipe(html, { complete: false }) ?? provecho;
      const partial = partialJsonLd ?? microdata;
      if (partial) {
        return {
          ok: true,
          core: partial,
          method: partialJsonLd ? 'json-ld' : 'microdata',
          aiBlocked: structured.blocked,
        };
      }
      return { ok: false, provider: structured.provider, aiBlocked: structured.blocked };
    }
    return { ok: false, provider: structured.provider };
  }
  return { ok: true, core: structured.core, method: 'html-llm', provider: structured.provider };
}

async function runStructure(
  content: string,
  runtime: RecipeImportRuntime,
  kind: 'web' | 'video',
): Promise<StructureResult> {
  if (runtime.structure) return runtime.structure(content);
  return structureRecipeForHousehold(content, runtime.aiContext, kind);
}

async function persistSuccess(
  id: string,
  normalized: NormalizedRecipeUrl,
  core: Parameters<typeof wrapCleanRecipe>[0],
  method: RecipeExtractionMethod,
  provider?: string,
  aiBlocked?: 'no_access' | 'key_paused',
): Promise<void> {
  assertNotExpired((await requireRow(id)).expiresAt);
  const recipe = wrapCleanRecipe(core, {
    inputUrl: normalized.inputUrl,
    canonicalUrl: normalized.canonicalUrl,
    displayHost: normalized.displayHost,
    sourceKind: normalized.sourceKind,
    method,
    provider,
  });
  const row = await requireRow(id);
  await saveImport({
    ...row,
    status: 'succeeded',
    progress: 100,
    phaseLabel: 'Ready',
    errorCode: undefined,
    errorMessage: undefined,
    recipe,
    extractionMethod: method,
    provider: provider ?? null,
    confidence: recipe.extraction.confidence,
    aiBlocked,
  });
}

async function rememberProvider(id: string, provider?: string): Promise<void> {
  if (!provider) return;
  const row = await requireRow(id);
  await saveImport({ ...row, provider });
}

async function requireRow(id: string) {
  const row = await getImportById(id);
  if (!row) throw new RecipeImportFailure('extraction_failed', 'Import not found');
  return row;
}

function assertNotExpired(expiresAt: string): void {
  if (Date.now() > Date.parse(expiresAt)) {
    throw new RecipeImportFailure('timeout', 'This is taking too long. Try again, or paste the recipe text.');
  }
}

function webTextForLlm(html: string, hint: ExtractedRecipeCore | null): string {
  const title = pageTitleFromHtml(html);
  const parts: string[] = [];
  if (title) parts.push(`Page title: ${title}`);
  if (hint?.title) {
    parts.push(`Primary recipe name: ${hint.title}`);
    if (hint.ingredients.length) {
      parts.push(
        `JSON-LD ingredients:\n${hint.ingredients
          .map((line) => `- ${[line.quantity?.raw, line.name].filter(Boolean).join(' ')}`)
          .join('\n')}`,
      );
    }
    const steps = hint.method.filter((block) => block.type === 'step').map((block) => block.text);
    if (steps.length) {
      parts.push(`JSON-LD steps:\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`);
    }
  }
  parts.push(`Article text:\n${stripHtml(html).slice(0, 40_000)}`);
  return parts.join('\n\n');
}

function pageTitleFromHtml(html: string): string | undefined {
  const og =
    html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i)?.[1];
  if (og?.trim()) return og.replace(/\s+/g, ' ').trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (!h1) return undefined;
  const text = h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || undefined;
}
