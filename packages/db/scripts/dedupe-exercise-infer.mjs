/**
 * Near-duplicate grouping + canonical selection for the exercise catalogue.
 * Builds on enrich-exercise-infer canon/phrase rules, then strips equipment /
 * filler / context body words so word-order and side/standing variants collapse
 * when equipment + target still agree.
 */

import { canon } from './enrich-exercise-infer.mjs';

const SOURCE_RANK = { exercisedb: 0, public_domain: 1, wger: 2 };

/** Extra fillers beyond enrich canon noise — not angles, grips, or equipment. */
const NEAR_FILLER = new Set(['side', 'standing']);

/**
 * Drop from the movement key; equipment is compared separately (field or name).
 * Do not include movement words like "hammer" (hammer curl).
 */
const EQUIPMENT_TOKENS = new Set(
  `
  dumbbell dumbbells barbell barbells kettlebell kettlebells cable cables
  machine machines smith band bands resistance leverage bodyweight
  bodyonly weighted olympic ez ezbar trap medicine stability bosu roller
  foam sled rope tire
  `
    .trim()
    .split(/\s+/),
);

/** Body adjectives safe to drop when they match row body/target (not leg/calf/glute identity). */
const BODY_CONTEXT = [
  { token: 'chest', hints: ['chest', 'pectoral', 'pectorals'] },
  { token: 'back', hints: ['back', 'lat', 'lats', 'latissimus'] },
  { token: 'shoulder', hints: ['shoulder', 'shoulders', 'delt', 'deltoid', 'deltoids'] },
  { token: 'shoulders', hints: ['shoulder', 'shoulders', 'delt', 'deltoid', 'deltoids'] },
  { token: 'arm', hints: ['arm', 'arms', 'bicep', 'tricep'] },
  { token: 'arms', hints: ['arm', 'arms', 'bicep', 'tricep'] },
  { token: 'tricep', hints: ['tricep', 'triceps'] },
  { token: 'triceps', hints: ['tricep', 'triceps'] },
  { token: 'bicep', hints: ['bicep', 'biceps'] },
  { token: 'biceps', hints: ['bicep', 'biceps'] },
  { token: 'ab', hints: ['ab', 'abs', 'core', 'waist', 'abdominal'] },
  { token: 'abs', hints: ['ab', 'abs', 'core', 'waist', 'abdominal'] },
  { token: 'core', hints: ['ab', 'abs', 'core', 'waist', 'abdominal'] },
];

const EQUIPMENT_ALIASES = {
  '': '',
  bodyweight: 'bodyweight',
  'body weight': 'bodyweight',
  'body only': 'bodyweight',
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  barbell: 'barbell',
  barbells: 'barbell',
  'olympic barbell': 'barbell',
  cable: 'cable',
  cables: 'cable',
  machine: 'machine',
  'leverage machine': 'machine',
  'smith machine': 'smith',
  smith: 'smith',
  kettlebell: 'kettlebell',
  kettlebells: 'kettlebell',
  'resistance band': 'band',
  bands: 'band',
  band: 'band',
  'ez bar': 'ezbar',
  'e-z curl bar': 'ezbar',
  'EZ bar': 'ezbar',
};

/** Angle / stance tokens that must never be treated as equal. */
const ANGLE_TOKENS = new Set(['incline', 'decline', 'flat']);

/** Extra singularisation beyond enrich TOKEN_MAP (dips, etc.). */
const NEAR_TOKEN_MAP = {
  dips: 'dip',
  flies: 'fly',
  flyes: 'fly',
  extensions: 'extension',
  kicks: 'kick',
  thrusts: 'thrust',
  bridges: 'bridge',
  lunges: 'lunge',
  pulls: 'pull',
  pushes: 'push',
  holds: 'hold',
  twists: 'twist',
  rotations: 'rotation',
};

export function normalizeEquipment(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!raw) return '';
  if (EQUIPMENT_ALIASES[raw] != null) return EQUIPMENT_ALIASES[raw];
  if (/body\s*(weight|only)/.test(raw)) return 'bodyweight';
  if (/dumbbell/.test(raw)) return 'dumbbell';
  if (/barbell|olympic/.test(raw)) return 'barbell';
  if (/smith/.test(raw)) return 'smith';
  if (/cable|pulley/.test(raw)) return 'cable';
  if (/\bsled\b/.test(raw)) return 'sled';
  if (/leverage|machine/.test(raw)) return 'machine';
  if (/kettlebell/.test(raw)) return 'kettlebell';
  if (/band/.test(raw)) return 'band';
  if (/ez|e-z/.test(raw)) return 'ezbar';
  return raw;
}

