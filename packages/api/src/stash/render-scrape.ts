export type RenderScrapedProduct = {
  title: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  imageUrl: string | null;
  storeName: string | null;
  description: string | null;
  sku: string | null;
};

export function renderScrapeBase(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.STASH_RENDER_SCRAPE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

function priceFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value * 100) / 100;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed * 100) / 100;
  }
  return null;
}

function textFrom(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Map the Stashd Render `/api/scrape` JSON into the wishlist fields. */
export function productFromRenderBody(body: unknown): RenderScrapedProduct | null {
  if (!body || typeof body !== 'object') return null;
  const row = body as Record<string, unknown>;
  if (row.error) return null;
  const currentPrice = priceFrom(row.current_price ?? row.currentPrice);
  const originalPrice = priceFrom(row.original_price ?? row.originalPrice);
  return {
    title: textFrom(row.title),
    currentPrice,
    originalPrice: originalPrice != null && currentPrice != null && originalPrice > currentPrice ? originalPrice : null,
    imageUrl: textFrom(row.image_url ?? row.imageUrl),
    storeName: textFrom(row.store_name ?? row.storeName),
    description: textFrom(row.description),
    sku: textFrom(row.sku),
  };
}

export async function warmRender(base: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(`${base}/api/warmup`, {
      method: 'POST',
      signal: AbortSignal.timeout(55_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function scrapeViaRender(
  base: string,
  pageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RenderScrapedProduct | null> {
  const response = await fetchImpl(`${base}/api/scrape?url=${encodeURIComponent(pageUrl)}`, {
    signal: AbortSignal.timeout(50_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return null;
  return productFromRenderBody(body);
}
