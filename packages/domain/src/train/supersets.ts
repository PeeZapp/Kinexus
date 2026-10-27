export type SupersetMember = {
  supersetId: string | null;
};

export type ExerciseCluster = {
  type: 'single' | 'superset';
  indices: number[];
};

/** Group consecutive exercises that share a superset id. A lone id stays a single. */
export function clusterExercises<T extends SupersetMember>(exercises: readonly T[]): ExerciseCluster[] {
  const clusters: ExerciseCluster[] = [];
  let index = 0;
  while (index < exercises.length) {
    const supersetId = exercises[index]?.supersetId;
    if (supersetId) {
      const indices = [index];
      let next = index + 1;
      while (next < exercises.length && exercises[next]?.supersetId === supersetId) {
        indices.push(next);
        next += 1;
      }
      if (indices.length > 1) {
        clusters.push({ type: 'superset', indices });
        index = next;
        continue;
      }
    }
    clusters.push({ type: 'single', indices: [index] });
    index += 1;
  }
  return clusters;
}

/** Drop a superset id that no longer has a partner. */
export function normalizeSupersets<T extends SupersetMember>(exercises: readonly T[]): T[] {
  const counts = new Map<string, number>();
  for (const exercise of exercises) {
    if (!exercise.supersetId) continue;
    counts.set(exercise.supersetId, (counts.get(exercise.supersetId) ?? 0) + 1);
  }
  return exercises.map((exercise) =>
    exercise.supersetId && (counts.get(exercise.supersetId) ?? 0) < 2 ? { ...exercise, supersetId: null } : { ...exercise },
  );
}

/** Move the target onto the source's superset, directly after that group. */
export function linkSuperset<T extends SupersetMember>(
  exercises: readonly T[],
  sourceIndex: number,
  targetIndex: number,
  nextId: () => string,
): T[] {
  const source = exercises[sourceIndex];
  const target = exercises[targetIndex];
  if (!source || !target || sourceIndex === targetIndex) return exercises.map((exercise) => ({ ...exercise }));
  if (source.supersetId && source.supersetId === target.supersetId) return exercises.map((exercise) => ({ ...exercise }));

  const groupId = source.supersetId ?? nextId();
  let next = exercises.map((exercise) => ({ ...exercise }));
  const previousGroup = next[targetIndex]?.supersetId;
  if (previousGroup && previousGroup !== groupId) {
    next[targetIndex] = { ...next[targetIndex]!, supersetId: null };
    if (next.filter((exercise) => exercise.supersetId === previousGroup).length < 2) {
      next = next.map((exercise) => (exercise.supersetId === previousGroup ? { ...exercise, supersetId: null } : exercise));
    }
  }

  const moved = { ...next[targetIndex]!, supersetId: groupId };
  const rest = next.filter((_, index) => index !== targetIndex);
  const sourceAt = targetIndex < sourceIndex ? sourceIndex - 1 : sourceIndex;
  rest[sourceAt] = { ...rest[sourceAt]!, supersetId: groupId };
  let insertAt = sourceAt + 1;
  while (insertAt < rest.length && rest[insertAt]?.supersetId === groupId) insertAt += 1;
  rest.splice(insertAt, 0, moved);
  return normalizeSupersets(rest);
}

/** Break every exercise out of the superset that contains this one. */
export function unlinkSuperset<T extends SupersetMember>(exercises: readonly T[], index: number): T[] {
  const supersetId = exercises[index]?.supersetId;
  if (!supersetId) return exercises.map((exercise) => ({ ...exercise }));
  return exercises.map((exercise) => (exercise.supersetId === supersetId ? { ...exercise, supersetId: null } : { ...exercise }));
}
