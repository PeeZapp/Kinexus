import { canonicalizeUrl } from '@kinexus/domain';

import { resolveArchiveTodaySnapshot } from './archive-today.js';
import { isBotProtectedPage, isCloudflareCaptchaFailure } from './bot-page.js';
import { assertPublicHttpUrl, fetchPublicHtml, stripHtml, type FetchPublicHtmlOptions } from './index.js';
import { assertResolvedPublicHost, defaultHostnameLookup } from './ssrf.js';

export type ReaderSource = 'jina' | 'wayback' | 'archive_is';

export type ArchiveViewProvider = 'wayback' | 'archive_is' | 'ghostarchive' | 'google_cache';

export type ArchiveViewSource = {
  id: ArchiveViewProvider;
  label: string;
  url: string;
};

export type ReaderDocument = {
  url: string;
  canonicalUrl: string;
  title: string | null;
  text: string;
  source: ReaderSource;
  sourceUrl: string;
  /** Preferred browseable archive URL (first entry in `views`). */
  viewUrl: string | null;
  /** Alternate archive viewers the client can switch between. */
  views: ArchiveViewSource[];
  fetchedAt: string;
};

const MAX_TEXT_CHARS = 120_000;
const JINA_TIMEOUT_MS = 25_000;
const ARCHIVE_TIMEOUT_MS = 20_000;

type ReaderFetchOptions = FetchPublicHtmlOptions;

function truncate(text: string, max = MAX_TEXT_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}\n\n…`;
}

function normalizeTargetUrl(raw: string): URL {
  return assertPublicHttpUrl(raw.trim());
}

function parseJinaDocument(body: string, fallbackUrl: string): { title: string | null; text: string } {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let title: string | null = null;
  let contentStart = 0;

  for (let i = 0; i < Math.min(lines.length, 40); i += 1) {
    const line = lines[i] ?? '';
    const titleMatch = line.match(/^Title:\s*(.+)\s*$/i);
    if (titleMatch?.[1]) {
      title = titleMatch[1].trim() || null;
      continue;
    }
    if (/^(URL Source|Published Time|Markdown Content|Warning):/i.test(line)) {
      contentStart = i + 1;
      continue;
    }
    if (line.trim() === '=======') {
      contentStart = i + 1;
    }
  }

  while (contentStart < lines.length && !(lines[contentStart] ?? '').trim()) contentStart += 1;
  let text = lines.slice(contentStart).join('\n').trim();
  if (!text) text = body.trim();
  if (!title) {
    const heading = text.match(/^#\s+(.+)$/m);
    title = heading?.[1]?.trim() || null;
  }
  if (!title) {
    try {
      title = new URL(fallbackUrl).hostname;
    } catch {
      title = null;
    }
  }
  return { title, text: truncate(text) };
}

function titleFromHtml(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og?.[1]) return stripHtml(og[1]).trim() || null;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? stripHtml(title[1]).replace(/\s+/g, ' ').trim() || null : null;
}

function buildViewSources(
  target: URL,
  resolved: { wayback?: string | null; archiveIs?: string | null } = {},
): ArchiveViewSource[] {
  const href = target.href;
  const wayback = resolved.wayback?.trim() || `https://web.archive.org/web/latest/${href}`;
  // Prefer a concrete snapshot id. Fall back to /newest/ — the frame proxy resolves it at view time.
  const archiveIs = resolved.archiveIs?.trim() || `https://archive.ph/newest/${href}`;
  // Prefer Wayback first — archive.is often serves Cloudflare/reCAPTCHA walls in the iframe.
  return [
    { id: 'wayback', label: 'Wayback', url: wayback },
    { id: 'archive_is', label: 'archive.is', url: archiveIs },
    {
      id: 'ghostarchive',
      label: 'Ghost Archive',
      url: `https://ghostarchive.org/search?term=${encodeURIComponent(href)}`,
    },
    {
      id: 'google_cache',
      label: 'Google Cache',
      url: `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(href)}`,
    },
  ];
}

function looksLikeChallengeText(body: string): boolean {
  return isCloudflareCaptchaFailure(body) || isBotProtectedPage(body);
}

