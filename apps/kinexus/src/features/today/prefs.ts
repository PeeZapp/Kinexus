import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizeNewsInterests,
  normalizeNewsTopicPriorities,
  normalizeOverviewWidgets,
  type NewsTopicPriorities,
  type OverviewPlace,
  type OverviewWidget,
} from '@kinexus/domain';

import type { AuthUser } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

export type OverviewPrefs = {
  widgets: OverviewWidget[];
  weather: OverviewPlace | null;
  newsInterests: string[];
  topicPriorities: NewsTopicPriorities;
};

export const EMPTY_OVERVIEW: OverviewPrefs = {
  widgets: ['puzzles'],
  weather: null,
  newsInterests: [],
  topicPriorities: {},
};

function storageKey(userId: string) {
  return `kinexus.userOverview.${userId}`;
}

function usesLocalStore(user: AuthUser) {
  return user.isDevBypass || !supabase;
}

function placeFrom(label: unknown, latitude: unknown, longitude: unknown, timezone: unknown): OverviewPlace | null {
  if (typeof label !== 'string' || !label.trim()) return null;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return {
    label: label.trim(),
    latitude,
    longitude,
    timezone: typeof timezone === 'string' && timezone ? timezone : null,
  };
}

function topicPrioritiesFromStored(row: Record<string, unknown>, interests: string[]): NewsTopicPriorities {
  if (row.topicPriorities && typeof row.topicPriorities === 'object' && !Array.isArray(row.topicPriorities)) {
    return normalizeNewsTopicPriorities(interests, row.topicPriorities);
  }
  if (Array.isArray(row.sportPriorities)) {
    return normalizeNewsTopicPriorities(interests, { sport: row.sportPriorities.map(String) });
  }
  return normalizeNewsTopicPriorities(interests, {});
}

function sanitizePrefs(prefs: OverviewPrefs): OverviewPrefs {
  const newsInterests = normalizeNewsInterests(prefs.newsInterests);
  return {
    widgets: normalizeOverviewWidgets(prefs.widgets),
    weather: prefs.weather,
    newsInterests,
    topicPriorities: normalizeNewsTopicPriorities(newsInterests, prefs.topicPriorities),
  };
}

function fromStored(value: unknown): OverviewPrefs {
  if (!value || typeof value !== 'object') return EMPTY_OVERVIEW;
  const row = value as Record<string, unknown>;
  const newsInterests = normalizeNewsInterests(
    Array.isArray(row.newsInterests)
      ? row.newsInterests.map(String)
      : Array.isArray(row.newsCategories)
        ? row.newsCategories.map(String)
        : [],
  );
  return sanitizePrefs({
    widgets: normalizeOverviewWidgets(Array.isArray(row.widgets) ? row.widgets.map(String) : []),
    newsInterests,
    topicPriorities: topicPrioritiesFromStored(row, newsInterests),
    weather: placeFrom(row.weatherLabel, row.weatherLatitude, row.weatherLongitude, row.weatherTimezone),
  });
}

function explain(error: { message?: string; code?: string }): Error {
  const message = error.message ?? 'Could not load your overview.';
  if (error.code === 'PGRST205' || /user_overview|schema cache/i.test(message)) {
    return new Error('Today needs the latest database migration before it can save your cards.');
  }
  return new Error(message);
}

function introducedKey(userId: string) {
  return `kinexus.puzzles.introduced.${userId}`;
}

async function withPuzzleDesk(user: AuthUser, prefs: OverviewPrefs): Promise<OverviewPrefs> {
  if (prefs.widgets.includes('puzzles')) {
    await AsyncStorage.setItem(introducedKey(user.id), '1');
    return prefs;
  }
  if (await AsyncStorage.getItem(introducedKey(user.id))) return prefs;
  const next: OverviewPrefs = { ...prefs, widgets: [...prefs.widgets, 'puzzles'] };
  try {
    await saveOverviewPrefs(user, next);
  } catch {
    return prefs;
  }
  await AsyncStorage.setItem(introducedKey(user.id), '1');
  return next;
}

export async function loadOverviewPrefs(user: AuthUser): Promise<OverviewPrefs> {
  if (usesLocalStore(user)) {
    const raw = await AsyncStorage.getItem(storageKey(user.id));
    if (!raw) return withPuzzleDesk(user, EMPTY_OVERVIEW);
    try {
      return withPuzzleDesk(user, fromStored(JSON.parse(raw)));
    } catch {
      return withPuzzleDesk(user, EMPTY_OVERVIEW);
    }
  }

  const { data, error } = await supabase!
    .from('user_overview')
    .select(
      'widgets, weather_label, weather_latitude, weather_longitude, weather_timezone, news_interests, news_topic_priorities, sport_priorities',
    )
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw explain(error);
  if (!data) return withPuzzleDesk(user, EMPTY_OVERVIEW);
  const newsInterests = normalizeNewsInterests(data.news_interests);
  const topicPriorities = normalizeNewsTopicPriorities(
    newsInterests,
    data.news_topic_priorities && Object.keys(data.news_topic_priorities).length > 0
      ? data.news_topic_priorities
      : { sport: data.sport_priorities ?? [] },
  );
  return withPuzzleDesk(
    user,
    sanitizePrefs({
      widgets: normalizeOverviewWidgets(data.widgets),
      newsInterests,
      topicPriorities,
      weather: placeFrom(data.weather_label, data.weather_latitude, data.weather_longitude, data.weather_timezone),
    }),
  );
}

export async function saveOverviewPrefs(user: AuthUser, prefs: OverviewPrefs): Promise<void> {
  const next = sanitizePrefs(prefs);
  if (usesLocalStore(user)) {
    await AsyncStorage.setItem(
      storageKey(user.id),
      JSON.stringify({
        widgets: next.widgets,
        newsInterests: next.newsInterests,
        topicPriorities: next.topicPriorities,
        weatherLabel: next.weather?.label ?? null,
        weatherLatitude: next.weather?.latitude ?? null,
        weatherLongitude: next.weather?.longitude ?? null,
        weatherTimezone: next.weather?.timezone ?? null,
      }),
    );
    return;
  }

  const { error } = await supabase!.from('user_overview').upsert(
    {
      user_id: user.id,
      widgets: next.widgets,
      news_interests: next.newsInterests,
      news_topic_priorities: next.topicPriorities,
      sport_priorities: next.topicPriorities.sport ?? [],
      weather_label: next.weather?.label ?? null,
      weather_latitude: next.weather?.latitude ?? null,
      weather_longitude: next.weather?.longitude ?? null,
      weather_timezone: next.weather?.timezone ?? null,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw explain(error);
}

let persistChain: Promise<void> = Promise.resolve();

/** Serializes overview writes so a news-topic save cannot overwrite a weather save still in flight. */
export function persistOverviewPrefs(
  user: AuthUser,
  update: (current: OverviewPrefs) => OverviewPrefs,
): Promise<OverviewPrefs> {
  const run = persistChain.catch(() => undefined).then(async () => {
    const current = await loadOverviewPrefs(user);
    const next = sanitizePrefs(update(current));
    await saveOverviewPrefs(user, next);
    return next;
  });
  persistChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
