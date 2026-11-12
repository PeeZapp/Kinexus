import { Platform } from 'react-native';

import type { EffortLevel, HevyLinkImportPreview, HevyLinkMatchedExercise } from '@kinexus/domain';

import { supabase } from '@/src/lib/supabase';

function configuredUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

export type TrainImportLinkExercise = {
  name: string;
  sourceName: string;
  match: 'matched' | 'likely' | 'missing';
  exerciseId: string | null;
  matchConfidence: number | null;
  candidates: Array<{ exerciseId: string; name: string; confidence: number }>;
  willCreateCustom: boolean;
  targetSets: number;
  targetReps: string;
  tracking?: HevyLinkMatchedExercise['tracking'];
  targetUnit?: HevyLinkMatchedExercise['targetUnit'];
  targetDurationSec?: number | null;
  targetDistanceKm?: number | null;
  targetEffort: EffortLevel | null;
  targetWeightKg: number | null;
  sets: Array<{
    reps: string | null;
    weightKg: number | null;
    durationSec: number | null;
    distanceM: number | null;
  }>;
};

export type TrainImportLinkResponse = {
  source: 'hevy';
  title: string;
  url: string;
  resolvedUrl: string;
  exercises: TrainImportLinkExercise[];
};

export function trainImportLinkToPreview(payload: TrainImportLinkResponse): HevyLinkImportPreview {
  return {
    title: payload.title,
    url: payload.resolvedUrl || payload.url,
    exercises: payload.exercises.map(
      (ex): HevyLinkMatchedExercise => ({
        name: ex.name,
        sourceName: ex.sourceName,
        exerciseId: ex.exerciseId,
        matchConfidence: ex.matchConfidence,
        candidates: ex.candidates.length > 0 ? ex.candidates : null,
        status: ex.match === 'likely' ? 'needsMatch' : 'ready',
        note:
          ex.match === 'matched'
            ? null
            : ex.match === 'likely'
              ? 'Needs confirmation'
              : 'Will be added to your exercises',
        sets: ex.sets.map((set) => ({
          reps: set.reps,
          weightKg: set.weightKg,
          durationSec: set.durationSec,
          distanceM: set.distanceM,
          rpe: null,
          setType: null,
        })),
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        tracking: ex.tracking,
        targetUnit: ex.targetUnit,
        targetDurationSec: ex.targetDurationSec ?? null,
        targetDistanceKm: ex.targetDistanceKm ?? null,
        targetWeightKg: ex.targetWeightKg,
        targetRpe: null,
        targetEffort: ex.targetEffort,
        matchStatus: ex.match,
        willCreateCustom: ex.willCreateCustom,
      }),
    ),
  };
}

export async function importWorkoutFromLink(url: string): Promise<TrainImportLinkResponse> {
  if (!configuredUrl() && Platform.OS !== 'web') {
    throw new Error('Train API is not configured. Set EXPO_PUBLIC_API_URL and run the API server.');
  }
  if (!supabase) throw new Error('Sign in required');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  let res: Response;
  try {
    res = await fetch(`${configuredUrl()}/train/import/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (err) {
    if (
      err instanceof TypeError ||
      (err instanceof Error && /failed to fetch|networkerror|econnrefused/i.test(err.message))
    ) {
      throw new Error('Could not reach the API. Restart with npm run dev so the API on port 5301 is running.');
    }
    throw err;
  }
  const payload = (await res.json().catch(() => ({}))) as TrainImportLinkResponse & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status})`);
  return payload;
}
