import { assertPublicHttpUrl, fetchPublicHtml, SsrfError } from './index.js';
import {
  archiveTodayMirrorUrls,
  isArchiveTodayHost,
  resolveArchiveTodayFrameTarget,
  resolveArchiveTodaySnapshot,
} from './archive-today.js';
import { isBotProtectedPage } from './bot-page.js';
import { assertResolvedPublicHost, defaultHostnameLookup, type HostnameLookup } from './ssrf.js';

const MAX_HTML_CHARS = 2_500_000;
const FETCH_TIMEOUT_MS = 25_000;

const ARCHIVE_HOST_RE =
  /^(?:(?:www|web)\.)?archive\.org$|^(?:www\.)?web\.archive\.org$|^archive\.(?:is|ph|md|today|vn|fo)$|^ghostarchive\.org$|^webcache\.googleusercontent\.com$/i;

export function isAllowedArchiveFrameHost(hostname: string): boolean {
  return ARCHIVE_HOST_RE.test(hostname.replace(/^\[|\]$/g, '').toLowerCase());
}

export function assertArchiveFrameUrl(raw: string): URL {
  const parsed = assertPublicHttpUrl(raw.trim());
  if (!isAllowedArchiveFrameHost(parsed.hostname)) {
    throw new SsrfError('That archive host is not allowed');
  }
  return parsed;
}

export function prepareArchiveFrameHtml(html: string, pageUrl: string): string {
  let out = html
    .replace(/<meta[^>]+http-equiv=["']X-Frame-Options["'][^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

  const safeBase = pageUrl.replace(/"/g, '&quot;');
  const injected = `<base href="${safeBase}"><meta name="referrer" content="no-referrer">`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (match) => `${match}${injected}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (match) => `${match}<head>${injected}</head>`);
  } else {
    out = `<!DOCTYPE html><html><head>${injected}</head><body>${out}</body></html>`;
  }

  if (out.length > MAX_HTML_CHARS) {
    out = `${out.slice(0, MAX_HTML_CHARS)}\n<!-- truncated -->`;
  }
  return out;
}

export type ArchiveFrameOptions = {
  lookup?: HostnameLookup;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

async function fetchOnceHtml(
  url: string,
  options: ArchiveFrameOptions,
  escalate: boolean,
): Promise<{ ok: boolean; status: number; html: string; url: string }> {
  const lookup = options.lookup ?? defaultHostnameLookup;
  const parsed = assertArchiveFrameUrl(url);
  await assertResolvedPublicHost(parsed.hostname, lookup);
  const response = await fetchPublicHtml(parsed.href, {
    lookup,
    fetch: options.fetch,
    timeoutMs: options.timeoutMs ?? FETCH_TIMEOUT_MS,
    escalate,
    headers: {
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    },
  });
  return { ok: response.ok, status: response.status, html: await response.text(), url: parsed.href };
}

export async function fetchArchiveFrameHtml(
  rawUrl: string,
  options: ArchiveFrameOptions = {},
): Promise<{ html: string; finalUrl: string }> {
  let targetHref = assertArchiveFrameUrl(rawUrl).href;

  if (isArchiveTodayHost(new URL(targetHref).hostname)) {
    try {
      targetHref = await resolveArchiveTodayFrameTarget(targetHref, {
        lookup: options.lookup,
        fetch: options.fetch,
        timeoutMs: options.timeoutMs ?? FETCH_TIMEOUT_MS,
      });
    } catch {
      // keep original
    }
  }

  const candidates = isArchiveTodayHost(new URL(targetHref).hostname)
    ? archiveTodayMirrorUrls(targetHref)
    : [targetHref];

  let lastStatus = 0;
  for (const candidate of candidates) {
    try {
      const escalate = isArchiveTodayHost(new URL(candidate).hostname);
      const result = await fetchOnceHtml(candidate, options, escalate);
      lastStatus = result.status;
      if (!result.ok || !result.html.trim()) continue;
      // Don't iframe Cloudflare/reCAPTCHA walls — try the next mirror or fail cleanly.
      if (isBotProtectedPage(result.html, result.status)) continue;

      // If we still landed on a /newest/ results page, try to peel out the snapshot once more.
      if (/\/newest\//i.test(candidate) || /\/newest\//i.test(result.url)) {
        const peeled = await resolveArchiveTodaySnapshot(
          candidate.replace(/^https?:\/\/[^/]+\/newest\//i, ''),
          { lookup: options.lookup, fetch: options.fetch, timeoutMs: options.timeoutMs },
        ).catch(() => null);
        if (peeled && peeled !== candidate) {
          const again = await fetchOnceHtml(peeled, options, true);
          if (again.ok && again.html.trim() && !isBotProtectedPage(again.html, again.status)) {
            return { html: prepareArchiveFrameHtml(again.html, again.url), finalUrl: again.url };
          }
        }
      }

      return { html: prepareArchiveFrameHtml(result.html, result.url), finalUrl: result.url };
    } catch {
      // try next mirror
    }
  }

  const error = new Error(
    lastStatus
      ? `Archive page returned HTTP ${lastStatus}`
      : 'Archive viewer is blocked by a captcha wall — try Wayback or Text mode',
  );
  (error as { status?: number }).status = lastStatus >= 400 && lastStatus < 600 ? lastStatus : 422;
  throw error;
}
