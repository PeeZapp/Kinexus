import { STASH_DETAIL_ATTEMPT_LIMIT, isSale, titleFromSourceUrl } from '@kinexus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { cronAuthorized } from '../prices.js';
import { createServiceClient, isServiceRoleConfigured } from '../supabase-admin.js';
import { renderScrapeBase, scrapeViaRender, warmRender, type RenderScrapedProduct } from './render-scrape.js';

const MAX_PER_RUN = 25;

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

function continueEnrich(step: number): void {
  const secret = process.env.CRON_SECRET?.trim();
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (process.env.VERCEL !== '1' || !secret || !host) return;
  const origin = host.startsWith('http') ? host.replace(/\/$/, '') : `https://${host}`;
  void fetch(`${origin}/api/stash/enrich?phase=item&step=${step}`, {
    headers: { Authorization: `Bearer ${secret}` },
  }).catch(() => {
    /* remaining rows stay pending until the next daily run */
  });
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
): Promise<'done' | 'miss' | 'unavailable'> {
  let scraped: RenderScrapedProduct | null;
  try {
    scraped = await scrapeViaRender(base, row.source_url);
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

    const phase = new URL(request.url).searchParams.get('phase');
    const step = Number(new URL(request.url).searchParams.get('step') ?? '0') || 0;
    const onVercel = process.env.VERCEL === '1';

    if (onVercel && phase !== 'item') {
      const warm = await warmRender(base);
      continueEnrich(0);
      if (!warm) {
        return {
          status: 200,
          body: {
            ok: false,
            processed: 0,
            remaining: waiting,
            continued: true,
            lastError: 'Render did not answer the wake-up. The price pass will try once more.',
          },
        };
      }
      return { status: 200, body: { ok: true, processed: 0, remaining: waiting, continued: true } };
    }

    if (onVercel) {
      if (step >= MAX_PER_RUN) {
        return { status: 200, body: { ok: true, processed: 0, remaining: waiting, continued: false } };
      }
      const row = await nextWaiting(admin, today);
      if (!row) return { status: 200, body: { ok: true, processed: 0, remaining: 0, continued: false } };
      const outcome = await enrichOne(admin, base, row, today);
      if (outcome === 'unavailable') {
        return {
          status: 200,
          body: { ok: false, processed: 0, remaining: waiting, continued: false, lastError: 'Render scrape did not finish' },
        };
      }
      const remaining = Math.max(0, waiting - 1);
      const continued = remaining > 0 && step + 1 < MAX_PER_RUN;
      if (continued) continueEnrich(step + 1);
      return { status: 200, body: { ok: true, processed: outcome === 'done' ? 1 : 0, remaining, continued } };
    }

    const warm = await warmRender(base);
    if (!warm) {
      return {
        status: 200,
        body: { ok: false, processed: 0, remaining: waiting, continued: false, lastError: 'Render did not wake' },
      };
    }
    let processed = 0;
    for (let n = 0; n < MAX_PER_RUN; n += 1) {
      const row = await nextWaiting(admin, today);
      if (!row) break;
      const outcome = await enrichOne(admin, base, row, today);
      if (outcome === 'unavailable') {
        const remaining = await countWaiting(admin, today);
        return {
          status: 200,
          body: { ok: false, processed, remaining, continued: false, lastError: 'Render scrape did not finish' },
        };
      }
      if (outcome === 'done') processed += 1;
    }
    const remaining = await countWaiting(admin, today);
    return { status: 200, body: { ok: true, processed, remaining, continued: false } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wishlist detail update failed';
    return { status: 500, body: { error: message.slice(0, 300) } };
  }
}
