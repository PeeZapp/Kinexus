import { Platform } from 'react-native';
import type { NewsSection, OverviewPlace, WeatherReport, WordleRound } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

export type PlaceSuggestion = OverviewPlace & {
  id: number;
  country: string | null;
};

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export function isOverviewApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!isOverviewApiConfigured()) {
    throw new Error('Today’s feeds need the API. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  let res: Response;
  try {
    res = await fetch(`${configuredUrl()}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && /failed to fetch|networkerror|econnrefused/i.test(err.message))) {
      throw new Error('Could not reach Today’s feeds. Restart with npm run dev so the API on port 5301 is running.');
    }
    throw err;
  }
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}

export async function searchOverviewPlaces(input: {
  query?: string;
  latitude?: number;
  longitude?: number;
}): Promise<PlaceSuggestion[]> {
  const payload = await post<{ places?: PlaceSuggestion[] }>('/overview/places', input);
  return payload.places ?? [];
}

export async function fetchOverviewWeather(place: OverviewPlace): Promise<WeatherReport> {
  const payload = await post<{ weather?: WeatherReport }>('/overview/weather', {
    latitude: place.latitude,
    longitude: place.longitude,
  });
  if (!payload.weather) throw new Error('Weather is unavailable right now.');
  return { ...payload.weather, place: place.label };
}

export async function fetchOverviewNews(
  interests: string[],
  topicPriorities: Record<string, string[]> = {},
): Promise<NewsSection[]> {
  const payload = await post<{ sections?: NewsSection[] }>('/overview/news', {
    interests,
    topicPriorities,
  });
  return payload.sections ?? [];
}

export async function scoreWordle(date: string, guesses: string[]): Promise<WordleRound> {
  return post<WordleRound>('/overview/wordle', { date, guesses });
}
