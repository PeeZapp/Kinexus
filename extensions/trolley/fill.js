const STORAGE_KEY = 'kinexus-trolley-lines';
const COLES_KEY = 'eae83861d1cd4de6bb9cd8a2cd6f041e';

function decodeLines(value) {
  try {
    const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
    const rows = JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/') + pad));
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({ productId: String(row[0] ?? ''), packs: Number(row[1]) }))
      .filter((row) => row.productId && row.packs > 0);
  } catch {
    return [];
  }
}

function capture() {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const params = new URLSearchParams(raw);
  const lines = decodeLines(params.get('kinexus_lines') ?? '');
  if (!lines.length) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ lines }));
  history.replaceState(null, '', location.pathname + location.search);
}

function overlay(title, lines) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:320px;max-height:50vh;overflow:auto;background:#171F2A;color:#EEF3F8;border:1px solid #253140;border-radius:12px;padding:14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35)';
  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = 'font-weight:800;margin-bottom:8px';
  box.appendChild(heading);
  for (const line of lines) {
    const row = document.createElement('div');
    row.textContent = line;
    row.style.cssText = 'color:#8D9AAB;margin-top:4px';
    box.appendChild(row);
  }
  document.documentElement.appendChild(box);
}

async function addWoolworths(lines) {
  const response = await fetch('/api/v3/ui/trolley/update', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: lines.map((line) => ({
        stockcode: Number(line.productId),
        quantity: line.packs,
        source: 'Kinexus',
      })),
    }),
  });
  if (response.status === 401 || response.status === 403) throw new Error('Sign in to Woolworths, then refresh this cart.');
  if (!response.ok) throw new Error('Woolworths did not take the trolley update.');
}

async function addColes(lines) {
  const response = await fetch('/api/bff/trolley/items', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'ocp-apim-subscription-key': COLES_KEY,
    },
    body: JSON.stringify({
      items: lines.map((line) => ({ productId: String(line.productId), quantity: line.packs })),
    }),
  });
  if (response.status === 401 || response.status === 403) throw new Error('Sign in to Coles, then refresh this cart.');
  if (!response.ok) throw new Error('Coles did not take the trolley update.');
}

async function run(job) {
  const lines = Array.isArray(job.lines) ? job.lines : [];
  if (lines.length === 0) throw new Error('Open Fill trolley again from Kinexus.');
  const host = location.hostname;
  if (host.endsWith('woolworths.com.au')) await addWoolworths(lines);
  else if (host.endsWith('coles.com.au')) await addColes(lines);
  else throw new Error('Open this link on Coles or Woolworths.');
  overlay(`Added ${lines.length} to your trolley`, ['Checkout stays on this site.']);
}

capture();
const saved = sessionStorage.getItem(STORAGE_KEY);
if (saved) {
  sessionStorage.removeItem(STORAGE_KEY);
  const start = () => {
    run(JSON.parse(saved)).catch((err) => {
      const message = err instanceof Error ? err.message : 'Could not add those products.';
      if (message !== 'Open Fill trolley again from Kinexus.') sessionStorage.setItem(STORAGE_KEY, saved);
      overlay('Trolley not filled', [message]);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
