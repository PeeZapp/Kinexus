/** Catalogue equipment synonyms → canonical spellings used in public.exercises.equipment. */
export const EXERCISE_EQUIPMENT_SYNONYMS: Readonly<Record<string, string>> = {
  'body only': 'bodyweight',
  'body weight': 'bodyweight',
  kettlebells: 'kettlebell',
  bands: 'resistance band',
  'e-z curl bar': 'EZ bar',
  'ez barbell': 'EZ bar',
  'sz-bar': 'EZ bar',
  'sz bar': 'EZ bar',
  'olympic barbell': 'barbell',
  'exercise ball': 'stability ball',
  roller: 'foam roll',
};

/** Normalize catalogue equipment for compare / display filters. */
export function normalizeExerciseEquipment(value: string | null | undefined): string {
  const raw = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!raw) return '';
  const mapped = EXERCISE_EQUIPMENT_SYNONYMS[raw.toLowerCase()];
  return (mapped ?? raw).toLowerCase();
}

/** True when catalogue equipment matches an allowed preference token. */
export function exerciseEquipmentMatches(
  catalogueEquipment: string | null | undefined,
  allowed: ReadonlySet<string> | readonly string[],
): boolean {
  const allowedSet =
    allowed instanceof Set
      ? allowed
      : new Set([...allowed].map((item) => normalizeExerciseEquipment(item)).filter(Boolean));
  if (allowedSet.size === 0) return true;

  const eq = normalizeExerciseEquipment(catalogueEquipment);
  if (!eq || eq === 'bodyweight') {
    return (
      allowedSet.has('bodyweight') ||
      allowedSet.has('body weight') ||
      allowedSet.has('body only') ||
      allowedSet.has(eq)
    );
  }
  if (allowedSet.has(eq)) return true;
  for (const token of allowedSet) {
    if (!token) continue;
    if (eq.includes(token) || token.includes(eq)) return true;
  }
  return false;
}
