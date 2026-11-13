/**
 * Rules-only global exercise catalogue cleanup (equipment synonyms + gap/mismatch fixes).
 * Shared by catalogue-cleanup.mjs and tests. No AI / paid APIs.
 */

import {
  buildCompleteIndexes,
  canon,
  canonicalizeEquipment,
  deriveCategory,
  EQUIPMENT_SYNONYMS,
  isEmptyField,
  normalizeExerciseName,
  REMIX_CATEGORIES,
} from './enrich-exercise-infer.mjs';

export { EQUIPMENT_SYNONYMS, canonicalizeEquipment };

/** Old spellings that Part 1 collapses (every key must map via EQUIPMENT_SYNONYMS). */
export const EQUIPMENT_SYNONYM_OLD_SPELLINGS = Object.keys(EQUIPMENT_SYNONYMS);

/** Kit / implement words that mean a movement is not bodyweight-by-default. */
export const KIT_IN_NAME =
  /\b(dumbbells?|dumbells?|db|kettlebells?|kb|barbells?|cables?|pulleys?|smith|machines?|bands?|resistance|ez[\s-]*bar|e-z|sz[\s-]*bar|trx|suspension|medicine\s+ball|med\s+ball|battle\s+ropes?|blackroll|foam|roller|sled|weighted|assisted|leverage|rope|bag|boxing|punching)\b/i;

/** Ordered name → equipment cues (first hit wins). */
export const NAME_EQUIPMENT_CUES = [
  [/\bdumbbells?\b|\bdumbells?\b|\bdb\b/i, 'dumbbell'],
  [/\bkettlebells?\b|\bkb\b/i, 'kettlebell'],
  [/\b(olympic\s+)?barbells?\b/i, 'barbell'],
  [/\bcables?\b|\bpulleys?\b/i, 'cable'],
  [/\bsmith(\s+machine)?\b/i, 'smith machine'],
  [/\bsz[\s-]*bars?\b|\be-?z(\s*|-)?bars?\b|\be-z curl bar\b/i, 'EZ bar'],
  [/\bmedicine\s+balls?\b|\bmed\s+balls?\b/i, 'medicine ball'],
  [/\bsled(\s+machine)?\b/i, 'sled machine'],
  [/\bblackroll\b|\bfoam\s*rolls?\b|\bfoam\s+roller\b/i, 'foam roll'],
  [/\bbattle\s+ropes?\b/i, 'rope'],
  [/\btrx\b|\bsuspension(\s+trainer)?\b/i, 'other'],
  [/\b(boxing|punching|heavy\s+bag|speed\s+bag|\bbag\s+training\b|\bbag\b)/i, 'other'],
  [/\b(resistance\s+)?bands?\b|\bloop\s+band\b/i, 'resistance band'],
  [/\bmachine\b/i, 'machine'],
  // Non-medicine ball → stability ball (medicine ball already matched above)
  [/\bballs?\b/i, 'stability ball'],
];

/**
 * No-kit bodyweight patterns (only used when equipment is empty and no kit word in name).
 * Covers circles, rotations, raises, lunges/squats without kit, crawls, bounds, etc.
 */
export const BODYWEIGHT_EMPTY_NAME =
  /\b(stretch(?:es|ing)?|mobility|yoga|hold|plank|bridges?|crunch(?:es)?|sit-?ups?|push-?ups?|pull-?ups?|chin-?ups?|deadhang|hang|balance|wall[- ]?sit|tibialis|airplane|happy\s+baby|chin\s+tuck|leg\s+swings?|foam\s+roll|breathing|mobilize|thoracic|circles?|rotations?|raises?|lunges?|squats?|bird\s*dogs?|bear\s+crawls?|crawls?|bounds?|hops?|skips?|walk(?:ing)?|march(?:ing)?|abduction|adduction|arabesque|iron\s+cross|drills?|poses?|draw-?in|stabilization|rocks?|rocking|switches?)\b/i;