function withViews(
  document: Omit<ReaderDocument, 'viewUrl' | 'views'>,
  views: ArchiveViewSource[],
): ReaderDocument {
  return {
    ...document,
    views,
    viewUrl: views[0]?.url ?? null,
  };
}

async function fetchJina(
  target: URL,
  options: ReaderFetchOptions,
): Promise<Omit<ReaderDocument, 'viewUrl' | 'views'> | null> {
  const sourceUrl = `https://r.jina.ai/${target.href}`;
  const response = await fetchPublicHtml(sourceUrl, {
    ...options,
    timeoutMs: options.timeoutMs ?? JINA_TIMEOUT_MS,
    escalate: false,
    headers: {
      Accept: 'text/plain',
      'X-Return-Format': 'markdown',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) return null;
  const body = await response.text();
  if (!body.trim() || body.length < 20) return null;
  if (looksLikeChallengeText(body)) return null;
  if (/failed to fetch|blocked|captcha|just a moment|exceeding\s+recaptcha/i.test(body.slice(0, 800))) {
    return null;
  }
  const { title, text } = parseJinaDocument(body, target.href);
  if (text.length < 40) return null;
  if (looksLikeChallengeText(text)) return null;
  return {
    url: target.href,
    canonicalUrl: canonicalizeUrl(target.href) || target.href,
    title,
    text,
    source: 'jina',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
  };
}

type WaybackAvailable = {
  archived_snapshots?: {
    closest?: { available?: boolean; url?: string; timestamp?: string };
  };
};

async function resolveWaybackSnapshot(
  target: URL,
  options: ReaderFetchOptions,
): Promise<{ snapshotUrl: string; rawUrl: string } | null> {
  const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(target.href)}`;
  const response = await fetchPublicHtml(availabilityUrl, {
    ...options,
    timeoutMs: options.timeoutMs ?? ARCHIVE_TIMEOUT_MS,
    escalate: false,
    headers: { Accept: 'application/json', ...(options.headers ?? {}) },
  });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as WaybackAvailable | null;
  const closest = payload?.archived_snapshots?.closest;
  if (!closest?.available || !closest.url) return null;

  let snapshotUrl = closest.url;
  try {
    const parsed = new URL(closest.url);
    parsed.pathname = parsed.pathname.replace(/\/web\/(\d+)/, '/web/$1id_');
    snapshotUrl = parsed.href;
  } catch {
    // keep closest.url
  }

  return { snapshotUrl, rawUrl: closest.url };
}

async function fetchWayback(
  target: URL,
  options: ReaderFetchOptions,
): Promise<{ document: Omit<ReaderDocument, 'viewUrl' | 'views'>; browseUrl: string } | null> {
  const resolved = await resolveWaybackSnapshot(target, options);
  if (!resolved) {
    const latestUrl = `https://web.archive.org/web/latest/${target.href}`;
    const response = await fetchPublicHtml(latestUrl, {
      ...options,
      timeoutMs: options.timeoutMs ?? ARCHIVE_TIMEOUT_MS,
      escalate: false,
    });
    if (!response.ok) return null;
    const html = await response.text();
    if (looksLikeChallengeText(html)) return null;
    const text = truncate(stripHtml(html));
    if (text.length < 80) return null;
    return {
      browseUrl: latestUrl,
      document: {
        url: target.href,
        canonicalUrl: canonicalizeUrl(target.href) || target.href,
        title: titleFromHtml(html),
        text,
        source: 'wayback',
        sourceUrl: latestUrl,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  const response = await fetchPublicHtml(resolved.snapshotUrl, {
    ...options,
    timeoutMs: options.timeoutMs ?? ARCHIVE_TIMEOUT_MS,
    escalate: false,
  });
  if (!response.ok) return null;
  const html = await response.text();
  if (looksLikeChallengeText(html)) return null;
  const text = truncate(stripHtml(html));
  if (text.length < 80) return null;
  return {
    browseUrl: resolved.rawUrl,
    document: {
      url: target.href,
      canonicalUrl: canonicalizeUrl(target.href) || target.href,
      title: titleFromHtml(html),
      text,
      source: 'wayback',
      sourceUrl: resolved.rawUrl,
      fetchedAt: new Date().toISOString(),
    },
  };
}

async function fetchArchiveIs(
  target: URL,
  options: ReaderFetchOptions,
): Promise<{ document: Omit<ReaderDocument, 'viewUrl' | 'views'>; browseUrl: string } | null> {
  const browseUrl = await resolveArchiveTodaySnapshot(target.href, {
    ...options,
    timeoutMs: options.timeoutMs ?? ARCHIVE_TIMEOUT_MS,
  });
  if (!browseUrl) return null;
  const response = await fetchPublicHtml(browseUrl, {
    ...options,
    timeoutMs: options.timeoutMs ?? ARCHIVE_TIMEOUT_MS,
    escalate: true,
  });
  if (!response.ok) return null;
  const html = await response.text();
  if (looksLikeChallengeText(html)) return null;
  const text = truncate(stripHtml(html));
  if (text.length < 80) return null;
  return {
    browseUrl,
    document: {
      url: target.href,
      canonicalUrl: canonicalizeUrl(target.href) || target.href,
      title: titleFromHtml(html),
      text,
      source: 'archive_is',
      sourceUrl: browseUrl,
      fetchedAt: new Date().toISOString(),
    },
  };
}

function preferView(
  views: ArchiveViewSource[],
  preferredId: ArchiveViewProvider | null,
): ArchiveViewSource[] {
  if (!preferredId) return views;
  const preferred = views.find((view) => view.id === preferredId);
  if (!preferred) return views;
  return [preferred, ...views.filter((view) => view.id !== preferredId)];
}

async function resolveViewUrls(
  target: URL,
  options: ReaderFetchOptions,
  known: { wayback?: string | null; archiveIs?: string | null } = {},
  preferredId: ArchiveViewProvider | null = null,
): Promise<ArchiveViewSource[]> {
  let wayback = known.wayback ?? null;
  let archiveIs = known.archiveIs ?? null;

  if (!wayback) {
    try {
      const resolved = await resolveWaybackSnapshot(target, options);
      wayback = resolved?.rawUrl ?? null;
    } catch {
      // keep fallback constructive URL
    }
  }

  if (!archiveIs) {
    try {
      archiveIs = await resolveArchiveTodaySnapshot(target.href, {
        ...options,
        timeoutMs: options.timeoutMs ?? ARCHIVE_TIMEOUT_MS,
      });
    } catch {
      // keep fallback constructive URL
    }
  }

  return preferView(buildViewSources(target, { wayback, archiveIs }), preferredId);
}

export async function fetchReaderDocument(
  url: string,
  options: ReaderFetchOptions = {},
): Promise<ReaderDocument> {
  const target = normalizeTargetUrl(url);
  const lookup = options.lookup ?? defaultHostnameLookup;
  await assertResolvedPublicHost(target.hostname, lookup);

  const errors: string[] = [];
  let knownWayback: string | null = null;
  let knownArchiveIs: string | null = null;

  try {
    const jina = await fetchJina(target, options);
    if (jina) {
      const views = await resolveViewUrls(target, options, {}, 'wayback');
      return withViews(jina, views);
    }
    errors.push('Jina Reader returned no usable content');
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Jina Reader failed');
  }

  try {
    const wayback = await fetchWayback(target, options);
    if (wayback) {
      knownWayback = wayback.browseUrl;
      const views = await resolveViewUrls(target, options, { wayback: knownWayback }, 'wayback');
      return withViews(wayback.document, views);
    }
    errors.push('Wayback Machine has no usable snapshot');
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Wayback Machine failed');
  }

  try {
    const archiveIs = await fetchArchiveIs(target, options);
    if (archiveIs) {
      knownArchiveIs = archiveIs.browseUrl;
      const views = await resolveViewUrls(
        target,
        options,
        {
          wayback: knownWayback,
          archiveIs: knownArchiveIs,
        },
        'wayback',
      );
      return withViews(archiveIs.document, views);
    }
    errors.push('archive.is has no usable snapshot');
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'archive.is failed');
  }

  const detail = errors.filter(Boolean).slice(0, 3).join('; ');
  const error = new Error(
    detail
      ? `Could not load an archived version of that URL (${detail})`
      : 'Could not load an archived version of that URL',
  );
  (error as { status?: number }).status = 422;
  throw error;
}
