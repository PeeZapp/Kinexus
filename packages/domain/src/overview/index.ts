export {
  DAY_TASK_LIMIT,
  JOURNAL_LIMIT,
  WORKOUT_NOTES_LIMIT,
  WORKOUT_TITLE_LIMIT,
  clipDayText,
  normalizeDayTask,
  normalizeDayTasks,
} from './day';
export type { DayTask } from './day';

export const OVERVIEW_WIDGETS = ['weather', 'news', 'wordle', 'puzzles'] as const;

export type OverviewWidget = (typeof OVERVIEW_WIDGETS)[number];

export const NEWS_INTEREST_LIMIT = 8;
export const NEWS_TOPIC_PRIORITY_LIMIT = 6;
/** @deprecated Use NEWS_TOPIC_PRIORITY_LIMIT */
export const SPORT_NEWS_LIMIT = NEWS_TOPIC_PRIORITY_LIMIT;

export const NEWS_INTEREST_SUGGESTIONS = [
  'World',
  'Australia',
  'Technology',
  'Gaming',
  'Fashion',
  'Business',
  'Science',
  'Health',
  'Sport',
  'Food',
  'Film',
  'Music',
] as const;

export type NewsTopicPriorityConfig = {
  key: string;
  label: string;
  noun: string;
  placeholder: string;
  blurb: string;
  emptyHint: string;
  suggestions: readonly string[];
};

export const NEWS_TOPIC_PRIORITY_CONFIGS: readonly NewsTopicPriorityConfig[] = [
  {
    key: 'sport',
    label: 'Sports to prioritise',
    noun: 'sport',
    placeholder: 'AFL, cricket, F1…',
    blurb: 'Pick the sports you care about most. Add them in order — earlier ones rank higher in your Sport headlines.',
    emptyHint: 'No sports prioritised yet — general Sport headlines for now.',
    suggestions: [
      'AFL',
      'NRL',
      'Cricket',
      'Soccer',
      'Tennis',
      'NBA',
      'NFL',
      'F1',
      'Rugby',
      'Golf',
      'Netball',
      'Olympics',
    ],
  },
  {
    key: 'film',
    label: 'Film topics to prioritise',
    noun: 'topic',
    placeholder: 'Horror, Marvel, anime…',
    blurb: 'Focus Film headlines on the beats you follow. Earlier picks rank higher.',
    emptyHint: 'No film topics prioritised yet — general Film headlines for now.',
    suggestions: [
      'Marvel',
      'A24',
      'Horror',
      'Animation',
      'Documentary',
      'Oscars',
      'Anime',
      'Indie',
      'Streaming',
      'Box office',
    ],
  },
  {
    key: 'music',
    label: 'Music topics to prioritise',
    noun: 'topic',
    placeholder: 'Hip-hop, indie, K-pop…',
    blurb: 'Tune Music headlines to the scenes you care about. Earlier picks rank higher.',
    emptyHint: 'No music topics prioritised yet — general Music headlines for now.',
    suggestions: [
      'Hip-hop',
      'Pop',
      'Indie',
      'Rock',
      'K-pop',
      'Electronic',
      'Country',
      'Jazz',
      'Classical',
      'Metal',
    ],
  },
  {
    key: 'fashion',
    label: 'Fashion topics to prioritise',
    noun: 'topic',
    placeholder: 'Runway, streetwear, beauty…',
    blurb: 'Curate Fashion headlines around the lanes you follow. Earlier picks rank higher.',
    emptyHint: 'No fashion topics prioritised yet — general Fashion headlines for now.',
    suggestions: [
      'Runway',
      'Streetwear',
      'Luxury',
      'Beauty',
      'Sustainable',
      'Sneakers',
      'Couture',
      'Fashion Week',
    ],
  },
  {
    key: 'gaming',
    label: 'Gaming topics to prioritise',
    noun: 'topic',
    placeholder: 'Nintendo, PC, esports…',
    blurb: 'Steer Gaming headlines toward platforms and scenes you follow. Earlier picks rank higher.',
    emptyHint: 'No gaming topics prioritised yet — release, industry, and review stories for now.',
    suggestions: [
      'Nintendo',
      'PlayStation',
      'Xbox',
      'PC',
      'Esports',
      'RPG',
      'Indie',
      'Mobile',
      'Steam',
    ],
  },
  {
    key: 'business',
    label: 'Markets & finance to prioritise',
    noun: 'market',
    placeholder: 'ASX, Nasdaq, crypto…',
    blurb: 'Track exchanges and finance beats you care about — for example only ASX stocks news. Earlier picks rank higher.',
    emptyHint: 'No markets prioritised yet — general Business headlines for now.',
    suggestions: [
      'ASX',
      'NYSE',
      'Nasdaq',
      'FTSE',
      'Nikkei',
      'Crypto',
      'Startups',
      'IPOs',
      'Reserve Bank',
      'Wall Street',
    ],
  },
];

export const SPORT_NEWS_SUGGESTIONS =
  NEWS_TOPIC_PRIORITY_CONFIGS.find((config) => config.key === 'sport')!.suggestions;

export type NewsTopicPriorities = Record<string, string[]>;

export type OverviewPlace = {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
};

