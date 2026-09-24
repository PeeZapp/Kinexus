/**
 * One-off: fill trailer_url on existing watchlist_titles from TMDB YouTube videos.
 * Usage: npx tsx scripts/backfill-watchlist-trailers.ts
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { pickYoutubeTrailerUrl } from '@kinexus/domain';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../.env') });

const TMDB_BASE = 'https://api.themoviedb.org/3';

type TitleRow = {
  id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  trailer_url: string | null;
};

async function tmdbVideos(mediaType: 'movie' | 'tv', tmdbId: number): Promise<string | null> {
  const key = process.env.TMDB_API_KEY?.trim();
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  if (!key && !token) throw new Error('TMDB_API_KEY missing in packages/api/.env');

  const url = new URL(`${TMDB_BASE}/${mediaType}/${tmdbId}/videos`);
  url.searchParams.set('language', 'en-US');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  else url.searchParams.set('api_key', key!);

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`TMDB ${mediaType}/${tmdbId} failed (HTTP ${res.status})`);
  const payload = (await res.json()) as {
    results?: {
      key?: string | null;
      site?: string | null;
      type?: string | null;
      official?: boolean | null;
      name?: string | null;
      iso_639_1?: string | null;
    }[];
  };
  return pickYoutubeTrailerUrl(payload.results ?? []);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const force = process.argv.includes('--force');
  let query = supabase
    .from('watchlist_titles')
    .select('id, tmdb_id, media_type, title, trailer_url')
    .order('title');
  if (!force) query = query.is('trailer_url', null);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as TitleRow[];
  console.log(`Found ${rows.length} title(s) to backfill${force ? ' (--force)' : ''}`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const trailerUrl = await tmdbVideos(row.media_type, row.tmdb_id);
      if (!trailerUrl) {
        console.log(`  skip  ${row.title} — no YouTube trailer`);
        skipped += 1;
      } else {
        const { error: updateError } = await supabase
          .from('watchlist_titles')
          .update({ trailer_url: trailerUrl })
          .eq('id', row.id);
        if (updateError) throw updateError;
        console.log(`  ok    ${row.title}`);
        updated += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(`  fail  ${row.title}:`, err instanceof Error ? err.message : err);
    }
    await sleep(250);
  }

  console.log(`Done. updated=${updated} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
