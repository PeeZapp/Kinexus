import {
  newsTopicPriorityConfig,
  normalizeNewsInterests,
  normalizeNewsTopicPriorities,
  normalizeTopicPriorities,
  weatherCodeLabel,
  weatherKind,
  type NewsHeadline,
  type NewsSection,
  type NewsTopicPriorities,
  type WeatherDay,
  type WeatherReport,
} from '@kinexus/domain';

const HEADLINES_PER_INTEREST = 6;
const PARSED_PER_FEED = 12;
const PLACE_LIMIT = 6;
const CACHE_MS = 15 * 60 * 1000;
const USER_AGENT = 'Kinexus/1.0 (personal daily overview)';

const NEWS_EDITIONS = [
  { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  { hl: 'en-AU', gl: 'AU', ceid: 'AU:en' },
] as const;

type FetchLike = typeof fetch;

type CacheEntry = { at: number; headlines: NewsHeadline[] };

const headlineCache = new Map<string, CacheEntry>();

export type PlaceHit = {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  country: string | null;
};

type GeocodeResult = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country?: string;
  admin1?: string;
};

function finiteCoord(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagText(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeXml(match[1] ?? '') : '';
}

function stripSourceSuffix(title: string, source: string): string {
  const suffix = ` - ${source}`;
  if (source && title.toLowerCase().endsWith(suffix.toLowerCase())) {
    return title.slice(0, title.length - suffix.length).trim();
  }
  return title;
}

export function parseRssHeadlines(xml: string, source: string, limit = PARSED_PER_FEED): NewsHeadline[] {
  const headlines: NewsHeadline[] = [];
  const seen = new Set<string>();
  for (const chunk of xml.split(/<item\b/i).slice(1)) {
    const block = chunk.split(/<\/item>/i)[0] ?? '';
    const named = tagText(block, 'source');
    const publisher = named || source;
    const title = stripSourceSuffix(tagText(block, 'title'), publisher);
    const url = tagText(block, 'link');
    if (!title || !/^https?:\/\//i.test(url)) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    headlines.push({
      title,
      url,
      source: publisher,
      publishedAt: tagText(block, 'pubDate') || null,
    });
    if (headlines.length >= limit) break;
  }
  return headlines;
}

export function pickDiverseHeadlines(items: readonly NewsHeadline[], limit = HEADLINES_PER_INTEREST): NewsHeadline[] {
  const picked: NewsHeadline[] = [];
  const sources = new Set<string>();
  const titles = new Set<string>();
  const take = (item: NewsHeadline, requireNewSource: boolean) => {
    const title = item.title.toLowerCase();
    const source = item.source.toLowerCase();
    if (titles.has(title)) return;
    if (requireNewSource && sources.has(source)) return;
    titles.add(title);
    sources.add(source);
    picked.push(item);
  };
  for (const item of items) {
    take(item, true);
    if (picked.length >= limit) return picked;
  }
  for (const item of items) {
    take(item, false);
    if (picked.length >= limit) break;
  }
  return picked;
}

function interleave(groups: NewsHeadline[][]): NewsHeadline[] {
  const mixed: NewsHeadline[] = [];
  const longest = groups.reduce((max, group) => Math.max(max, group.length), 0);
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const item = group[index];
      if (item) mixed.push(item);
    }
  }
  return mixed;
}

function placeLabel(hit: GeocodeResult): string {
  const name = hit.name?.trim() || 'Pinned location';
  const region = hit.admin1?.trim();
  const country = hit.country?.trim();
  const parts = [name];
  if (region && region.toLowerCase() !== name.toLowerCase()) parts.push(region);
  else if (country && country.toLowerCase() !== name.toLowerCase()) parts.push(country);
  return parts.join(', ');
}

function toPlace(hit: GeocodeResult): PlaceHit | null {
  const latitude = finiteCoord(hit.latitude, -90, 90);
  const longitude = finiteCoord(hit.longitude, -180, 180);
  if (latitude == null || longitude == null) return null;
  return {
    id: typeof hit.id === 'number' ? hit.id : Math.round(latitude * 1000) * 1000 + Math.round(longitude * 1000),
    label: placeLabel(hit),
    latitude,
    longitude,
    timezone: typeof hit.timezone === 'string' && hit.timezone ? hit.timezone : null,
    country: typeof hit.country === 'string' && hit.country ? hit.country : null,
  };
}