/** Ordered: first confident category keyword wins (null-category fill). */
export const CATEGORY_KEYWORDS = [
  // Arm/shoulder motion before bare "circle" mobility.
  [/\b(shoulder|lateral\s+raise|overhead\s+press|delt|arm\s+circles?|arm\s+raises?|shoulder\s+rotations?)\b/i, 'Shoulders'],
  [/\b(stretch(?:es|ing)?|mobility|yoga|foam\s*roll|swing|hip\s+circles?|thoracic|mobilize|breathing|poses?)\b/i, 'Mobility'],
  [/\b(plank|crunch(?:es)?|sit-?ups?|dead\s*bug|hollow|ab\s*wheel|russian\s+twist|leg\s+raise|draw-?in|bird\s*dogs?)\b/i, 'Core'],
  [/\b(jump|bounds?|hops?|plyo|burpee)\b/i, 'Plyometrics'],
  // Legs before Cardio so "Walking Lunge" hits lunge, not walk.
  [/\b(ankle|foot|squats?|lunges?|calf|leg|knee|tibialis|wall[- ]?sit|deadlift|rdl|adduct|abduct)\b/i, 'Legs'],
  [/\b(glute|hip\s+thrust|hip\s+airplane|donkey\s+kick|arabesque)\b/i, 'Glutes'],
  [/\b(run|jog|row\s*erg|rower|rowing|bike|swim|walk|skips?|cardio|treadmill|elliptical|march)\b/i, 'Cardio'],
  [/\b(triceps?|pushdown|skull)\b/i, 'Triceps'],
  [/\b(biceps?|curl)\b/i, 'Biceps'],
  [/\b(row|pull-?up|chin-?up|pulldown|deadhang|lat)\b/i, 'Back'],
  [/\b(bench|chest|flye?s?|push-?up|press)\b/i, 'Chest'],
  [/\b(thruster|snatch|clean\s+and|full\s+body|turkish)\b/i, 'Full Body'],
];

/**
 * Obvious name → category contradictions.
 * Only overwrite when current category is in `onlyFrom` (clearly wrong).
 * Listed in the cleanup report when applied.
 */
export const CATEGORY_CONTRADICTIONS = [
  {
    test: /\bankle\b|\bfoot\b/i,
    category: 'Legs',
    onlyFrom: ['Chest'],
    neg: /\b(mobility|stretch|smr|foam|roll)\b/i,
  },
  { test: /\blateral\s+raises?\b/i, category: 'Shoulders', onlyFrom: ['Chest', 'Core'] },
  {
    test: /\barm\s+circles?\b|\bshoulder\s+rotations?\b/i,
    category: 'Shoulders',
    onlyFrom: ['Chest', 'Core', 'Legs'],
  },
  {
    test: /\bbiceps?\b/i,
    category: 'Biceps',
    onlyFrom: ['Core', 'Chest'],
    neg: /\b(stretch|pull-?up|femoris)\b/i,
  },
  {
    test: /\btriceps?\b/i,
    category: 'Triceps',
    onlyFrom: ['Core', 'Chest'],
    neg: /\bstretch\b/i,
  },
  { test: /\bcrunches?\b/i, category: 'Core', onlyFrom: ['Chest', 'Shoulders'] },
  {
    test: /\brows?\b/i,
    category: 'Back',
    onlyFrom: ['Chest', 'Legs'],
    neg: /\b(rower|rowing|row\s*erg)\b/i,
  },
  {
    test: /\b(chest\s+press|bench\s+press|flye?s?)\b/i,
    category: 'Chest',
    onlyFrom: ['Back', 'Shoulders', 'Legs', 'Core'],
  },
];