/** Prefer the equipment column; free-weight / smith / sled title cues beat coarse fields. */
export function inferredEquipment(row) {
  const name = String(row.name ?? '').toLowerCase();
  // Specific name cues beat a coarse equipment column (often "machine" / "body only").
  if (/\bsmith(\s+machine)?\b/.test(name)) return 'smith';
  if (/\bsled\b/.test(name)) return 'sled';
  if (/\bdumbbells?\b|\bdumbells?\b|\bdb\b/.test(name)) return 'dumbbell';
  if (/\bkettlebells?\b|\bkb\b/.test(name)) return 'kettlebell';
  if (/\b(olympic\s+)?barbells?\b/.test(name)) return 'barbell';
  if (/\bcables?\b|\bpulleys?\b/.test(name)) return 'cable';

  const fromField = normalizeEquipment(row.equipment);
  if (fromField) return fromField;

  if (/\b(leverage\s+)?machines?\b/.test(name)) return 'machine';
  if (/\bez\s*bar\b/.test(name)) return 'ezbar';
  if (/\b(resistance\s+)?bands?\b/.test(name)) return 'band';
  if (/\b(bodyweight|body\s*weight|body\s+only)\b/.test(name)) return 'bodyweight';
  return '';
}

export function normalizeTarget(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function contextHints(row) {
  const blob = `${row.bodyPart ?? ''} ${row.targetMuscle ?? ''}`.toLowerCase();
  return blob;
}

/**
 * Movement-only key: phrase/token rules from canon, plus side/standing filler,
 * equipment tokens stripped, and body-context words stripped when they match
 * the row's body/target. Keeps incline/decline/flat so angle variants stay apart.
 */
export function nearKey(row) {
  const name = String(row.name ?? '');
  // Start from sorted canon tokens, then rebuild without near-fillers / equipment.
  const base = canon(name);
  const hints = contextHints(row);
  const tokens = [];
  for (const raw of base.split(/\s+/)) {
    if (!raw) continue;
    if (NEAR_FILLER.has(raw)) continue;
    if (EQUIPMENT_TOKENS.has(raw)) continue;
    let token = NEAR_TOKEN_MAP[raw] || raw;
    if (NEAR_FILLER.has(token) || EQUIPMENT_TOKENS.has(token)) continue;
    const dropBody = BODY_CONTEXT.some(
      (entry) => entry.token === token && entry.hints.some((h) => hints.includes(h)),
    );
    if (dropBody) continue;
    if (!tokens.includes(token)) tokens.push(token);
  }

  // Reinstate angle words stripped by enrich noise ("flat").
  for (const angle of ANGLE_TOKENS) {
    if (new RegExp(`\\b${angle}\\b`, 'i').test(name) && !tokens.includes(angle)) {
      tokens.push(angle);
    }
  }

  return tokens.sort().join(' ');
}

export function fieldsCompatible(a, b) {
  const eqA = inferredEquipment(a);
  const eqB = inferredEquipment(b);
  if (eqA && eqB && eqA !== eqB) return false;

  const tA = normalizeTarget(a.targetMuscle);
  const tB = normalizeTarget(b.targetMuscle);
  if (tA && tB && tA !== tB) return false;

  return true;
}

export function shouldMerge(a, b) {
  if (nearKey(a) !== nearKey(b)) return false;
  if (!nearKey(a)) return false;
  return fieldsCompatible(a, b);
}

function completenessScore(row) {
  let score = 0;
  const body = String(row.bodyPart ?? '').trim().toLowerCase();
  if (body && body !== 'other') score += 2;
  if (String(row.equipment ?? '').trim()) score += 2;
  if (String(row.targetMuscle ?? '').trim()) score += 2;
  if (row.category) score += 1;
  if (row.isCompound != null) score += 1;
  const instructions = row.instructions ?? [];
  if (instructions.length > 0) score += Math.min(3, instructions.length);
  const secondary = row.secondaryMuscles ?? row.secondary_muscles ?? [];
  if (secondary.length > 0) score += 1;
  return score;
}

function hasMedia(row) {
  if (row.mediaUrl || row.media_url) return true;
  const urls = row.mediaUrls ?? row.media_urls ?? [];
  return Array.isArray(urls) && urls.length > 0;
}

function titleClarity(name) {
  const s = String(name ?? '');
  let score = 0;
  // Prefer Title Case-ish tokens.
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 0) return -100;
  const titled = words.filter((w) => /^[A-Z][a-z0-9'’-]*$/.test(w) || /^[A-Z0-9]+$/.test(w));
  score += titled.length;
  // Prefer fewer punctuation / digit noise.
  if (!/[_\-]{2}|^\d/.test(s)) score += 1;
  // Mild preference for shorter clear names.
  score -= Math.max(0, words.length - 4) * 0.1;
  // Prefer no leading lowercase dump.
  if (/^[a-z]/.test(s)) score -= 2;
  return score;
}

export function compareCanonical(a, b) {
  const complete = completenessScore(b) - completenessScore(a);
  if (complete) return complete;

  const media = Number(hasMedia(b)) - Number(hasMedia(a));
  if (media) return media;

  const source =
    (SOURCE_RANK[a.source] ?? 9) - (SOURCE_RANK[b.source] ?? 9);
  if (source) return source;

  const clarity = titleClarity(b.name) - titleClarity(a.name);
  if (clarity) return clarity;

  return String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id));
}