async function readJson(url: string, fetchImpl: FetchLike, failure: string): Promise<unknown> {
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(failure);
  return res.json();
}

export async function searchPlaces(
  input: { query?: unknown; latitude?: unknown; longitude?: unknown },
  fetchImpl: FetchLike = fetch,
): Promise<PlaceHit[]> {
  const latitude = finiteCoord(input.latitude, -90, 90);
  const longitude = finiteCoord(input.longitude, -180, 180);
  if (latitude != null && longitude != null) {
    const pinned = {
      id: 0,
      label: 'Current location',
      latitude,
      longitude,
      timezone: null,
      country: null,
    };
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en`;
      const raw = (await readJson(url, fetchImpl, 'Place search is unavailable right now.')) as {
        results?: GeocodeResult[];
      };
      const places = (raw.results ?? []).map(toPlace).filter((place): place is PlaceHit => place != null);
      if (places.length > 0) return places.slice(0, PLACE_LIMIT);
    } catch {
      return [pinned];
    }
    return [pinned];
  }

  const query = typeof input.query === 'string' ? input.query.trim() : '';
  if (query.length < 2 || query.length > 80) {
    throw new Error('Enter at least two letters of a place name.');
  }
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${PLACE_LIMIT}&language=en&format=json`;
  const raw = (await readJson(url, fetchImpl, 'Place search is unavailable right now.')) as {
    results?: GeocodeResult[];
  };
  return (raw.results ?? []).map(toPlace).filter((place): place is PlaceHit => place != null);
}

function dayNumber(values: unknown, index: number): number | null {
  if (!Array.isArray(values)) return null;
  const n = values[index];
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export function parseForecast(raw: unknown): WeatherReport {
  const body = raw as {
    timezone?: string;
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      relative_humidity_2m?: number;
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
    };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      weather_code?: number[];
      precipitation_probability?: number[];
    };
  };
  const currentCode = body.current?.weather_code;
  const currentTemp = body.current?.temperature_2m;
  const times = body.daily?.time ?? [];
  if (typeof currentTemp !== 'number' || typeof currentCode !== 'number' || times.length === 0) {
    throw new Error('Weather is unavailable right now.');
  }
  const hoursByDate = new Map<string, WeatherDay['hours']>();
  const hourTimes = body.hourly?.time ?? [];
  for (let i = 0; i < hourTimes.length; i += 1) {
    const time = hourTimes[i];
    if (!time || time.length < 13) continue;
    const temperature = dayNumber(body.hourly?.temperature_2m, i);
    const code = dayNumber(body.hourly?.weather_code, i);
    if (temperature == null || code == null) continue;
    const date = time.slice(0, 10);
    const rain = dayNumber(body.hourly?.precipitation_probability, i);
    const list = hoursByDate.get(date) ?? [];
    list.push({
      time,
      temperature,
      code,
      label: weatherCodeLabel(code),
      kind: weatherKind(code),
      rainChance: rain == null ? null : Math.round(rain),
    });
    hoursByDate.set(date, list);
  }
  const days: WeatherDay[] = [];
  for (let i = 0; i < times.length && days.length < 7; i += 1) {
    const date = times[i];
    const high = dayNumber(body.daily?.temperature_2m_max, i);
    const low = dayNumber(body.daily?.temperature_2m_min, i);
    const code = dayNumber(body.daily?.weather_code, i);
    if (!date || high == null || low == null || code == null) continue;
    const rain = dayNumber(body.daily?.precipitation_probability_max, i);
    days.push({
      date,
      code,
      label: weatherCodeLabel(code),
      kind: weatherKind(code),
      high,
      low,
      rainChance: rain == null ? null : Math.round(rain),
      hours: hoursByDate.get(date) ?? [],
    });
  }
  if (days.length === 0) throw new Error('Weather is unavailable right now.');
  return {
    place: null,
    timezone: typeof body.timezone === 'string' ? body.timezone : null,
    current: {
      temperature: currentTemp,
      code: currentCode,
      label: weatherCodeLabel(currentCode),
      kind: weatherKind(currentCode),
      wind: typeof body.current?.wind_speed_10m === 'number' ? body.current.wind_speed_10m : null,
      humidity: typeof body.current?.relative_humidity_2m === 'number' ? body.current.relative_humidity_2m : null,
    },
    days,
  };
}

