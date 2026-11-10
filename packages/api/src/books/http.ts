import {
  awaitBookProviderSlot,
  hardcoverHeaderWaitMs,
  openLibraryRps,
  parseRetryAfterMs,
} from './rate-limit.js';

export type BookFetch = typeof fetch;

let contactWarned = false;

export function openLibraryUserAgent(): string {
  const email = process.env.BOOKS_CONTACT_EMAIL?.trim();
  if (email) return `Kinexus (${email})`;
  if (!contactWarned) {
    contactWarned = true;
    console.warn('BOOKS_CONTACT_EMAIL is not set; Open Library User-Agent is "Kinexus" and rate limited to 1 rps');
  }
  return 'Kinexus';
}

/** Test helper. */
export function resetOpenLibraryUaWarning(): void {
  contactWarned = false;
}

export type BookHttpDeps = {
  fetchImpl?: BookFetch;
};

export async function booksFetch(
  provider: 'open_library' | 'hardcover' | 'google_books',
  url: string,
  init: RequestInit = {},
  deps: BookHttpDeps = {},
): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const headers = new Headers(init.headers);
  let rps = 1;
  let extraWait = 0;

  if (provider === 'open_library') {
    rps = openLibraryRps();
    if (!headers.has('User-Agent')) headers.set('User-Agent', openLibraryUserAgent());
  } else if (provider === 'hardcover') {
    rps = 2;
  } else {
    rps = 2;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await awaitBookProviderSlot(provider, rps, extraWait);
    extraWait = 0;
    try {
      const response = await fetchImpl(url, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(20_000) });
      if (response.status === 429) {
        const wait = parseRetryAfterMs(response.headers.get('retry-after'), 1000 * (attempt + 1));
        extraWait = wait;
        lastError = new Error(`${provider} rate limited (429)`);
        continue;
      }
      if (provider === 'hardcover') {
        extraWait = hardcoverHeaderWaitMs(response.headers);
      }
      return response;
    } catch (err) {
      lastError = err;
      extraWait = 300 * (attempt + 1);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${provider} request failed`);
}