/** Id-keyed Part 2 fixes (equipment and/or category). */
export const SPECIFIC_FIXES_BY_ID = {
  'ccb11f8f-cffd-5aad-92f3-ef32627970ad': {
    name: 'Dumbbell Thruster',
    equipment: 'dumbbell',
    fromEquipment: 'barbell',
  },
  '38682338-636e-5bc1-93c9-db3308f13501': {
    name: 'Dumbbell Hip Thrust',
    equipment: 'dumbbell',
    fromEquipment: 'barbell',
  },
  'a3cb0465-037f-57a8-bfad-f5d344954508': {
    name: 'dumbbell snatch',
    equipment: 'dumbbell',
    fromEquipment: 'barbell',
    category: 'Full Body',
    fromCategory: 'Legs',
  },
  '05c6c65b-45a9-5a20-9191-c3f87ce8326f': {
    name: 'Foam Roll IT Band',
    equipment: 'foam roll',
    fromEquipment: 'resistance band',
  },
  '442f4562-4b86-5358-b3ec-18c3a8a17aaf': {
    name: 'Chair Squat',
    equipment: 'bodyweight',
    fromEquipment: 'machine',
  },
  '5535eaf4-5d4b-59cd-9dee-d934a4b966ab': {
    name: 'Chin tuck',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Mobility',
    fromCategory: null,
  },
  'f67850ca-be8e-5f5f-83c9-972a3f905f8a': {
    name: 'Crossbody Leg Swings',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Mobility',
    fromCategory: null,
  },
  'cf378d80-02f3-5b09-8fe3-fa0d3fa4efcf': {
    name: 'Deadhang',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Back',
    fromCategory: null,
  },
  'b0f90777-fe60-5b00-9d75-11defcad109d': {
    name: 'Happy Baby',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Mobility',
    fromCategory: null,
  },
  'a8533ca2-2904-5003-9edb-9d3f979ec87c': {
    name: 'Hip Airplane',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Glutes',
    fromCategory: null,
  },
  'ec129057-8d21-56aa-8860-7240e11e9fdf': {
    name: 'Single-Leg Balance with Eyes Closed',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Legs',
    fromCategory: null,
  },
  'f9e3937f-653c-510e-909b-aa83eca828c6': {
    name: 'Tibialis raises',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Legs',
    fromCategory: null,
  },
  '2f0e2d20-b04e-5059-876b-22539b364a6b': {
    name: 'Wall-sit',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Legs',
    fromCategory: null,
  },
};

/** Name-keyed Part 2 fixes (migration uses WHERE name = … AND scope = 'global'). */
export const SPECIFIC_FIXES_BY_NAME = [
  {
    name: 'Dumbbell close grip bench press',
    equipment: 'dumbbell',
    fromEquipment: 'barbell',
  },
  {
    name: 'Dumbbell Front Squat',
    equipment: 'dumbbell',
    fromEquipment: 'barbell',
  },
  {
    name: 'Dumbbell sumo deadlift',
    equipment: 'dumbbell',
    fromEquipment: 'barbell',
  },
  {
    name: 'kettlebell sumo deadlift',
    equipment: 'kettlebell',
    fromEquipment: 'barbell',
  },
  {
    name: 'Dumbbell Crunches',
    equipment: 'dumbbell',
    fromEquipment: 'body only',
  },
  {
    name: 'Dumbbell Push-Up',
    equipment: 'dumbbell',
    fromEquipment: 'bodyweight',
  },
  {
    name: 'Cable Triceps Press',
    equipment: 'cable',
    fromEquipment: 'bodyweight',
  },
];

/**
 * Round-3 rescues: formerly-hidden good rows → category + equipment by exact name.
 * Applied before the both-gaps → status=hidden pass. Rest (for timed workouts) stays hidden.
 */