export async function loadForecast(
  latitude: number,
  longitude: number,
  fetchImpl: FetchLike = fetch,
): Promise<WeatherReport> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
  });
  const raw = await readJson(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    fetchImpl,
    'Weather is unavailable right now.',
  );
  return parseForecast(raw);
}

type NewsLoadOptions = {
  topicPriorities?: NewsTopicPriorities;
  /** @deprecated Prefer topicPriorities.sport */
  sportPriorities?: readonly string[];
};

const GAMING_TOPIC_BIAS =
  '("new game" OR "game release" OR release OR launch OR "out now" OR "game review" OR review OR "video game industry" OR industry)';

/** Google News query bias for interests that need topic focus beyond the label. */
const INTEREST_NEWS_QUERIES: Record<string, string> = {
  gaming: `gaming ${GAMING_TOPIC_BIAS} when:3d`,
};

function topicPrioritiesFor(interest: string, options: NewsLoadOptions): string[] {
  const config = newsTopicPriorityConfig(interest);
  if (!config) return [];
  const fromMap = options.topicPriorities?.[config.key];
  if (Array.isArray(fromMap) && fromMap.length > 0) {
    return normalizeTopicPriorities(config.key, fromMap);
  }
  if (config.key === 'sport' && options.sportPriorities) {
    return normalizeTopicPriorities('sport', options.sportPriorities);
  }
  return [];
}

export function newsQueryForInterest(interest: string, options: NewsLoadOptions = {}): string {
  const key = interest.toLowerCase();
  const topics = topicPrioritiesFor(interest, options);
  if (topics.length > 0) {
    const clause = topics.map((topic) => `"${topic}"`).join(' OR ');
    if (key === 'gaming') return `(${clause}) ${GAMING_TOPIC_BIAS} when:3d`;
    return `(${clause}) when:3d`;
  }
  return INTEREST_NEWS_QUERIES[key] ?? `${interest} when:3d`;
}

function gamingHeadlineScore(title: string): number {
  const t = title.toLowerCase();
  const isReview = /\b(game review|reviews?|reviewed|verdict)\b/.test(t);
  const isRelease =
    /\b(new game|game release|releases?|releasing|out now|now available|launches?|launched)\b/.test(t);
  const isIndustry =
    /\b(video game industry|game industry|publisher|studio|layoffs?|acquisition|acquires?)\b/.test(t);
  // Prefer releases, then industry, then reviews (reviews mentioning "launch" stay reviews).
  if (isRelease && !isReview) return 3;
  if (isIndustry) return 2;
  if (isReview) return 1;
  return 0;
}

function topicHeadlineScore(title: string, topics: readonly string[]): number {
  const t = title.toLowerCase();
  let best = 0;
  topics.forEach((topic, index) => {
    if (!t.includes(topic.toLowerCase())) return;
    const score = topics.length - index;
    if (score > best) best = score;
  });
  return best;
}

function prioritizeHeadlines(
  interest: string,
  items: NewsHeadline[],
  options: NewsLoadOptions = {},
): NewsHeadline[] {
  const key = interest.toLowerCase();
  const topics = topicPrioritiesFor(interest, options);
  if (topics.length === 0 && key !== 'gaming') return items;
  return [...items].sort((a, b) => {
    const topicDelta = topicHeadlineScore(b.title, topics) - topicHeadlineScore(a.title, topics);
    if (topicDelta !== 0) return topicDelta;
    if (key === 'gaming') return gamingHeadlineScore(b.title) - gamingHeadlineScore(a.title);
    return 0;
  });
}

