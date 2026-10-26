const STORAGE_KEY = 'kinexus-shop-fill';
const COLES_KEY = 'eae83861d1cd4de6bb9cd8a2cd6f041e';

export type ShopFillLine = {
  productId: string;
  productName: string;
  packs: number;
};

export type ShopFill = {
  chainId: string;
  chainName: string;
  lines: ShopFillLine[];
  skipped: string[];
  shopUrl: string;
};

export type ShopFillResult = { ok: true; added: number } | { ok: false; error: string };

let current: ShopFill | null = null;

export function stageShopFill(fill: ShopFill) {
  current = fill;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fill));
  } catch {
    // The native app keeps this in memory for the shop screen.
  }
}

export function readShopFill(): ShopFill | null {
  if (current) return current;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShopFill;
    if (!parsed || typeof parsed.chainId !== 'string' || !Array.isArray(parsed.lines) || typeof parsed.shopUrl !== 'string') {
      return null;
    }
    current = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function isShopCart(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host.endsWith('woolworths.com.au')) return parsed.pathname.startsWith('/shop/cart');
    if (host.endsWith('coles.com.au')) return /\/checkout|\/cart|\/trolley/.test(parsed.pathname);
    return false;
  } catch {
    return false;
  }
}

/** Runs inside the shop page and posts the result back to Kinexus. */
export function shopFillScript(lines: readonly { productId: string; packs: number }[]): string {
  const job = JSON.stringify(lines.map((line) => ({ productId: line.productId, packs: line.packs })));
  return `(() => {
    const lines = ${job};
    const send = (message) => {
      const target = window.ReactNativeWebView;
      if (target) target.postMessage(JSON.stringify(message));
    };
    const fail = (error) => send({ ok: false, error });
    const run = async () => {
      if (!lines.length) {
        fail('Nothing matched to add.');
        return;
      }
      const host = location.hostname;
      let response;
      if (host.endsWith('woolworths.com.au')) {
        response = await fetch('/api/v3/ui/trolley/update', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            items: lines.map((line) => ({
              stockcode: Number(line.productId),
              quantity: line.packs,
              source: 'Kinexus',
            })),
          }),
        });
      } else if (host.endsWith('coles.com.au')) {
        response = await fetch('/api/bff/trolley/items', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'ocp-apim-subscription-key': ${JSON.stringify(COLES_KEY)},
          },
          body: JSON.stringify({
            items: lines.map((line) => ({ productId: String(line.productId), quantity: line.packs })),
          }),
        });
      } else {
        fail('Sign in, then tap Add.');
        return;
      }
      if (response.status === 401 || response.status === 403) {
        fail('Sign in, then tap Add.');
        return;
      }
      if (!response.ok) {
        fail('The shop did not take the trolley.');
        return;
      }
      send({ ok: true, added: lines.length });
    };
    run().catch(() => fail('The shop did not take the trolley.'));
  })();
  true;`;
}
