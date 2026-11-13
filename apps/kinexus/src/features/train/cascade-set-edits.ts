/** Apply a value patch to one set and every unfinished set below it in the same exercise. */

export type CascadeSetRow = {
  id: string;
  position: number;
  setIndex: number;
  done: boolean;
};

export function cascadeSetEdits<T extends CascadeSetRow>(
  sets: readonly T[],
  editedId: string,
  patch: Partial<T>,
): T[] {
  const edited = sets.find((set) => set.id === editedId);
  if (!edited) return [...sets];

  return sets.map((item) => {
    if (item.id === editedId) return { ...item, ...patch };
    if (item.done) return item;
    if (item.position !== edited.position) return item;
    if (item.setIndex <= edited.setIndex) return item;
    return { ...item, ...patch };
  });
}