function cacheKeyForInterest(interest: string, options: NewsLoadOptions): string {
  const key = interest.toLowerCase();
  const topics = topicPrioritiesFor(interest, options);
  return topics.length > 0 ? `${key}:${topics.map((topic) => topic.toLowerCase()).join('|')}` : key;
}

function newsSearchUrl(
  interest: string,
  edition: (typeof NEWS_EDITIONS)[number],
  options: NewsLoadOptions = {},
): string {
  const params = new URLSearchParams({
    q: newsQueryForInterest(interest, options),
    hl: edition.hl,
    gl: edition.gl,
    ceid: edition.ceid,
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

async function loadInterest(
  interest: string,
  fetchImpl: FetchLike,
  options: NewsLoadOptions = {},
): Promise<NewsHeadline[]> {
  const key = cacheKeyForInterest(interest, options);
  const cached = headlineCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.headlines;
  const groups = await Promise.all(
    NEWS_EDITIONS.map(async (edition) => {
      try {
        const res = await fetchImpl(newsSearchUrl(interest, edition, options), {
          headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        return parseRssHeadlines(await res.text(), 'News');
      } catch {
        return [];
      }
    }),
  );
  const headlines = pickDiverseHeadlines(prioritizeHeadlines(interest, interleave(groups), options));
  if (headlines.length === 0) throw new Error('No headlines for that interest right now.');
  headlineCache.set(key, { at: Date.now(), headlines });
  return headlines;
}

export async function loadNews(
  interests: readonly string[],
  fetchImpl: FetchLike = fetch,
  options: NewsLoadOptions = {},
): Promise<NewsSection[]> {
  const chosen = normalizeNewsInterests(interests);
  if (chosen.length === 0) throw new Error('Add at least one interest.');
  const topicPriorities = normalizeNewsTopicPriorities(chosen, {
    ...(options.topicPriorities ?? {}),
    ...(options.sportPriorities?.length
      ? { sport: [...(options.topicPriorities?.sport ?? []), ...options.sportPriorities] }
      : {}),
  });
  return Promise.all(
    chosen.map(async (interest) => {
      try {
        const headlines = await loadInterest(interest, fetchImpl, { topicPriorities });
        return { interest, headlines };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Headlines are unavailable right now.';
        return { interest, headlines: [], error: message };
      }
    }),
  );
}

type HandlerResult = { status: number; body: Record<string, unknown> };

export async function handleOverviewPlaces(body: {
  query?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}): Promise<HandlerResult> {
  try {
    const places = await searchPlaces(body);
    return { status: 200, body: { places } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Place search failed.';
    const status = /unavailable/i.test(message) ? 502 : 400;
    return { status, body: { error: message } };
  }
}

export async function handleOverviewWeather(body: {
  latitude?: unknown;
  longitude?: unknown;
}): Promise<HandlerResult> {
  const latitude = finiteCoord(body.latitude, -90, 90);
  const longitude = finiteCoord(body.longitude, -180, 180);
  if (latitude == null || longitude == null) {
    return { status: 400, body: { error: 'Choose a place for the forecast.' } };
  }
  try {
    const weather = await loadForecast(latitude, longitude);
    return { status: 200, body: { weather } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Weather is unavailable right now.';
    return { status: 502, body: { error: message } };
  }
}

export async function handleOverviewNews(body: {
  interests?: unknown;
  topicPriorities?: unknown;
  sportPriorities?: unknown;
}): Promise<HandlerResult> {
  if (!Array.isArray(body.interests)) {
    return { status: 400, body: { error: 'Add at least one interest.' } };
  }
  try {
    const interests = body.interests.map((value) => String(value));
    const topicPriorities = normalizeNewsTopicPriorities(interests, body.topicPriorities);
    const sportPriorities = Array.isArray(body.sportPriorities)
      ? body.sportPriorities.map((value) => String(value))
      : [];
    const sections = await loadNews(interests, fetch, { topicPriorities, sportPriorities });
    return { status: 200, body: { sections } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Headlines are unavailable right now.';
    return { status: 400, body: { error: message } };
  }
}
