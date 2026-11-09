import {
  appendWorkoutSetCall,
  deleteWorkoutSetCall,
  deleteWorkoutSetsAtPositionCall,
  finishWorkoutSessionCall,
  linkWorkoutSessionCall,
  moveSessionExerciseCall,
  replaceSessionExerciseCall,
  rewriteSessionSetsCall,
  updateWorkoutSetCall,
  type SessionSetWrite,
} from '@kinexus/domain';

export type WorkoutSessionRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

async function callRpc(client: WorkoutSessionRpcClient, rpc: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await client.rpc(rpc, args);
  if (error) throw new Error(error.message);
}

export async function callAppendWorkoutSet(
  client: WorkoutSessionRpcClient,
  sessionId: string,
  sets: readonly SessionSetWrite[],
): Promise<void> {
  const call = appendWorkoutSetCall(sessionId, sets);
  await callRpc(client, call.rpc, call.args);
}

export async function callUpdateWorkoutSet(
  client: WorkoutSessionRpcClient,
  setId: string,
  patch: { weight?: string; reps?: string; done?: boolean },
): Promise<void> {
  const call = updateWorkoutSetCall(setId, patch);
  await callRpc(client, call.rpc, call.args);
}

export async function callDeleteWorkoutSet(client: WorkoutSessionRpcClient, setId: string): Promise<void> {
  const call = deleteWorkoutSetCall(setId);
  await callRpc(client, call.rpc, call.args);
}

export async function callDeleteWorkoutSetsAtPosition(
  client: WorkoutSessionRpcClient,
  sessionId: string,
  position: number,
): Promise<void> {
  const call = deleteWorkoutSetsAtPositionCall(sessionId, position);
  await callRpc(client, call.rpc, call.args);
}

export async function callMoveSessionExercise(
  client: WorkoutSessionRpcClient,
  sessionId: string,
  position: number,
  direction: -1 | 1,
): Promise<void> {
  const call = moveSessionExerciseCall(sessionId, position, direction);
  await callRpc(client, call.rpc, call.args);
}

export async function callReplaceSessionExercise(
  client: WorkoutSessionRpcClient,
  input: { sessionId: string; position: number; exerciseId: string; name: string; weight?: string },
): Promise<void> {
  const call = replaceSessionExerciseCall(input);
  await callRpc(client, call.rpc, call.args);
}

export async function callRewriteSessionSets(
  client: WorkoutSessionRpcClient,
  sessionId: string,
  sets: readonly SessionSetWrite[],
): Promise<void> {
  const call = rewriteSessionSetsCall(sessionId, sets);
  await callRpc(client, call.rpc, call.args);
}

export async function callLinkWorkoutSession(
  client: WorkoutSessionRpcClient,
  sessionId: string,
  workoutId: string,
  name: string,
): Promise<void> {
  const call = linkWorkoutSessionCall(sessionId, workoutId, name);
  await callRpc(client, call.rpc, call.args);
}

export async function callFinishWorkoutSession(
  client: WorkoutSessionRpcClient,
  sessionId: string,
): Promise<void> {
  const call = finishWorkoutSessionCall(sessionId);
  await callRpc(client, call.rpc, call.args);
}