export function pickCanonical(rows) {
  if (!rows.length) return null;
  return [...rows].sort(compareCanonical)[0];
}

/**
 * Group rows that should merge. Only call with catalogue sources.
 * Returns groups with length >= 2 (singletons omitted).
 */
export function groupNearDuplicates(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = nearKey(row);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const groups = [];
  for (const bucket of byKey.values()) {
    if (bucket.length < 2) continue;
    const used = new Set();
    for (let i = 0; i < bucket.length; i += 1) {
      if (used.has(i)) continue;
      const cluster = [bucket[i]];
      used.add(i);
      for (let j = i + 1; j < bucket.length; j += 1) {
        if (used.has(j)) continue;
        if (cluster.every((member) => fieldsCompatible(member, bucket[j]))) {
          cluster.push(bucket[j]);
          used.add(j);
        }
      }
      if (cluster.length >= 2) groups.push(cluster);
    }
  }
  return groups;
}

export function mergeFieldPayload(canonical, hiddenRows) {
  const aliases = [];
  let mediaUrl = canonical.mediaUrl ?? canonical.media_url ?? null;
  let mediaKind = canonical.mediaKind ?? canonical.media_kind ?? null;
  let mediaUrls = [...(canonical.mediaUrls ?? canonical.media_urls ?? [])];
  if (!mediaUrls.length && mediaUrl) mediaUrls = [mediaUrl];
  let instructions = [...(canonical.instructions ?? [])];
  let secondary = [...(canonical.secondaryMuscles ?? canonical.secondary_muscles ?? [])];

  for (const row of hiddenRows) {
    if (row.name && row.name !== canonical.name && !aliases.includes(row.name)) {
      aliases.push(row.name);
    }
    const rowUrl = row.mediaUrl ?? row.media_url ?? null;
    const rowUrls = row.mediaUrls ?? row.media_urls ?? [];
    if (!mediaUrl && rowUrl) {
      mediaUrl = rowUrl;
      mediaKind = row.mediaKind ?? row.media_kind ?? mediaKind;
    }
    for (const url of rowUrls) {
      if (url && !mediaUrls.includes(url)) mediaUrls.push(url);
    }
    if (rowUrl && !mediaUrls.includes(rowUrl)) mediaUrls.push(rowUrl);

    const rowInstructions = row.instructions ?? [];
    if (instructions.length === 0 && rowInstructions.length > 0) {
      instructions = [...rowInstructions];
    }
    const rowSecondary = row.secondaryMuscles ?? row.secondary_muscles ?? [];
    for (const muscle of rowSecondary) {
      if (muscle && !secondary.includes(muscle)) secondary.push(muscle);
    }
  }

  if (!mediaUrls.length && mediaUrl) mediaUrls = [mediaUrl];

  return { aliases, mediaUrl, mediaKind, mediaUrls, instructions, secondary };
}
