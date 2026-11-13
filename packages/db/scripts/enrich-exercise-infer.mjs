/**
 * Rules-only exercise catalogue enrichment.
 * Vocabulary locked to values already present in the seeded catalog.
 */

export const BODY_PARTS = new Set([
  'legs',
  'back',
  'shoulders',
  'core',
  'chest',
  'triceps',
  'biceps',
  'forearms',
  'cardio',
  'neck',
  'other',
]);

/** Legacy spellings → canonical catalogue values (Part 1 cleanup). */
export const EQUIPMENT_SYNONYMS = {
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

export function canonicalizeEquipment(value) {
  const raw = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!raw) return '';
  const mapped = EQUIPMENT_SYNONYMS[raw.toLowerCase()];
  return mapped ?? raw;
}

export const EQUIPMENT = new Set([
  '',
  'dumbbell',
  'bodyweight',
  'barbell',
  'cable',
  'other',
  'leverage machine',
  'resistance band',
  'machine',
  'smith machine',
  'kettlebell',
  'weighted',
  'medicine ball',
  'stability ball',
  'EZ bar',
  'assisted',
  'sled machine',
  'foam roll',
  'rope',
  'bosu ball',
  'ab wheel',
  'upper body ergometer',
  'ski ergometer',
  'hammer',
  'stationary bike',
  'tire',
  'trap bar',
  'elliptical machine',
  'stepmill machine',
]);

export const TARGET_MUSCLES = new Set([
  '',
  'abdominals',
  'triceps',
  'biceps',
  'quadriceps',
  'glutes',
  'pectorals',
  'deltoids',
  'hamstrings',
  'shoulders',
  'upper back',
  'latissimus dorsi',
  'calves',
  'forearms',
  'chest',
  'cardiovascular system',
  'lats',
  'lower back',
  'middle back',
  'erector spinae',
  'adductors',
  'abductors',
  'trapezius',
  'traps',
  'neck',
  'serratus anterior',
  'levator scapulae',
]);

export const REMIX_CATEGORIES = new Set([
  'Chest',
  'Triceps',
  'Back',
  'Biceps',
  'Legs',
  'Glutes',
  'Shoulders',
  'Core',
  'Cardio',
  'Full Body',
  'Plyometrics',
  'Mobility',
]);

const PHRASES = [
  [/abdominal rollers?/g, 'abwheel'],
  [/ab rollers?/g, 'abwheel'],
  [/abdominal wheels?/g, 'abwheel'],
  [/ab wheels?/g, 'abwheel'],
  [/exercise balls?/g, 'stabilityball'],
  [/swiss balls?/g, 'stabilityball'],
  [/stability balls?/g, 'stabilityball'],
  [/ez bars?/g, 'ezbar'],
  [/smith machines?/g, 'smith'],
  [/romanian deadlifts?/g, 'romaniandeadlift'],
  [/\brdls?\b/g, 'romaniandeadlift'],
  [/pull ?ups?/g, 'pullup'],
  [/chin ?ups?/g, 'chinup'],
  [/press ?ups?/g, 'pushup'],
  [/push ?ups?/g, 'pushup'],
  [/close grips?/g, 'closegrip'],
  [/narrow grips?/g, 'closegrip'],
  [/wide grips?/g, 'widegrip'],
  [/underhands?/g, 'undergrip'],
  [/single arms?/g, 'singlearm'],
  [/one arms?/g, 'singlearm'],
  [/single legs?/g, 'singleleg'],
  [/one legs?/g, 'singleleg'],
  [/one handed/g, 'singlearm'],
  [/two handed/g, ''],
  [/2 handed/g, ''],
  [/bent over/g, 'bentover'],
  [/pull ?downs?/g, 'pulldown'],
  [/push ?downs?/g, 'pushdown'],
];

