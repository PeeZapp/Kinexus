/**
 * One-off: mirror recipes.image_url that are not already in the recipe-images bucket.
 *
 * Dry-run by default. Apply with --apply.
 *
 *   node packages/api/scripts/backfill-recipe-images.mjs
 *   node packages/api/scripts/backfill-recipe-images.mjs --apply
 *
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_ / EXPO_PUBLIC_ URL variants).
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });
loadEnv({ path: resolve(here, '../../../apps/kinexus/.env') });
loadEnv({ path: resolve(here, '../.env') });

const BUCKET = 'recipe-images';
const MAX_BYTES = 5_242_880;
const MIN_BYTES = 800;
const TIMEOUT_MS = 10_000;
const apply = process.argv.includes('--apply');

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isStored(url) {
  return typeof url === 'string' && url.includes(`/storage/v1/object/public/${BUCKET}/`);
}

function sniff(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
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
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok || !response.body) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < MIN_BYTES || buffer.byteLength > MAX_BYTES) return null;
    const kind = sniff(buffer);
    if (!kind) return null;
    return { bytes: buffer, ...kind };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mirrorOne(row) {
  const folder = row.household_id ?? (row.is_public ? 'catalog' : null);
  if (!folder) return { ok: false, reason: 'no-folder' };
  const file = await fetchImage(row.image_url);
  if (!file) return { ok: false, reason: 'fetch-failed' };
  const path = `${folder}/${row.id}.${file.ext}`;
  if (!apply) return { ok: true, dryRun: true, path };
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file.bytes, {
    contentType: file.mime,
    upsert: true,
  });
  if (uploadError) return { ok: false, reason: uploadError.message };
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await admin.from('recipes').update({ image_url: publicUrl }).eq('id', row.id);
  if (updateError) return { ok: false, reason: updateError.message };
  return { ok: true, path, publicUrl };
}

const { data, error } = await admin
  .from('recipes')
  .select('id, household_id, is_public, image_url')
  .not('image_url', 'is', null);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const rows = (data ?? []).filter((row) => row.image_url && !isStored(row.image_url));
console.info(`[backfill-recipe-images] mode=${apply ? 'apply' : 'dry-run'} candidates=${rows.length}`);

let ok = 0;
let failed = 0;
for (const row of rows) {
  const result = await mirrorOne(row);
  if (result.ok) {
    ok += 1;
    console.info('ok', row.id, result.path ?? '');
  } else {
    failed += 1;
    console.info('fail', row.id, result.reason);
  }
}

console.info(`[backfill-recipe-images] done ok=${ok} failed=${failed}`);