export type WeatherKind = 'clear' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export type WeatherSnapshot = {
  temperature: number;
  code: number;
  label: string;
  kind: WeatherKind;
  wind: number | null;
  humidity: number | null;
};

export type WeatherHour = {
  time: string;
  temperature: number;
  code: number;
  label: string;
  kind: WeatherKind;
  rainChance: number | null;
};

export type WeatherDay = {
  date: string;
  code: number;
  label: string;
  kind: WeatherKind;
  high: number;
  low: number;
  rainChance: number | null;
  hours: WeatherHour[];
};

export type WeatherReport = {
  place: string | null;
  timezone: string | null;
  current: WeatherSnapshot;
  days: WeatherDay[];
};

export type NewsHeadline = {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
};

export type NewsSection = {
  interest: string;
  headlines: NewsHeadline[];
  error?: string;
};

const WIDGET_SET = new Set<string>(OVERVIEW_WIDGETS);
const LEGACY_INTERESTS: Record<string, string> = {
  top: 'Top stories',
  australia: 'Australia',
  world: 'World',
  business: 'Business',
  finance: 'Business',
  technology: 'Technology',
  science: 'Science',
  health: 'Health',
  sport: 'Sport',
  culture: 'Culture',
};

const TOPIC_PRIORITY_BY_KEY = new Map(
  NEWS_TOPIC_PRIORITY_CONFIGS.map((config) => [config.key, config] as const),
);

export function isOverviewWidget(value: string): value is OverviewWidget {
  return WIDGET_SET.has(value);
}

export function normalizeNewsInterest(value: string): string | null {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  const legacy = LEGACY_INTERESTS[cleaned.toLowerCase()];
  const interest = legacy ?? cleaned;
  if (interest.length < 2 || interest.length > 40) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 +&'./-]*$/.test(interest)) return null;
  return interest;
}

export function normalizeNewsInterests(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const interest = normalizeNewsInterest(value);
    if (!interest) continue;
    const key = interest.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(interest);
    if (out.length >= NEWS_INTEREST_LIMIT) break;
  }
  return out;
}

export function newsTopicPriorityConfig(interest: string): NewsTopicPriorityConfig | null {
  return TOPIC_PRIORITY_BY_KEY.get(interest.toLowerCase()) ?? null;
}

export function topicPriorityConfigsForInterests(
  interests: readonly string[],
): NewsTopicPriorityConfig[] {
  const seen = new Set<string>();
  const out: NewsTopicPriorityConfig[] = [];
  for (const interest of interests) {
    const config = newsTopicPriorityConfig(interest);
    if (!config || seen.has(config.key)) continue;
    seen.add(config.key);
    out.push(config);
  }
  return out;
}

function topicCanon(config: NewsTopicPriorityConfig): Map<string, string> {
  return new Map(config.suggestions.map((item) => [item.toLowerCase(), item] as const));
}

export function normalizeTopicPriority(topicKey: string, value: string): string | null {
  const config = TOPIC_PRIORITY_BY_KEY.get(topicKey.toLowerCase());
  if (!config) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2 || cleaned.length > 40) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 +&'./-]*$/.test(cleaned)) return null;
  return topicCanon(config).get(cleaned.toLowerCase()) ?? cleaned;
}

export function normalizeTopicPriorities(topicKey: string, values: readonly string[]): string[] {
  const config = TOPIC_PRIORITY_BY_KEY.get(topicKey.toLowerCase());
  if (!config) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const item = normalizeTopicPriority(config.key, value);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= NEWS_TOPIC_PRIORITY_LIMIT) break;
  }
  return out;
}

export function normalizeNewsTopicPriorities(
  interests: readonly string[],
  value: unknown,
): NewsTopicPriorities {
  const active = new Set(topicPriorityConfigsForInterests(interests).map((config) => config.key));
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out: NewsTopicPriorities = {};
  for (const key of active) {
    const list = raw[key];
    const normalized = normalizeTopicPriorities(
      key,
      Array.isArray(list) ? list.map(String) : [],
    );
    if (normalized.length > 0) out[key] = normalized;
  }
  return out;
}

/** @deprecated Use normalizeTopicPriority('sport', value) */
export function normalizeSportPriority(value: string): string | null {
  return normalizeTopicPriority('sport', value);
}

/** @deprecated Use normalizeTopicPriorities('sport', values) */
export function normalizeSportPriorities(values: readonly string[]): string[] {
  return normalizeTopicPriorities('sport', values);
}

/** @deprecated Use newsTopicPriorityConfig / topicPriorityConfigsForInterests */
export function hasSportNewsInterest(interests: readonly string[]): boolean {
  return interests.some((interest) => interest.toLowerCase() === 'sport');
}

export function normalizeOverviewWidgets(values: readonly string[]): OverviewWidget[] {
  const out: OverviewWidget[] = [];
  for (const value of values) {
    if (isOverviewWidget(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

export function weatherKind(code: number): WeatherKind {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloud';
}

export function weatherCodeLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Clear';
    case 1:
      return 'Mainly clear';
    case 2:
      return 'Partly cloudy';
    case 3:
      return 'Overcast';
    case 45:
    case 48:
      return 'Fog';
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return 'Drizzle';
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return 'Rain';
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return 'Snow';
    case 95:
    case 96:
    case 99:
      return 'Storm';
    default:
      return 'Cloudy';
  }
}
