import { STASH_DETAIL_ATTEMPT_LIMIT, isSale, titleFromSourceUrl } from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { cronAuthorized } from '../prices.js';
import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { renderScrapeBase, scrapeViaRender, warmRender, type RenderScrapedProduct } from './render-scrape.js';

const MAX_PER_RUN = 25;
/** Cold Render plus one product scrape fits under the 180s function cap. */
const RUN_BUDGET_MS = 160_000;

type PendingRow = {
  id: string;
  title: string;
  source_url: string;
  image_url: string | null;
  store_name: string | null;
  description: string | null;
  sku: string | null;
  detail_attempts: number;
};

export type EnrichResult = {
  ok: boolean;
  processed: number;
  remaining: number;
  continued: boolean;
  skipped?: string;
  lastError?: string;
};

function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function countWaiting(admin: SupabaseClient, today: string): Promise<number> {
  const { count, error } = await admin
    .from('stash_products')
    .select('id', { count: 'exact', head: true })
    .eq('detail_status', 'pending')
    .lt('detail_attempts', STASH_DETAIL_ATTEMPT_LIMIT)
    .neq('source_url', '')
    .or(`detail_checked_on.is.null,detail_checked_on.lt.${today}`);
  if (error) throw error;
  return count ?? 0;
}

async function nextWaiting(admin: SupabaseClient, today: string): Promise<PendingRow | null> {
  const { data, error } = await admin
    .from('stash_products')
    .select('id, title, source_url, image_url, store_name, description, sku, detail_attempts')
    .eq('detail_status', 'pending')
    .lt('detail_attempts', STASH_DETAIL_ATTEMPT_LIMIT)
    .neq('source_url', '')
    .or(`detail_checked_on.is.null,detail_checked_on.lt.${today}`)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PendingRow | null) ?? null;
}

function patchFromRender(row: PendingRow, scraped: RenderScrapedProduct, today: string): Record<string, unknown> {
  const slug = titleFromSourceUrl(row.source_url);
  const keepTitle = row.title.trim() && row.title !== slug && row.title !== 'Saved item';
  return {
    title: keepTitle ? row.title : scraped.title || row.title,
    current_price: scraped.currentPrice,
    original_price: scraped.originalPrice,
    is_on_sale: isSale(scraped.currentPrice, scraped.originalPrice),
    image_url: row.image_url || scraped.imageUrl,
    store_name: row.store_name || scraped.storeName,
    description: row.description || scraped.description,
    sku: row.sku || scraped.sku,
    price_source: 'scraped',
    detail_status: 'ready',
    detail_checked_on: today,
  };
}

async function enrichOne(
  admin: SupabaseClient,
  base: string,
  row: PendingRow,
  today: string,
  timeoutMs: number,
): Promise<'done' | 'miss' | 'unavailable'> {
  let scraped: RenderScrapedProduct | null;
  try {
    scraped = await scrapeViaRender(base, row.source_url, fetch, timeoutMs);
  } catch {
    return 'unavailable';
  }
  if (!scraped?.currentPrice) {
    const { error } = await admin
      .from('stash_products')
      .update({
        detail_attempts: row.detail_attempts + 1,
        detail_checked_on: today,
        title: row.title === 'Saved item' && scraped?.title ? scraped.title : row.title,
        image_url: row.image_url || scraped?.imageUrl || null,
        store_name: row.store_name || scraped?.storeName || null,
      })
      .eq('id', row.id)
      .eq('detail_status', 'pending');
    if (error) throw error;
    return 'miss';
  }
  const { error } = await admin.from('stash_products').update(patchFromRender(row, scraped, today)).eq('id', row.id);
  if (error) throw error;
  return 'done';
}

export async function handleEnrichPendingProducts(request: Request): Promise<{ status: number; body: EnrichResult | { error: string } }> {
  if (!cronAuthorized(request)) return { status: 401, body: { error: 'Unauthorized' } };
  if (!isServiceRoleConfigured()) {
    return { status: 503, body: { error: 'Wishlist detail update is not configured' } };
  }

  const base = renderScrapeBase();
  if (!base) {
    return {
      status: 200,
      body: { ok: true, processed: 0, remaining: 0, continued: false, skipped: 'STASH_RENDER_SCRAPE_URL is not set' },
    };
  }

  try {
    const admin = createServiceClient();
    const today = todayUtc();
    const waiting = await countWaiting(admin, today);
    if (waiting === 0) {
      return { status: 200, body: { ok: true, processed: 0, remaining: 0, continued: false } };
    }

    const started = Date.now();
    const warm = await warmRender(base);
    if (!warm) {
      console.warn('[stash-enrich] Render did not wake');
      return {
        status: 200,
        body: {
          ok: false,
          processed: 0,
          remaining: waiting,
          continued: false,
          lastError: 'Render did not wake. Pending items stay on the list.',
        },
      };
    }

    let processed = 0;
    for (let n = 0; n < MAX_PER_RUN; n += 1) {
      const budgetLeft = RUN_BUDGET_MS - (Date.now() - started);
      if (budgetLeft < 20_000) break;
      const row = await nextWaiting(admin, today);
      if (!row) break;
      const outcome = await enrichOne(admin, base, row, today, Math.min(70_000, budgetLeft - 2_000));
      if (outcome === 'unavailable') {
        const remaining = await countWaiting(admin, today);
        console.warn('[stash-enrich] scrape timed out');
        return {
          status: 200,
          body: { ok: false, processed, remaining, continued: false, lastError: 'Render scrape did not finish' },
        };
      }
      if (outcome === 'done') processed += 1;
    }
    const remaining = await countWaiting(admin, today);
    console.log(`[stash-enrich] processed=${processed} remaining=${remaining}`);
    return { status: 200, body: { ok: true, processed, remaining, continued: false } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wishlist detail update failed';
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
}