export const RESCUE_OVERRIDES_BY_NAME = [
  // Bodyweight / Core
  { name: 'L-sit', equipment: 'bodyweight', fromEquipment: '', category: 'Core', fromCategory: null },
  { name: 'Straddle L-Sit', equipment: 'bodyweight', fromEquipment: '', category: 'Core', fromCategory: null },
  { name: 'Dragon-flag', equipment: 'bodyweight', fromEquipment: '', category: 'Core', fromCategory: null },
  {
    name: 'Roll-overs into V-sits',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Core',
    fromCategory: null,
  },
  {
    name: 'Sit Up Elbow Thrust',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Core',
    fromCategory: null,
  },
  { name: 'Toe Taps', equipment: 'bodyweight', fromEquipment: '', category: 'Core', fromCategory: null },
  { name: 'Roll Down', equipment: 'bodyweight', fromEquipment: '', category: 'Core', fromCategory: null },
  // Bodyweight / Shoulders
  { name: 'Pike Push Ups', equipment: 'bodyweight', fromEquipment: '', category: 'Shoulders', fromCategory: null },
  { name: 'Tuck planche', equipment: 'bodyweight', fromEquipment: '', category: 'Shoulders', fromCategory: null },
  { name: 'elbow lever', equipment: 'bodyweight', fromEquipment: '', category: 'Shoulders', fromCategory: null },
  {
    name: 'Reverse Snow Angel',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Shoulders',
    fromCategory: null,
  },
  // Bodyweight / Chest
  { name: 'Vpushup', equipment: 'bodyweight', fromEquipment: '', category: 'Chest', fromCategory: null },
  // Bodyweight / Mobility
  { name: 'Cat-Cow', equipment: 'bodyweight', fromEquipment: '', category: 'Mobility', fromCategory: null },
  { name: 'Pelvic Tilts', equipment: 'bodyweight', fromEquipment: '', category: 'Mobility', fromCategory: null },
  { name: 'Head turns', equipment: 'bodyweight', fromEquipment: '', category: 'Mobility', fromCategory: null },
  { name: 'Head tilts', equipment: 'bodyweight', fromEquipment: '', category: 'Mobility', fromCategory: null },
  { name: 'Sit & Reach', equipment: 'bodyweight', fromEquipment: '', category: 'Mobility', fromCategory: null },
  {
    name: 'Standing Pancake',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Mobility',
    fromCategory: null,
  },
  {
    name: 'Gentle Upward-Facing Dog / Cobra',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Mobility',
    fromCategory: null,
  },
  { name: 'Pelvic Wave', equipment: 'bodyweight', fromEquipment: '', category: 'Mobility', fromCategory: null },
  {
    name: 'Lower Back Extensions',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Mobility',
    fromCategory: null,
  },
  // Bodyweight / Glutes
  {
    name: 'Clamshell to Reverse Clamshell',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Glutes',
    fromCategory: null,
  },
  // Bodyweight / Cardio
  { name: 'Jogging', equipment: 'bodyweight', fromEquipment: '', category: 'Cardio', fromCategory: null },
  {
    name: 'Skipping - Standard',
    equipment: 'bodyweight',
    fromEquipment: '',
    category: 'Cardio',
    fromCategory: null,
  },
  { name: 'Bronco', equipment: 'bodyweight', fromEquipment: '', category: 'Cardio', fromCategory: null },
  { name: 'punches', equipment: 'bodyweight', fromEquipment: '', category: 'Cardio', fromCategory: null },
  // other / Cardio (leave Schwimmen name as-is — migration does not rename)
  {
    name: 'Swimming 50m sprints',
    equipment: 'other',
    fromEquipment: '',
    category: 'Cardio',
    fromCategory: null,
  },
  { name: 'Schwimmen', equipment: 'other', fromEquipment: '', category: 'Cardio', fromCategory: null },
  // other / Back
  {
    name: 'Fingerboard 20 mm edge',
    equipment: 'other',
    fromEquipment: '',
    category: 'Back',
    fromCategory: null,
  },
  { name: 'Sloper hanging', equipment: 'other', fromEquipment: '', category: 'Back', fromCategory: null },
  // Cycling → Cardio + stationary bike
  {
    name: 'Cycling',
    equipment: 'stationary bike',
    fromEquipment: '',
    category: 'Cardio',
    fromCategory: null,
  },
];

/** All name-keyed overrides (Part 2 + rescues) for migration WHERE name = …. */
export const ALL_NAME_FIXES = [...SPECIFIC_FIXES_BY_NAME, ...RESCUE_OVERRIDES_BY_NAME];

const BODY_PART_CATEGORY = {
  chest: 'Chest',
  triceps: 'Triceps',
  back: 'Back',
  biceps: 'Biceps',
  shoulders: 'Shoulders',
  core: 'Core',
  cardio: 'Cardio',
  legs: 'Legs',
  neck: 'Mobility',
};

/**
 * Equipment implied by the exercise name, or null when no clear cue.
 * @param {string} name
 */
export function equipmentFromName(name) {
  const text = String(name ?? '');
  for (const [re, value] of NAME_EQUIPMENT_CUES) {
    if (re.test(text)) return value;
  }
  // Bench press with no kit word → barbell
  if (/\bbench\s+press\b/i.test(text)) {
    const withoutBench = text.replace(/\bbench\s+press\b/gi, ' ');
    if (!KIT_IN_NAME.test(withoutBench)) return 'barbell';
  }
  return null;
}

/**
 * True when current equipment clearly contradicts the name cue.
 * @param {string} name
 * @param {string} equipment
 */
export function nameEquipmentMismatch(name, equipment) {
  const expected = equipmentFromName(name);
  if (!expected) return null;
  const current = canonicalizeEquipment(equipment);
  if (!current) return null;
  if (current === expected) return null;
  // Foam-roll / band names: "Foam Roll IT Band" contains "band" but is foam roll.
  if (/\bfoam\s*roll|\bblackroll\b/i.test(name) && expected === 'resistance band') return null;
  return expected;
}

/**
 * @param {string|null|undefined} category
 */
