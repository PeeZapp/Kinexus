import { assertPublicHttpUrl, SsrfError } from '../scrape/ssrf.js';

const MAX_LINKS = 8;
const TIMEOUT_MS = 8_000;

export type VerifyCreatorLinksBody = {
  urls?: unknown;
};

async function probeUrl(raw: string): Promise<{ url: string; ok: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = assertPublicHttpUrl(raw);
  } catch (err) {
    return {
      url: raw,
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid URL',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(parsed.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'KinexusCreatorLinkCheck/1.0' },
    });
    // Some social hosts reject HEAD — fall back to GET.
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'KinexusCreatorLinkCheck/1.0' },
      });
    }
    if (res.status >= 200 && res.status < 400) {
      return { url: parsed.toString(), ok: true };
    }
    // Social hosts often challenge bots (login walls / rate limits) even when the profile exists.
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const socialHost =
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be' ||
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'x.com' ||
      host === 'twitter.com' ||
      host.endsWith('.twitter.com');
    if (socialHost && (res.status === 401 || res.status === 403 || res.status === 429)) {
      return { url: parsed.toString(), ok: true };
    }
    return { url: parsed.toString(), ok: false, error: `Link returned status ${res.status}` };
  } catch (err) {
    if (err instanceof SsrfError) {
      return { url: raw, ok: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : 'Could not reach link';
    return {
      url: parsed.toString(),
      ok: false,
      error: message.includes('abort') ? 'Link timed out' : 'Could not reach that link',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function handleVerifyCreatorLinks(body: VerifyCreatorLinksBody) {
  const rawList = Array.isArray(body.urls) ? body.urls : [];
  const urls = [
    ...new Set(
      rawList
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_LINKS);

  if (urls.length === 0) {
    return { status: 400 as const, body: { error: 'Add at least one link to verify' } };
  }

  const results = await Promise.all(urls.map((url) => probeUrl(url)));
  const failed = results.filter((row) => !row.ok);
  if (failed.length > 0) {
    return {
      status: 400 as const,
      body: {
        error: `We could not open: ${failed.map((row) => row.url).join(', ')}. Check the link and try again.`,
        results,
      },
    };
  }

  return { status: 200 as const, body: { ok: true as const, results } };
}
