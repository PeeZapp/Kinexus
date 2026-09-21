import { randomUUID } from 'node:crypto';

import {
  RECIPE_NOT_FOUND_MESSAGE,
  RecipeUrlError,
  normalizeRecipeUrl,
  type NormalizedRecipeUrl,
  type RecipeImportJob,
} from '@kinexus/domain';

import { userFromRequest } from '../auth.js';
import { cronAuthorized } from '../prices.js';
import { failureFromUnknown } from './errors.js';
import { processRecipeImport } from './pipeline.js';
import { assertImportRateLimit } from './rate-limit.js';
import { getImportByCanonical, getImportById, saveImport, type RecipeImportRecord } from './store.js';

const CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 15 * 60 * 1000;
const JOB_TTL_MS = 3 * 60 * 1000;
const BLOG_SYNC_MS = 10_000;

const inFlight = new Set<string>();

export async function handleCreateRecipeImport(
  request: Request,
  body: { url?: unknown },
): Promise<{ status: number; body: { job?: RecipeImportJob; error?: string; errorCode?: string } }> {
  const raw = typeof body.url === 'string' ? body.url : '';
  let normalized: NormalizedRecipeUrl;
  try {
    normalized = normalizeRecipeUrl(raw);
  } catch (err) {
    if (err instanceof RecipeUrlError) {
      return { status: 400, body: { error: err.message, errorCode: err.code } };
    }
    return { status: 400, body: { error: 'Enter a valid URL starting with https://', errorCode: 'invalid_url' } };
  }

  const userResult = await optionalUser(request);
  if (userResult && 'error' in userResult) {
    return { status: userResult.status, body: { error: userResult.error } };
  }
  const user = userResult && 'user' in userResult ? userResult.user : null;
  try {
    await assertImportRateLimit({
      userId: user?.id,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('cf-connecting-ip') ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Too many imports';
    return { status: 429, body: { error: message, errorCode: 'rate_limited' } };
  }

  const existing = await getImportByCanonical(normalized.canonicalUrl);
  if (existing) {
    const age = Date.now() - Date.parse(existing.updatedAt);
    if (existing.status === 'succeeded' && age < CACHE_MS) {
      return { status: 200, body: { job: existing } };
    }
    if (existing.status === 'running' || existing.status === 'queued') {
      scheduleJob(existing.id, normalized);
      return { status: 202, body: { job: existing } };
    }
    if (existing.status === 'failed' && age < RETRY_FAILED_MS && existing.errorCode !== 'timeout') {
      return { status: 200, body: { job: existing } };
    }
  }

  const now = new Date();
  const job: RecipeImportRecord = {
    id: existing?.id ?? randomUUID(),
    status: 'queued',
    sourceKind: normalized.sourceKind,
    inputUrl: normalized.inputUrl,
    canonicalUrl: normalized.canonicalUrl,
    progress: 5,
    phaseLabel: 'Fetching…',
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + JOB_TTL_MS).toISOString(),
    errorCode: undefined,
    errorMessage: undefined,
    recipe: undefined,
  };
  await saveImport(job);

  const video = normalized.sourceKind !== 'web';
  if (video) {
    scheduleJob(job.id, normalized);
    return { status: 202, body: { job } };
  }

  const raced = await Promise.race([
    kickJob(job.id, normalized).then(() => 'done' as const),
    sleep(BLOG_SYNC_MS).then(() => 'timeout' as const),
  ]);
  const latest = (await getImportById(job.id)) ?? job;
  if (raced === 'done' || latest.status === 'succeeded' || latest.status === 'failed') {
    return { status: latest.status === 'failed' ? 422 : 200, body: { job: latest } };
  }
  scheduleJob(job.id, normalized);
  return { status: 202, body: { job: latest } };
}

export async function handleGetRecipeImport(
  id: string,
): Promise<{ status: number; body: { job?: RecipeImportJob; error?: string } }> {
  const job = await getImportById(id);
  if (!job) return { status: 404, body: { error: 'Import not found' } };
  if ((job.status === 'running' || job.status === 'queued') && Date.now() > Date.parse(job.expiresAt)) {
    const timedOut = await saveImport({
      ...job,
      status: 'failed',
      progress: 100,
      phaseLabel: 'Timed out',
      errorCode: 'timeout',
      errorMessage: 'This is taking too long. Try again, or paste the recipe text.',
    });
    return { status: 200, body: { job: timedOut } };
  }
  return { status: 200, body: { job } };
}

export async function handleRecipeImportWork(
  request: Request,
  body: { id?: unknown },
): Promise<{ status: number; body: { ok?: boolean; error?: string } }> {
  if (!cronAuthorized(request)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return { status: 400, body: { error: 'id is required' } };
  const job = await getImportById(id);
  if (!job?.canonicalUrl) return { status: 404, body: { error: 'Import not found' } };
  let normalized: NormalizedRecipeUrl;
  try {
    normalized = normalizeRecipeUrl(job.inputUrl || job.canonicalUrl);
  } catch {
    normalized = {
      inputUrl: job.inputUrl,
      canonicalUrl: job.canonicalUrl,
      sourceKind: job.sourceKind ?? 'web',
      displayHost: new URL(job.canonicalUrl).hostname.replace(/^www\./, ''),
    };
  }
  await kickJob(id, normalized);
  return { status: 200, body: { ok: true } };
}

function scheduleJob(id: string, normalized: NormalizedRecipeUrl): void {
  const secret = process.env.CRON_SECRET?.trim();
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (process.env.VERCEL === '1' && secret && host) {
    const origin = host.startsWith('http') ? host.replace(/\/$/, '') : `https://${host}`;
    void fetch(`${origin}/api/recipes/import/work`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {
      /* job remains queued; client polling / GET expiry still apply */
    });
    return;
  }
  void kickJob(id, normalized);
}

async function kickJob(id: string, normalized: NormalizedRecipeUrl): Promise<void> {
  if (inFlight.has(id)) return;
  inFlight.add(id);
  try {
    await processRecipeImport(id, normalized);
  } catch (err) {
    const failure = failureFromUnknown(err);
    const current = await getImportById(id);
    if (current && current.status !== 'succeeded') {
      await saveImport({
        ...current,
        status: 'failed',
        progress: 100,
        phaseLabel: failure.code === 'not_a_recipe' ? RECIPE_NOT_FOUND_MESSAGE : 'Failed',
        errorCode: failure.code,
        errorMessage: failure.message,
      });
    }
  } finally {
    inFlight.delete(id);
  }
}

async function optionalUser(
  request: Request,
): Promise<{ user: { id: string } } | { error: string; status: 401 | 500 } | null> {
  const header = request.headers.get('authorization');
  if (!header) return null;
  return userFromRequest(request);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
