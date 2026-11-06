import {
  applyImportRows,
  toStoredKg,
  type ImportApplySummary,
  type ImportPlan,
  type ImportRow,
  type KinexusListKind,
  type WeightUnit,
  type WorkoutImportRoutine,
  type WorkoutImportSession,
} from '@kinexus/domain';

export type ListImportTarget =
  | { mode: 'new'; name: string }
  | { mode: 'existing'; listId: string; name: string };

export type WorkoutExportWriters = {
  createRoutine: (routine: WorkoutImportRoutine) => Promise<string>;
  /** Resolve an existing routine id by name for history linking. */
  findRoutineId?: (name: string) => Promise<string | null>;
  createHistorySession?: (session: WorkoutImportSession, workoutId: string | null) => Promise<void>;
};

export type ListImportWriters = {
  ensureTargetList: (target: ListImportTarget) => Promise<string | null>;
  writeRow: (listId: string | null, row: ImportRow) => Promise<void>;
  /** Hevy/Strong multi-routine import. */
  workoutExport?: WorkoutExportWriters;
};

export async function runListImport(opts: {
  kind: KinexusListKind;
  rows: readonly ImportRow[];
  target: ListImportTarget;
  writers: ListImportWriters;
  signal: { cancelled: boolean };
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportApplySummary> {
  const listId = await opts.writers.ensureTargetList(opts.target);
  return applyImportRows(
    opts.rows,
    (row) => opts.writers.writeRow(listId, row),
    { signal: opts.signal, onProgress: opts.onProgress },
  );
}

export async function runWorkoutExportImport(opts: {
  plan: ImportPlan;
  writers: WorkoutExportWriters;
  signal: { cancelled: boolean };
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportApplySummary> {
  const routines = (opts.plan.workoutRoutines ?? []).filter((routine) => routine.status === 'ready');
  const sessions = opts.plan.importHistory
    ? (opts.plan.workoutSessions ?? []).filter((session) => session.status === 'ready')
    : [];
  const total = routines.length + sessions.length;
  let imported = 0;
  let skippedDuplicate =
    (opts.plan.workoutRoutines ?? []).filter((routine) => routine.status === 'duplicate').length +
    (opts.plan.importHistory
      ? (opts.plan.workoutSessions ?? []).filter((session) => session.status === 'duplicate').length
      : 0);
  const skippedNeedsMatch = (opts.plan.workoutRoutines ?? [])
    .filter((routine) => routine.status === 'ready')
    .flatMap((routine) => routine.exercises)
    .filter((exercise) => exercise.status === 'needsMatch').length;
  const skippedInvalid = (opts.plan.workoutRoutines ?? []).filter((routine) => routine.status === 'invalid').length;

  const workoutIdByName = new Map<string, string>();

  for (const routine of routines) {
    if (opts.signal.cancelled) {
      return {
        imported,
        skippedDuplicate,
        skippedNeedsMatch,
        skippedInvalid: skippedInvalid + (total - imported),
        cancelled: true,
      };
    }
    const id = await opts.writers.createRoutine(routine);
    workoutIdByName.set(routine.name.trim().toLowerCase(), id);
    imported += 1;
    opts.onProgress?.(imported, total);
  }

  if (opts.writers.createHistorySession) {
    for (const session of sessions) {
      if (opts.signal.cancelled) {
        return {
          imported,
          skippedDuplicate,
          skippedNeedsMatch,
          skippedInvalid: skippedInvalid + (total - imported),
          cancelled: true,
        };
      }
      const key = session.name.trim().toLowerCase();
      let workoutId = workoutIdByName.get(key) ?? null;
      if (!workoutId && opts.writers.findRoutineId) {
        workoutId = await opts.writers.findRoutineId(session.name);
        if (workoutId) workoutIdByName.set(key, workoutId);
      }
      await opts.writers.createHistorySession(session, workoutId);
      imported += 1;
      opts.onProgress?.(imported, total);
    }
  }

  return {
    imported,
    skippedDuplicate,
    skippedNeedsMatch,
    skippedInvalid,
    cancelled: false,
  };
}

export function workoutWeightToKg(value: number | null, unit: WeightUnit): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return toStoredKg(value, unit);
}

export function isWorkoutExportPlan(plan: ImportPlan | null | undefined): boolean {
  return plan?.format === 'hevy-csv' || plan?.format === 'strong-csv';
}