function isNullCategory(category) {
  return category == null || category === '';
}

/**
 * Infer category from keywords / body / target without overwriting.
 * @param {{ name: string, bodyPart?: string, targetMuscle?: string, category?: string|null }} row
 */
export function inferCategoryGap(row) {
  if (!isNullCategory(row.category)) return null;
  for (const [re, category] of CATEGORY_KEYWORDS) {
    if (re.test(row.name) && REMIX_CATEGORIES.has(category)) return category;
  }
  const target = (row.targetMuscle ?? '').trim().toLowerCase();
  if (target === 'glutes') return 'Glutes';
  if (target === 'abdominals' || target === 'abs') return 'Core';
  if (target === 'biceps') return 'Biceps';
  if (target === 'triceps') return 'Triceps';
  if (target === 'pectorals' || target === 'chest') return 'Chest';
  if (target === 'deltoids' || target === 'shoulders') return 'Shoulders';
  if (target === 'quadriceps' || target === 'hamstrings' || target === 'calves') return 'Legs';
  if (target === 'latissimus dorsi' || target === 'lats' || target === 'upper back' || target === 'lower back') {
    return 'Back';
  }
  const body = (row.bodyPart ?? '').trim().toLowerCase();
  if (body === 'legs' && target !== 'glutes') return 'Legs';
  if (BODY_PART_CATEGORY[body] && REMIX_CATEGORIES.has(BODY_PART_CATEGORY[body])) {
    return BODY_PART_CATEGORY[body];
  }
  const derived = deriveCategory({
    name: row.name,
    bodyPart: row.bodyPart,
    targetMuscle: row.targetMuscle,
    category: null,
  });
  return derived && REMIX_CATEGORIES.has(derived) ? derived : null;
}

/**
 * Obvious category contradiction from name (current category must already be set and wrong).
 * @param {{ name: string, category?: string|null }} row
 * @returns {{ category: string, fromCategory: string } | null}
 */
export function inferCategoryContradiction(row) {
  if (isNullCategory(row.category)) return null;
  const current = row.category;
  for (const rule of CATEGORY_CONTRADICTIONS) {
    if (!rule.test.test(row.name)) continue;
    if (rule.neg && rule.neg.test(row.name)) continue;
    if (!REMIX_CATEGORIES.has(rule.category)) continue;
    if (rule.category === current) continue;
    if (rule.onlyFrom && !rule.onlyFrom.includes(current)) continue;
    return { category: rule.category, fromCategory: current };
  }
  return null;
}

/**
 * @param {{ name: string, equipment?: string, category?: string|null }} row
 */
export function inferEmptyEquipment(row, indexes = {}) {
  if (!isEmptyField(row.equipment)) return null;

  const key = canon(row.name);
  const peer =
    (key && indexes.equipByCanon?.get(key)) ||
    indexes.equipByNorm?.get(normalizeExerciseName(row.name)) ||
    null;
  if (peer && !isEmptyField(peer.equipment)) {
    const eq = canonicalizeEquipment(peer.equipment);
    if (eq) return { equipment: eq, rule: 'empty_equipment_peer' };
  }

  const fromName = equipmentFromName(row.name);
  if (fromName) return { equipment: fromName, rule: 'empty_equipment_name' };

  // No-kit bodyweight: Mobility category, or name patterns when no kit word present
  if (row.category === 'Mobility') {
    return { equipment: 'bodyweight', rule: 'empty_equipment_bodyweight' };
  }
  if (BODYWEIGHT_EMPTY_NAME.test(row.name) && !KIT_IN_NAME.test(row.name)) {
    return { equipment: 'bodyweight', rule: 'empty_equipment_bodyweight' };
  }
  return null;
}

/**
 * Build peer indexes for equipment / category copy.
 * @param {Array<{ id?: string, name: string, equipment?: string, category?: string|null, canonicalKey?: string|null }>} rows
 */
