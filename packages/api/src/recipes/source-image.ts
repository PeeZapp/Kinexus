import { normalizeRecipeUrl, RecipeUrlError } from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { userFromRequest } from '../auth.js';
import { fetchPublicHtml } from '../scrape/index.js';
import { assertPublicHttpUrl, assertResolvedPublicHost, defaultHostnameLookup } from '../scrape/ssrf.js';
import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { fetchVideoMetadata } from './extract-video.js';
import { absoluteHttpImage, imageUrlFromRecipeHtml } from './page-image.js';

export const RECIPE_IMAGE_BUCKET = 'recipe-images';
const MAX_BYTES = 5_242_880;
const MIN_BYTES = 800;

const IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

export function isStoredRecipeImage(url: string | null | undefined, recipeId?: string): boolean {
  if (!url?.includes(`/storage/v1/object/public/${RECIPE_IMAGE_BUCKET}/`)) return false;
  if (!recipeId) return true;
  return url.includes(`/${recipeId}.`);
}

export async function resolveRecipeImageUrl(pageUrl: string): Promise<string | undefined> {
  let normalized;
  try {
    normalized = normalizeRecipeUrl(pageUrl);
  } catch (err) {
    if (err instanceof RecipeUrlError) return undefined;
    throw err;
  }

  if (normalized.sourceKind !== 'web') {
    const meta = await fetchVideoMetadata(normalized.sourceKind, normalized.canonicalUrl);
    for (const linked of meta?.linkedUrls ?? []) {
      const fromLinked = await imageFromWebPage(linked);
      if (fromLinked) return fromLinked;
    }
    return absoluteHttpImage(meta?.thumbnailUrl, normalized.canonicalUrl);
  }

  return imageFromWebPage(normalized.canonicalUrl);
}

export async function mirrorHouseholdRecipeImage(recipeId: string): Promise<string | null> {
  if (!isServiceRoleConfigured()) return null;
  const admin = createServiceClient();
  await ensureRecipeImageBucket(admin);
  const { data: recipe, error } = await admin
    .from('recipes')
    .select('id, household_id, is_public, source_url, image_url')
    .eq('id', recipeId)
    .maybeSingle();
  if (error || !recipe) return null;
  const folder = recipe.household_id ?? (recipe.is_public ? 'catalog' : null);
  if (!folder) return null;
  if (isStoredRecipeImage(recipe.image_url, recipe.id)) return recipe.image_url;

  const candidates: string[] = [];
  const current = absoluteHttpImage(recipe.image_url ?? undefined, recipe.source_url ?? 'https://local.invalid/');
  if (current && !isStoredRecipeImage(current)) candidates.push(current);
  if (recipe.source_url) {
    const resolved = await resolveRecipeImageUrl(recipe.source_url);
    if (resolved && !candidates.includes(resolved)) candidates.push(resolved);
  }

  for (const candidate of candidates) {
    const stored = await storeRecipeImage(admin, folder, recipe.id, candidate);
    if (!stored) continue;
    const { error: updateError } = await admin.from('recipes').update({ image_url: stored }).eq('id', recipe.id);
    if (!updateError) return stored;
  }
  return recipe.image_url;
}

export async function handleMirrorRecipeImage(request: Request, body: { recipeId?: unknown }) {
  const authed = await userFromRequest(request);
  if ('error' in authed) return { status: authed.status, body: { error: authed.error } };
  const recipeId = typeof body.recipeId === 'string' ? body.recipeId.trim() : '';
  if (!recipeId) return { status: 400 as const, body: { error: 'Recipe id is required' } };

  try {
    if (!isServiceRoleConfigured()) {
      return { status: 500 as const, body: { error: 'Recipe photo storage is not configured' } };
    }
    const admin = createServiceClient();
    const { data: recipe, error } = await admin
      .from('recipes')
      .select('id, household_id')
      .eq('id', recipeId)
      .maybeSingle();
    if (error) throw error;
    if (!recipe?.household_id) return { status: 404 as const, body: { error: 'Recipe not found' } };
    const { data: member, error: memberError } = await admin
      .from('household_members')
      .select('user_id')
      .eq('household_id', recipe.household_id)
      .eq('user_id', authed.user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) return { status: 403 as const, body: { error: 'Not a member of this household' } };
    const imageUrl = await mirrorHouseholdRecipeImage(recipeId);
    return { status: 200 as const, body: { imageUrl } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save that photo';
    return { status: 500 as const, body: { error: message } };
  }
}

async function imageFromWebPage(pageUrl: string): Promise<string | undefined> {
  try {
    const response = await fetchPublicHtml(pageUrl, { timeoutMs: 12_000, escalate: true });
    const html = (await response.text()).slice(0, 2_000_000);
    if (!html.trim()) return undefined;
    return imageUrlFromRecipeHtml(html, pageUrl);
  } catch {
    return undefined;
  }
}

async function ensureRecipeImageBucket(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.storage.createBucket(RECIPE_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [...IMAGE_TYPES.keys()],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

async function storeRecipeImage(
  admin: SupabaseClient,
  householdId: string,
  recipeId: string,
  imageUrl: string,
): Promise<string | null> {
  const file = await fetchImageFile(imageUrl);
  if (!file) return null;
  const path = `${householdId}/${recipeId}.${file.ext}`;
  const { error } = await admin.storage.from(RECIPE_IMAGE_BUCKET).upload(path, file.bytes, {
    contentType: file.mime,
    upsert: true,
  });
  if (error) return null;
  const { data } = admin.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;
  if (!publicUrl) return null;
  return `${publicUrl}?v=${Date.now()}`;
}

async function fetchImageFile(imageUrl: string): Promise<{ bytes: Uint8Array; mime: string; ext: string } | null> {
  let current = imageUrl;
  for (let hop = 0; hop < 4; hop += 1) {
    let parsed;
    try {
      parsed = assertPublicHttpUrl(current);
      await assertResolvedPublicHost(parsed.hostname, defaultHostnameLookup);
    } catch {
      return null;
    }
    let response: Response;
    try {
      response = await fetch(current, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: `${parsed.origin}/`,
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      return null;
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return null;
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok || !response.body) return null;
    const bytes = await readLimited(response.body, MAX_BYTES);
    if (!bytes || bytes.byteLength < MIN_BYTES) return null;
    return sniffImage(bytes);
  }
  return null;
}

function sniffImage(bytes: Uint8Array): { bytes: Uint8Array; mime: string; ext: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { bytes, mime: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { bytes, mime: 'image/png', ext: 'png' };
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { bytes, mime: 'image/gif', ext: 'gif' };
  }
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { bytes, mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

async function readLimited(body: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > max) return null;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
