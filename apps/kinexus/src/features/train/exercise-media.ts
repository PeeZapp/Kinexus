const EXERCISEDB_GIF =
  /^https:\/\/static\.exercisedb\.dev\/media\/([^/?#]+)\.(?:gif|webp|jpg|jpeg|png)$/i;
const EXERCISEDB_SEARCH = 'https://oss.exercisedb.dev/api/v1/exercises/search';

const resolveCache = new Map<string, Promise<string[]>>();

export function exercisedbMediaId(url: string): string | null {
  const match = url.trim().match(EXERCISEDB_GIF);
  return match?.[1] ?? null;
}

export function isExercisedbMediaUrl(url: string): boolean {
  return exercisedbMediaId(url) != null;
}

export function exercisedbGifUrl(id: string): string {
  return `https://static.exercisedb.dev/media/${id}.gif`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

type SearchRow = {
  name?: string;
  gifUrl?: string;
  exerciseId?: string;
};

export async function lookupExercisedbGifUrls(name: string): Promise<string[]> {
  const key = normalizeName(name);
  if (!key) return [];

  const cached = resolveCache.get(key);
  if (cached) return cached;

  const request = (async () => {
    try {
      const response = await fetch(`${EXERCISEDB_SEARCH}?search=${encodeURIComponent(name)}&limit=25`);
      if (!response.ok) return [];
      const json = (await response.json()) as { data?: SearchRow[] };
      const rows = Array.isArray(json.data) ? json.data : [];
      const exact = rows.filter((row) => normalizeName(row.name ?? '') === key);
      const pool = exact.length > 0 ? exact : rows;
      const urls: string[] = [];
      for (const row of pool) {
        const url = row.gifUrl?.trim() || (row.exerciseId ? exercisedbGifUrl(row.exerciseId) : '');
        if (url && !urls.includes(url)) urls.push(url);
      }
      return urls;
    } catch {
      return [];
    }
  })();

  resolveCache.set(key, request);
  return request;
}

export async function nextExerciseMediaUrl(input: {
  urls: readonly string[];
  name?: string;
  failed: readonly string[];
}): Promise<string | null> {
  const tried = new Set(input.failed);
  for (const url of input.urls) {
    if (url && !tried.has(url)) return url;
  }

  const shouldLookup =
    Boolean(input.name) &&
    (input.urls.some(isExercisedbMediaUrl) || input.failed.some(isExercisedbMediaUrl));
  if (!shouldLookup || !input.name) return null;

  const alternates = await lookupExercisedbGifUrls(input.name);
  for (const url of alternates) {
    if (!tried.has(url)) return url;
  }
  return null;
}