export function buildCleanupIndexes(rows) {
  const equipByCanon = new Map();
  const equipByNorm = new Map();
  const categoryByCanon = new Map();
  const categoryByNorm = new Map();
  const categoryByKey = new Map();

  for (const row of rows) {
    const eq = canonicalizeEquipment(row.equipment);
    const c = canon(row.name);
    const n = normalizeExerciseName(row.name);
    if (eq) {
      if (c && !equipByCanon.has(c)) equipByCanon.set(c, { ...row, equipment: eq });
      if (n && !equipByNorm.has(n)) equipByNorm.set(n, { ...row, equipment: eq });
    }
    if (!isNullCategory(row.category)) {
      if (c && !categoryByCanon.has(c)) categoryByCanon.set(c, row);
      if (n && !categoryByNorm.has(n)) categoryByNorm.set(n, row);
      const ck = (row.canonicalKey ?? '').trim();
      if (ck && !categoryByKey.has(ck)) categoryByKey.set(ck, row);
    }
  }
  return { equipByCanon, equipByNorm, categoryByCanon, categoryByNorm, categoryByKey };
}

/**
 * Apply one cleanup pass to a row. Returns patch + rule tags; never invents junk.
 * Guards: only propose a change when the current value still matches `from*`.
 *
 * @param {{ id?: string, name: string, equipment?: string, category?: string|null, bodyPart?: string, targetMuscle?: string, canonicalKey?: string|null }} row
 * @param {ReturnType<typeof buildCleanupIndexes>} indexes
 */
export function inferCatalogueCleanup(row, indexes = {}) {
  const patch = {};
  const from = {};
  const rules = [];

  const specific =
    (row.id && SPECIFIC_FIXES_BY_ID[row.id]) ||
    ALL_NAME_FIXES.find((f) => f.name.toLowerCase() === String(row.name ?? '').toLowerCase()) ||
    null;

  if (specific) {
    if (
      specific.equipment != null &&
      specific.fromEquipment != null &&
      String(row.equipment ?? '') === specific.fromEquipment
    ) {
      patch.equipment = specific.equipment;
      from.equipment = specific.fromEquipment;
      rules.push('specific_fix');
    }
    if (
      specific.category !== undefined &&
      Object.prototype.hasOwnProperty.call(specific, 'fromCategory') &&
      (row.category ?? null) === (specific.fromCategory ?? null)
    ) {
      patch.category = specific.category;
      from.category = specific.fromCategory ?? null;
      rules.push('specific_fix');
    }
  }

  // Part 1: synonym normalize (skip if specific already set equipment)
  if (patch.equipment == null) {
    const raw = String(row.equipment ?? '').trim();
    const canonical = canonicalizeEquipment(raw);
    if (raw && canonical && canonical !== raw) {
      patch.equipment = canonical;
      from.equipment = raw;
      rules.push('equipment_synonym');
    }
  }

  // Part 3: name/equipment mismatch (clear contradiction only)
  if (patch.equipment == null) {
    const expected = nameEquipmentMismatch(row.name, row.equipment);
    if (expected) {
      patch.equipment = expected;
      from.equipment = String(row.equipment ?? '');
      rules.push('name_equipment_mismatch');
    }
  }

  // Part 3: empty equipment
  if (patch.equipment == null && isEmptyField(row.equipment)) {
    const filled = inferEmptyEquipment(row, indexes);
    if (filled) {
      patch.equipment = filled.equipment;
      from.equipment = '';
      rules.push(filled.rule);
    }
  }

  // Category contradiction (existing wrong category)
  if (patch.category === undefined && !isNullCategory(row.category)) {
    const contradiction = inferCategoryContradiction(row);
    if (contradiction) {
      patch.category = contradiction.category;
      from.category = contradiction.fromCategory;
      rules.push('category_contradiction');
    }
  }

  // Part 3: null category
  if (patch.category === undefined && isNullCategory(row.category)) {
    const key = canon(row.name);
    const ck = (row.canonicalKey ?? '').trim();
    const peer =
      (ck && indexes.categoryByKey?.get(ck)) ||
      (key && indexes.categoryByCanon?.get(key)) ||
      indexes.categoryByNorm?.get(normalizeExerciseName(row.name)) ||
      null;
    if (peer && !isNullCategory(peer.category) && peer.id !== row.id) {
      patch.category = peer.category;
      from.category = null;
      rules.push('null_category_peer');
    } else {
      const inferred = inferCategoryGap(row);
      if (inferred) {
        patch.category = inferred;
        from.category = null;
        rules.push('null_category_keyword');
      }
    }
  }

  return {
    patch,
    from,
    rules: [...new Set(rules)],
    changed: Object.keys(patch).length > 0,
  };
}

/** Re-export helpers useful to the runner. */
export { buildCompleteIndexes, canon, isEmptyField };
