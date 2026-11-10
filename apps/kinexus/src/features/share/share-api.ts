import { Platform } from 'react-native';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

function isApiConfigured(): boolean {
  if (configuredUrl()) return true;
  return Platform.OS === 'web';
}

async function getShared<T>(path: string): Promise<T> {
  if (!isApiConfigured()) {
    throw new Error('API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  const res = await fetch(`${configuredUrl()}${path}`);
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}

export type SharedWorkoutResponse = {
  name: string;
  durationMin: number | null;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    effort: string | null;
    rpe: number | null;
    note: string;
    supersetId: string | null;
    mediaUrls: string[];
  }>;
};

export type SharedWatchlistResponse = {
  name: string;
  ownerUsername: string | null;
  titles: Array<{
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    title: string;
    year: number | null;
    posterPath: string | null;
  }>;
};

export async function fetchSharedWorkout(token: string): Promise<SharedWorkoutResponse> {
  return getShared(`/train/shared/${encodeURIComponent(token.trim())}`);
}

export type SharedTrainingPlanResponse = {
  name: string;
  weekStart: string;
  days: Array<{
    day: string;
    restDay: boolean;
    focus: string[];
    durationMin: number | null;
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      effort: string | null;
      rpe: number | null;
      note: string;
      supersetId: string | null;
    }>;
  }>;
};

export async function fetchSharedTrainingPlan(token: string): Promise<SharedTrainingPlanResponse> {
  return getShared(`/train/shared-plan/${encodeURIComponent(token.trim())}`);
}

export async function fetchSharedWatchlist(token: string): Promise<SharedWatchlistResponse> {
  return getShared(`/watchlist/shared/${encodeURIComponent(token.trim())}`);
}

export type SharedReadlistResponse = {
  name: string;
  ownerUsername: string | null;
  books: Array<{
    workId: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    year: number | null;
    status: 'want_to_read' | 'reading' | 'finished';
  }>;
};

export async function fetchSharedReadlist(token: string): Promise<SharedReadlistResponse> {
  return getShared(`/readlist/shared/${encodeURIComponent(token.trim())}`);
}