const TOKEN_MAP = {
  dumbbells: 'dumbbell',
  dumbell: 'dumbbell',
  db: 'dumbbell',
  barbells: 'barbell',
  kettlebells: 'kettlebell',
  kb: 'kettlebell',
  crunches: 'crunch',
  curls: 'curl',
  raises: 'raise',
  flys: 'fly',
  flies: 'fly',
  alternating: 'alternate',
  presses: 'press',
  rows: 'row',
  squats: 'squat',
  deadlifts: 'deadlift',
};

const NOISE = new Set(
  'a an the with using on for to of and or in at from into your medium normal standard regular basic traditional classic style hd version exercise movement proper strict flat full grip hands hand two both'.split(
    ' ',
  ),
);

/** Same phrase/token normalisation as build-exercise-catalog.mjs. */
export function canon(name) {
  let s = String(name)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
  for (const [re, to] of PHRASES) s = s.replace(re, ` ${to} `);
  const tokens = [];
  for (const raw of s.split(/\s+/)) {
    if (!raw || NOISE.has(raw)) continue;
    const token = TOKEN_MAP[raw] || raw;
    if (!NOISE.has(token) && !tokens.includes(token)) tokens.push(token);
  }
  return tokens.sort().join(' ');
}

/** Lighter normalize aligned with match-exercise (strip equipment words). */
export function normalizeExerciseName(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(barbell|dumbbell|cable|machine|smith|ez|kettlebell|band|bodyweight)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isBodyPartGap(value) {
  const v = (value ?? '').trim().toLowerCase();
  return !v || v === 'other';
}

export function isEmptyField(value) {
  return !(value ?? '').trim();
}

export function isCompleteRow(row) {
  return !isBodyPartGap(row.bodyPart) && !isEmptyField(row.equipment) && !isEmptyField(row.targetMuscle);
}

const EQUIPMENT_RULES = [
  [/\bsmith(\s+machine)?\b/i, 'smith machine'],
  [/\b(sz[\s-]*bars?|e-?z(\s*|-)?bar|ez(\s+)?bar|e-z curl bar)\b/i, 'EZ bar'],
  [/\b(olympic\s+)?barbells?\b/i, 'barbell'],
  [/\btrap\s+bar\b/i, 'trap bar'],
  [/\bdumbbells?\b|\bdumbells?\b/i, 'dumbbell'],
  [/\bkettlebells?\b/i, 'kettlebell'],
  [/\bcables?\b|\bpulleys?\b/i, 'cable'],
  [/\bleverage\s+machine\b/i, 'leverage machine'],
  [/\bsled(\s+machine)?\b/i, 'sled machine'],
  [/\bmachine\b/i, 'machine'],
  [/\b(lat\s+)?pulldowns?\b|\bpushdowns?\b/i, 'cable'],
  [/\b(resistance\s+)?bands?\b|\bloop\s+band\b/i, 'resistance band'],
  [/\bmedicine\s+balls?\b|\bmed\s+balls?\b/i, 'medicine ball'],
  [/\b(stability|swiss|exercise)\s+balls?\b/i, 'stability ball'],
  [/\bbosu\b/i, 'bosu ball'],
  [/\b(ab\s*wheel|abwheel|ab\s*roller)\b/i, 'ab wheel'],
  [/\bblackroll\b|\bfoam\s+roll/i, 'foam roll'],
  [/\bbattle\s+ropes?\b/i, 'rope'],
  [/\btrx\b|\bsuspension(\s+trainer)?\b/i, 'other'],
  [/\b(boxing|punching|heavy\s+bag|speed\s+bag|bag\s+training)\b/i, 'other'],
  [/\b(bodyweight|body\s*weight|body\s+only)\b/i, 'bodyweight'],
  [/\b(pull-?up\s+bar|chin-?up)\b/i, 'bodyweight'],
];

/** Ordered: first confident body/target hit wins. */
const MOVEMENT_RULES = [
  {
    id: 'mobility',
    test: /\b(stretch(?:es|ing)?|mobility|yoga|foam\s*roll|thoracic|90\s*\/\s*90|mobilize)\b/i,
    bodyPart: null,
    targetMuscle: null,
    category: 'Mobility',
    compound: false,
  },
  {
    id: 'plyo',
    test: /\b(plyometrics?|plyo|burpees?|bounding|bounds?)\b/i,
    bodyPart: 'cardio',
    targetMuscle: 'cardiovascular system',
    category: 'Plyometrics',
    compound: true,
  },
  {
    id: 'full_body',
    test: /\b(full\s+body|thrusters?|snatches?|clean\s+and|man\s+makers?|turkish\s+get-?ups?)\b/i,
    bodyPart: null,
    targetMuscle: null,
    category: 'Full Body',
    compound: true,
  },
  {
    id: 'cardio',
    test: /\b(sprint|bike|cardio|jump\s+rope|treadmill|elliptical|stair|rowing|rower|swim|assault|fan\s+bike|ski\s*erg|run|jog)\b/i,
    bodyPart: 'cardio',
    targetMuscle: 'cardiovascular system',
    category: 'Cardio',
    compound: false,
  },
  {
    id: 'calf',
    test: /\b(calf|calves|gastroc)\b/i,
    bodyPart: 'legs',
    targetMuscle: 'calves',
    category: 'Legs',
    compound: false,
  },
  {
    id: 'glute',
    test: /\b(glutes?|hip\s+thrust|donkey\s+kick|glute\s+kickbacks?)\b/i,
    bodyPart: 'legs',
    targetMuscle: 'glutes',
    category: 'Glutes',
    compound: true,
  },
  {
    id: 'rdl_deadlift',
    test: /\b(romanian\s+deadlift|romaniandeadlift|\brdls?\b|deadlifts?|good\s+mornings?)\b/i,
    bodyPart: 'legs',
    targetMuscle: 'hamstrings',
    category: 'Legs',
    compound: true,
  },
  {
    id: 'hamstring_curl',
    test: /\b(leg\s+curl|hamstring\s+curl|hamstrings?)\b/i,
    bodyPart: 'legs',
    targetMuscle: 'hamstrings',
    category: 'Legs',
    compound: false,
  },
  {
    id: 'squat_lunge',
    test: /\b(squats?|lunges?|leg\s+press|split\s+squat|step-?ups?|bulgarian)\b/i,
    bodyPart: 'legs',
    targetMuscle: 'quadriceps',
    category: 'Legs',
    compound: true,
  },
  {
    id: 'quad_ext',
    test: /\b(leg\s+extension|quad)\b/i,
    bodyPart: 'legs',
    targetMuscle: 'quadriceps',
    category: 'Legs',
    compound: false,
  },
  {
    id: 'adduct',
    test: /\b(adduct)/i,
    bodyPart: 'legs',
    targetMuscle: 'adductors',
    category: 'Legs',
    compound: false,
  },
  {
    id: 'abduct',
    test: /\b(abduct)/i,
    bodyPart: 'legs',
    targetMuscle: 'abductors',
    category: 'Legs',
    compound: false,
  },
  {
    id: 'chest',
    test: /\b(bench|chest|pec(?:toral)?s?|flye?s?|push-?ups?|pushups?)\b/i,
    bodyPart: 'chest',
    targetMuscle: 'pectorals',
    category: 'Chest',
    compound: true,
  },
  {
    id: 'back_pull',
    test: /\b(pulldowns?|pull-?ups?|chin-?ups?|latissimus|\blats?\b|lat\s+pulldown)\b/i,
    bodyPart: 'back',
    targetMuscle: 'latissimus dorsi',
    category: 'Back',
    compound: true,
  },
  {
    id: 'back_row',
    test: /\b(rows?|bentover|face\s+pulls?|pull\s+aparts?|shrugs?)\b/i,
    bodyPart: 'back',
    targetMuscle: 'upper back',
    category: 'Back',
    compound: true,
  },
  {
    id: 'lower_back',
    test: /\b(hyperextension|back\s+extension|superman)\b/i,
    bodyPart: 'back',
    targetMuscle: 'lower back',
    category: 'Back',
    compound: false,
  },
  {
    id: 'shoulder',
    test: /\b(shoulder|lateral\s+raise|front\s+raise|rear\s+delt|overhead\s+press|military\s+press|arnold|landmine\s+press|delt)\b/i,
    bodyPart: 'shoulders',
    targetMuscle: 'deltoids',
    category: 'Shoulders',
    compound: true,
  },
  {
    id: 'biceps',
    test: /\b(bicep|curls?)\b/i,
    // exclude leg curl already handled; still guard
    neg: /\b(leg\s+curl|hamstring)\b/i,
    bodyPart: 'biceps',
    targetMuscle: 'biceps',
    category: 'Biceps',
    compound: false,
  },
  {
    id: 'triceps',
    test: /\b(tricep|pushdowns?|push-?downs?|skull\s*crushers?|close-?grip|dip(?:s)?\b|kickbacks?)\b/i,
    bodyPart: 'triceps',
    targetMuscle: 'triceps',
    category: 'Triceps',
    compound: false,
  },
  {
    id: 'core',
    test: /\b(crunch|plank|sit-?ups?|oblique|abdominal|abs\b|twist|russian\s+twist|leg\s+raise|vacuum)\b/i,
    bodyPart: 'core',
    targetMuscle: 'abdominals',
    category: 'Core',
    compound: false,
  },
  {
    id: 'forearm',
    test: /\b(forearm|wrist\s+(curl|roll)|grip\s+crush)\b/i,
    bodyPart: 'forearms',
    targetMuscle: 'forearms',
    category: null,
    compound: false,
  },
  {
    id: 'neck',
    test: /\b\bneck\b/i,
    bodyPart: 'neck',
    targetMuscle: 'neck',
    category: null,
    compound: false,
  },
  {
    id: 'press_generic',
    test: /\bpress(es)?\b/i,
    bodyPart: 'chest',
    targetMuscle: 'pectorals',
    category: 'Chest',
    compound: true,
  },
];

const COMPOUND_NAME =
  /\b(squat|deadlift|bench|press|row|pull-?up|chin-?up|clean|snatch|lunge|hip\s+thrust|rdl|overhead|thruster|pulldown|dip)\b/i;

const ISOLATION_NAME =
  /\b(curl|extension|raise|flye?s?|pushdown|kickback|shrug|calf|crunch|plank|stretch)\b/i;

function inferEquipmentFromText(text) {
  for (const [re, value] of EQUIPMENT_RULES) {
    if (re.test(text) && EQUIPMENT.has(value)) return value;
  }
  // Clear bodyweight patterns only — leave squat/deadlift/lunge unset when no implement is named
  if (
    /\b(push-?ups?|pull-?ups?|chin-?ups?|planks?|crunch(?:es)?|sit-?ups?|burpees?|dips?)\b/i.test(text) &&
    !/\b(barbell|dumbbell|cable|machine|kettlebell|band|smith|ez|weighted)\b/i.test(text)
  ) {
    return 'bodyweight';
  }
  return null;
}

function inferMovementFromText(text) {
  for (const rule of MOVEMENT_RULES) {
    if (!rule.test.test(text)) continue;
    if (rule.neg && rule.neg.test(text)) continue;
    return rule;
  }
  return null;
}

/**
 * Infer gap fields for one exercise.
 * @param {{ name: string, bodyPart?: string, equipment?: string, targetMuscle?: string, instructions?: string[]|string, category?: string|null, isCompound?: boolean|null }} row
 * @param {{ completeByCanon?: Map<string, object>, completeByNorm?: Map<string, object> }} indexes
 */
export function inferExerciseEnrichment(row, indexes = {}) {
  const name = row.name ?? '';
  const instructionsText = Array.isArray(row.instructions)
    ? row.instructions.join(' ')
    : String(row.instructions ?? '');

  const patch = {};
  const sources = {};

  const needBody = isBodyPartGap(row.bodyPart);
  const needEquip = isEmptyField(row.equipment);
  const needTarget = isEmptyField(row.targetMuscle);
  const needCategory = row.category == null || row.category === '';
  const needCompound = row.isCompound == null;

  if (!needBody && !needEquip && !needTarget && !needCategory && !needCompound) {
    return { patch, sources, changed: false };
  }

  // a) Same-exercise match via canon / soft normalize
  const key = canon(name);
  const peer =
    (key && indexes.completeByCanon?.get(key)) ||
    indexes.completeByNorm?.get(normalizeExerciseName(name)) ||
    null;

  if (peer && peer.id !== row.id) {
    if (needBody && !isBodyPartGap(peer.bodyPart)) {
      patch.bodyPart = peer.bodyPart;
      sources.bodyPart = 'same_exercise';
    }
    if (needEquip && !isEmptyField(peer.equipment)) {
      patch.equipment = peer.equipment;
      sources.equipment = 'same_exercise';
    }
    if (needTarget && !isEmptyField(peer.targetMuscle)) {
      patch.targetMuscle = peer.targetMuscle;
      sources.targetMuscle = 'same_exercise';
    }
  }

  // b) Keyword rules from name
  applyKeywordPass(name, patch, sources, {
    needBody: needBody && patch.bodyPart == null,
    needEquip: needEquip && patch.equipment == null,
    needTarget: needTarget && patch.targetMuscle == null,
    needCategory: needCategory && patch.category == null,
    ruleSource: 'keyword_name',
  });

  // c) Instructions as last resort
  if (instructionsText.trim()) {
    applyKeywordPass(instructionsText, patch, sources, {
      needBody: needBody && patch.bodyPart == null,
      needEquip: needEquip && patch.equipment == null,
      needTarget: needTarget && patch.targetMuscle == null,
      needCategory: needCategory && patch.category == null,
      ruleSource: 'keyword_instructions',
    });
  }

  // Category from filled fields / name (remixCategoryOf-compatible)
  if (needCategory && patch.category == null) {
    const category = deriveCategory({
      name,
      bodyPart: patch.bodyPart ?? row.bodyPart,
      targetMuscle: patch.targetMuscle ?? row.targetMuscle,
      category: null,
    });
    if (category) {
      patch.category = category;
      sources.category = sources.category || 'derived_category';
    }
  }

  // is_compound
  if (needCompound) {
    const compound = deriveCompound(name, patch.category ?? deriveCategory({
      name,
      bodyPart: patch.bodyPart ?? row.bodyPart,
      targetMuscle: patch.targetMuscle ?? row.targetMuscle,
    }));
    if (compound != null) {
      patch.isCompound = compound;
      sources.isCompound = 'compound_rule';
    }
  }

  // Canonicalise equipment synonyms, then drop values outside vocabulary
  if (patch.equipment != null) {
    patch.equipment = canonicalizeEquipment(patch.equipment);
    if (!EQUIPMENT.has(patch.equipment)) delete patch.equipment;
  }
  if (patch.bodyPart != null && !BODY_PARTS.has(patch.bodyPart)) delete patch.bodyPart;
  if (patch.targetMuscle != null && !TARGET_MUSCLES.has(patch.targetMuscle)) delete patch.targetMuscle;
  if (patch.category != null && !REMIX_CATEGORIES.has(patch.category)) delete patch.category;

  return { patch, sources, changed: Object.keys(patch).length > 0 };
}

function applyKeywordPass(text, patch, sources, opts) {
  if (opts.needEquip) {
    const eq = inferEquipmentFromText(text);
    if (eq) {
      patch.equipment = eq;
      sources.equipment = opts.ruleSource;
    }
  }

  const movement = inferMovementFromText(text);
  if (!movement) return;

  if (opts.needBody && movement.bodyPart && BODY_PARTS.has(movement.bodyPart)) {
    patch.bodyPart = movement.bodyPart;
    sources.bodyPart = opts.ruleSource;
  }
  if (opts.needTarget && movement.targetMuscle && TARGET_MUSCLES.has(movement.targetMuscle)) {
    patch.targetMuscle = movement.targetMuscle;
    sources.targetMuscle = opts.ruleSource;
  }
  if (opts.needCategory && movement.category && REMIX_CATEGORIES.has(movement.category)) {
    patch.category = movement.category;
    sources.category = opts.ruleSource;
  }
}

const BODY_PART_CATEGORY = {
  chest: 'Chest',
  triceps: 'Triceps',
  back: 'Back',
  biceps: 'Biceps',
  shoulders: 'Shoulders',
  core: 'Core',
  cardio: 'Cardio',
};

export function deriveCategory(exercise) {
  if (exercise.category && REMIX_CATEGORIES.has(exercise.category)) return exercise.category;
  const target = (exercise.targetMuscle ?? '').trim().toLowerCase();
  if (target === 'glutes') return 'Glutes';
  if (exercise.bodyPart === 'legs') return 'Legs';
  const mapped = BODY_PART_CATEGORY[exercise.bodyPart];
  if (mapped) return mapped;
  if (exercise.bodyPart && exercise.bodyPart !== 'other' && exercise.bodyPart !== '') return null;

  if (/\b(stretch|mobility|yoga|breathing|foam|thoracic|90\/90)\b/i.test(exercise.name)) return 'Mobility';
  if (/\b(plyometrics?|plyo|jumps?|jumping|burpees?|bounding|bounds?|hops?)\b/i.test(exercise.name)) {
    return 'Plyometrics';
  }
  if (/\bfull body\b|\bthrusters?\b|\bsnatches?\b|\bclean and\b|\bman makers?\b|\bturkish get-?up\b/i.test(exercise.name)) {
    return 'Full Body';
  }

  const untagged = [
    [/\b(glute|hip thrust)\b/i, 'Glutes'],
    [/\b(squat|lunge|hamstring|quad|calf|leg press)\b/i, 'Legs'],
    [/\b(tricep|push-?down|pushdown|skull crusher|kickback)\b/i, 'Triceps'],
    [/\b(bicep|curl|chin-?up)\b/i, 'Biceps'],
    [/\b(chest|bench|flye?s?|push-?up)\b/i, 'Chest'],
    [/\b(shoulder|lateral raise|rear delt|overhead press|military press|landmine)\b/i, 'Shoulders'],
    [/\b(pulldowns?|pull-?ups?|rows?|deadlifts?|latissimus|lats?)\b/i, 'Back'],
    [/\b(crunch|plank|sit-?up|oblique|abdominal)\b/i, 'Core'],
    [
      /\b(sprint|bike|cardio|jump rope|treadmill|elliptical|stair|row(ing|er)?|swim|assault|fan bike|ski erg)\b/i,
      'Cardio',
    ],
  ];
  for (const [pattern, category] of untagged) {
    if (pattern.test(exercise.name)) return category;
  }
  return null;
}

export function deriveCompound(name, category) {
  if (COMPOUND_NAME.test(name)) return true;
  if (ISOLATION_NAME.test(name) && !COMPOUND_NAME.test(name)) return false;
  if (category === 'Full Body' || category === 'Plyometrics') return true;
  if (category === 'Mobility' || category === 'Cardio' || category === 'Core') return false;
  if (category === 'Legs' || category === 'Back' || category === 'Chest') {
    if (/\b(press|row|squat|deadlift|pull)\b/i.test(name)) return true;
  }
  // Low confidence → leave unset
  return null;
}

/** Build indexes of complete rows for same-exercise matching. */
export function buildCompleteIndexes(rows) {
  const completeByCanon = new Map();
  const completeByNorm = new Map();
  // Prefer exercisedb > public_domain > wger when multiple completes share a key
  const priority = { exercisedb: 0, public_domain: 1, wger: 2 };
  const ranked = [...rows].filter(isCompleteRow).sort((a, b) => {
    return (priority[a.source] ?? 9) - (priority[b.source] ?? 9);
  });
  for (const row of ranked) {
    const c = canon(row.name);
    if (c && !completeByCanon.has(c)) completeByCanon.set(c, row);
    const n = normalizeExerciseName(row.name);
    if (n && !completeByNorm.has(n)) completeByNorm.set(n, row);
  }
  return { completeByCanon, completeByNorm };
}
