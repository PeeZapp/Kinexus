import { remixCategoryOf, type RemixCategory } from './remix';
import { clusterExercises } from './supersets';

const WORK_SEC = 45;
const REST_SEC = 75;
const BODY_KG = 70;

const MET: Record<RemixCategory, number> = {
  Chest: 6,
  Triceps: 5,
  Back: 6,
  Biceps: 5,
  Legs: 7,
  Glutes: 6,
  Shoulders: 5,
  Core: 4,
  Cardio: 8,
  'Full Body': 7,
  Plyometrics: 8,
  Mobility: 3,
};

export type EstimateExercise = {
  name: string;
  category?: RemixCategory | null;
  targetSets: number;
  supersetId?: string | null;
};

export type WorkoutEstimate = {
  minutes: number;
  calories: number;
  focuses: RemixCategory[];
};

/** Seconds of work plus one rest per set. A superset rests once per round. */
export function estimateWorkout(exercises: readonly EstimateExercise[]): WorkoutEstimate {
  if (exercises.length === 0) return { minutes: 0, calories: 0, focuses: [] };

  const prepared = exercises.map((exercise) => ({
    ...exercise,
    supersetId: exercise.supersetId ?? null,
    category: exercise.category ?? remixCategoryOf({ id: '', name: exercise.name, bodyPart: '', equipment: '', targetMuscle: '' }),
    sets: Math.max(1, exercise.targetSets || 1),
  }));

  let seconds = 0;
  let metSeconds = 0;
  for (const cluster of clusterExercises(prepared)) {
    const members = cluster.indices.map((index) => prepared[index]).filter((exercise) => exercise !== undefined);
    if (members.length === 0) continue;
    const rounds = Math.max(...members.map((exercise) => exercise.sets));
    const clusterSeconds = cluster.type === 'superset' ? rounds * (members.length * WORK_SEC + REST_SEC) : rounds * (WORK_SEC + REST_SEC);
    seconds += clusterSeconds;
    const met = members.reduce((total, exercise) => total + (exercise.category ? MET[exercise.category] : 6), 0) / members.length;
    metSeconds += clusterSeconds * met;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  const kcal = (metSeconds / 3600) * BODY_KG;
  const calories = Math.max(10, Math.round(kcal / 10) * 10);
  const focuses: RemixCategory[] = [];
  for (const exercise of prepared) {
    if (exercise.category && !focuses.includes(exercise.category)) focuses.push(exercise.category);
  }
  return { minutes, calories, focuses };
}
