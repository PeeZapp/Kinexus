import {
  archiveExerciseCall,
  planSharedWorkoutExerciseCopy,
  promoteExercisePatch,
  publishGlobalExerciseCall,
  type PromoteExerciseTarget,
  type ShareCopyExerciseRow,
  type ShareCopyPlanItem,
  type ShareCopyWorkoutExercise,
} from '@kinexus/domain';

export type CustomExerciseRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export type CustomExerciseTableClient = {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): Promise<{ error: { message: string } | null }>;
    };
    insert(values: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function callArchiveExercise(
  client: CustomExerciseRpcClient,
  exerciseId: string,
): Promise<string> {
  const call = archiveExerciseCall(exerciseId);
  const { data, error } = await client.rpc(call.rpc, call.args);
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : 'hidden';
}

export async function callPublishGlobalExercise(
  client: CustomExerciseRpcClient,
  exerciseId: string,
): Promise<string> {
  const call = publishGlobalExerciseCall(exerciseId);
  const { data, error } = await client.rpc(call.rpc, call.args);
  if (error) throw new Error(error.message);
  if (typeof data !== 'string' || !data) throw new Error('Publish failed');
  return data;
}

export async function callPromoteExercise(
  client: CustomExerciseTableClient,
  exerciseId: string,
  target: PromoteExerciseTarget,
): Promise<void> {
  const patch = promoteExercisePatch(target);
  const { error } = await client.from('exercises').update(patch).eq('id', exerciseId);
  if (error) throw new Error(error.message);
}

export type ResolvedShareCopyExercise = {
  exerciseId: string | null;
  name: string;
  copiedFromId?: string;
  needsReplacement?: boolean;
};

/**
 * Apply the share-copy plan: keep ids, mark replacements, or deep-copy source rows
 * into the recipient’s private scope via `copyRow`.
 */
export async function resolveSharedWorkoutExercises(opts: {
  exercises: readonly ShareCopyWorkoutExercise[];
  byId: ReadonlyMap<string, ShareCopyExerciseRow>;
  recipientUserId: string;
  recipientHouseholdId: string | null;
  copyRow: (sourceId: string) => Promise<{ id: string; name: string }>;
}): Promise<{ exercises: ResolvedShareCopyExercise[]; plan: ShareCopyPlanItem[] }> {
  const plan = planSharedWorkoutExerciseCopy({
    exercises: opts.exercises,
    byId: opts.byId,
    recipientUserId: opts.recipientUserId,
    recipientHouseholdId: opts.recipientHouseholdId,
  });

  const exercises: ResolvedShareCopyExercise[] = [];
  for (const item of plan) {
    if (item.kind === 'keep') {
      exercises.push({ exerciseId: item.exerciseId, name: item.name });
      continue;
    }
    if (item.kind === 'replace') {
      exercises.push({
        exerciseId: null,
        name: item.name,
        needsReplacement: true,
      });
      continue;
    }
    const copied = await opts.copyRow(item.sourceExerciseId);
    exercises.push({
      exerciseId: copied.id,
      name: copied.name,
      copiedFromId: item.sourceExerciseId,
    });
  }
  return { exercises, plan };
}

export { planSharedWorkoutExerciseCopy, promoteExercisePatch, archiveExerciseCall, publishGlobalExerciseCall };
