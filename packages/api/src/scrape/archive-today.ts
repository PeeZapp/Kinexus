import { assertPublicHttpUrl, fetchPublicHtml, type FetchPublicHtmlOptions } from './index.js';

const ARCHIVE_MIRRORS = ['archive.ph', 'archive.is', 'archive.today', 'archive.md'] as const;
const ARCHIVE_TIMEOUT_MS = 20_000;

export function isArchiveTodayHost(hostname: string): boolean {
  return /^archive\.(?:is|ph|md|today|vn|fo)$/i.test(hostname.replace(/^\[|\]$/g, ''));
}

export function archiveTodayMirrorUrls(url: string): string[] {
  try {
    const parsed = new URL(url);
    if (!isArchiveTodayHost(parsed.hostname)) return [url];
    return ARCHIVE_MIRRORS.map((host) => {
      const next = new URL(parsed.href);
      next.hostname = host;
      return next.href;
    });
  } catch {
    return [url];
  }
}

function isSoftMiss(html: string): boolean {
  const head = html.slice(0, 4_000);
  return /no results|not been archived|0 results|nothing found|no captures|page not found/i.test(head);
}

function looksLikeSnapshotPath(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  if (/\/(newest|all|wip|timemap|share)\b/i.test(pathname)) return false;
  // Short ids (Ab12Cd) or dated ids (2024.01.01-12345)
  return /^\/(?:[A-Za-z0-9]{5,}|[\d.]+-\d+)\/?$/.test(pathname) || /^\/o\/[A-Za-z0-9]+/i.test(pathname);
}

export function extractArchiveTodaySnapshotUrl(html: string, baseUrl?: string): string | null {
  const candidates: string[] = [];

  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  if (canonical?.[1]) candidates.push(canonical[1]);

  const og =
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i);
  if (og?.[1]) candidates.push(og[1]);

  const refresh = html.match(/http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'\s>]+)/i);
  if (refresh?.[1]) candidates.push(refresh[1]);

  for (const match of html.matchAll(/https?:\/\/archive\.(?:is|ph|md|today|vn|fo)\/[^\s"'<>]+/gi)) {
    candidates.push(match[0].replace(/[),.;]+$/, ''));
  }

  if (baseUrl) {
    for (const match of html.matchAll(/href=["'](\/(?:o\/)?[A-Za-z0-9][A-Za-z0-9._-]*)["']/gi)) {
      const path = match[1];
      if (!path) continue;
      try {
        candidates.push(new URL(path, baseUrl).href);
      } catch {
        // ignore
      }
    }
  }

  for (const raw of candidates) {
    try {
      const parsed = new URL(raw.trim(), baseUrl);
      if (!isArchiveTodayHost(parsed.hostname)) continue;
      if (!looksLikeSnapshotPath(parsed.pathname)) continue;
      parsed.hash = '';
      return parsed.href;
    } catch {
      // keep looking
    }
  }
  return null;
}

function parseTimemapNewest(body: string): string | null {
  const lines = body.split(/\n+/);
  let newest: { url: string; datetime: number } | null = null;
  for (const line of lines) {
    const urlMatch = line.match(/<(https?:\/\/[^>]+)>/);
    if (!urlMatch?.[1]) continue;
    if (!/rel=["']?memento/i.test(line) && !/memento/i.test(line)) continue;
    try {
      const parsed = new URL(urlMatch[1]);
      if (!isArchiveTodayHost(parsed.hostname) && !/web\.archive\.org/i.test(parsed.hostname)) {
        // archive.is timemap usually points at archive.* hosts
      }
      if (!isArchiveTodayHost(parsed.hostname)) continue;
      const dt = line.match(/datetime=["']([^"']+)["']/i)?.[1];
      const when = dt ? Date.parse(dt) : 0;
      if (!newest || when >= newest.datetime) newest = { url: parsed.href, datetime: when };
    } catch {
      // ignore
    }
  }
  // Plain URL list fallback
  if (!newest) {
    for (const match of body.matchAll(/https?:\/\/archive\.(?:is|ph|md|today|vn|fo)\/[A-Za-z0-9][^\s<>"']*/gi)) {
      try {
        const parsed = new URL(match[0].replace(/[),.;]+$/, ''));
        if (looksLikeSnapshotPath(parsed.pathname)) return parsed.href;
      } catch {
        // ignore
      }
    }
  }
  return newest?.url ?? null;
}

async function fetchArchiveHtml(
  url: string,
  options: FetchPublicHtmlOptions,
): Promise<{ ok: boolean; status: number; html: string; url: string }> {
  const response = await fetchPublicHtml(url, {
    ...options,
    timeoutMs: options.timeoutMs ?? ARCHIVE_TIMEOUT_MS,
    escalate: options.escalate ?? true,
  });
  const html = await response.text();
  return { ok: response.ok, status: response.status, html, url };
}

/**
 * Resolve a concrete archive.is snapshot URL (short id), not a /newest/ locator.
 * Returns null when no snapshot can be confirmed.
 */
export async function resolveArchiveTodaySnapshot(
  targetUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<string | null> {
  const target = assertPublicHttpUrl(targetUrl.trim());

  for (const host of ARCHIVE_MIRRORS) {
    try {
      const timemapUrl = `https://${host}/timemap/${target.href}`;
      const result = await fetchArchiveHtml(timemapUrl, { ...options, escalate: false });
      if (result.ok && result.html.trim()) {
        const fromMap = parseTimemapNewest(result.html);
        if (fromMap) return fromMap;
      }
    } catch {
      // try next
    }
  }

  for (const host of ARCHIVE_MIRRORS) {
    try {
      const probeUrl = `https://${host}/newest/${target.href}`;
      const result = await fetchArchiveHtml(probeUrl, options);
      if (!result.ok || isSoftMiss(result.html)) continue;
      const snapshot = extractArchiveTodaySnapshotUrl(result.html, probeUrl);
      if (snapshot) return snapshot;
    } catch {
      // try next
    }
  }

  return null;
}

/**
 * If the frame URL is a /newest/ locator (or 404s), resolve/retry across mirrors.
 */
export async function resolveArchiveTodayFrameTarget(
  frameUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<string> {
  const parsed = assertPublicHttpUrl(frameUrl.trim());
  if (!isArchiveTodayHost(parsed.hostname)) return parsed.href;

  const newestMatch = parsed.href.match(/^https?:\/\/[^/]+\/newest\/(https?:\/\/.+)$/i);
  if (newestMatch?.[1]) {
    const resolved = await resolveArchiveTodaySnapshot(newestMatch[1], options);
    if (resolved) return resolved;
  }

  if (looksLikeSnapshotPath(parsed.pathname)) {
    return parsed.href;
  }

  // Path might already be a locator like /all/... — try extracting original if present
  const embedded = parsed.href.match(/\/(?:newest|all)\/(https?:\/\/.+)$/i)?.[1];
  if (embedded) {
    const resolved = await resolveArchiveTodaySnapshot(embedded, options);
    if (resolved) return resolved;
  }

  return parsed.href;
}
