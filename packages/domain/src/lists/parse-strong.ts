import { headerKey, parseCsv } from '../csv';
import type { WeightUnit } from '../train/units';
import { registerListSourceDetector, type ListSourceInput } from './detect';
import {
  buildExerciseFromSets,
  detectUnitFromCells,
  detectUnitFromHeader,
  distanceToMeters,
  parseDurationSeconds,
  parseNumber,
  parseRpe,
  parseStrongDurationToMinutes,
  unitFromWeightCell,
  weightToStoredKg,
  type ParsedWorkoutFile,
} from './workout-import';
import type { WorkoutImportSession, WorkoutImportSet } from './types';

/**
 * Strong workout CSV headers (documented export):
 * Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps,
 * Distance, Seconds, Notes, Workout Notes, RPE
 * Duration examples: "1h 9m", "45m". Weight has no unit column — may be
 * "Weight (kg)" / "Weight (lbs)" or plain "Weight"; ; or , delimiters both occur.
 * @see https://help.strongapp.io/article/235-export-workout-data
 * @see https://thetaperapp.com/articles/how-to-export-strong-data/
 */
const STRONG_CORE = ['date', 'workout name', 'exercise name'] as const;

function indexOf(headers: readonly string[], ...aliases: string[]): number {
  const keys = aliases.map((alias) => headerKey(alias));
  return headers.findIndex((header) => keys.includes(headerKey(header)));
}

export function looksLikeStrongCsv(headers: readonly string[] | null | undefined): boolean {
  if (!headers || headers.length < 6) return false;
  const keys = new Set(headers.map(headerKey));
  if (!STRONG_CORE.every((key) => keys.has(key))) return false;
  return keys.has('set order') || keys.has('weight') || [...keys].some((key) => key.startsWith('weight'));
}

function parseStrongDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // "2021-07-24 10:37:18"
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  if (match) return `${match[1]}T${match[2]!.length === 5 ? `${match[2]}:00` : match[2]}`;
  const iso = Date.parse(trimmed);
  if (!Number.isFinite(iso)) return null;
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, '');
}

function detectStrongWeightUnit(headers: readonly string[], weightCells: readonly string[], fallback: WeightUnit): WeightUnit {
  for (const header of headers) {
    const unit = detectUnitFromHeader(header);
    if (unit && headerKey(header).includes('weight')) return unit;
  }
  for (const cell of weightCells) {
    const unit = unitFromWeightCell(cell);
    if (unit) return unit;
  }
  const nums = weightCells.map((cell) => parseNumber(cell)).filter((n): n is number => n != null && n > 0);
  return detectUnitFromCells(nums, fallback);
}

function setTypeFromOrder(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.includes('warm')) return 'warmup';
  if (trimmed.includes('rest')) return 'rest';
  if (trimmed.includes('drop')) return 'dropset';
  if (trimmed.includes('fail')) return 'failure';
  return 'normal';
}

type AccExercise = {
  name: string;
  note: string | null;
  sets: WorkoutImportSet[];
};

type AccSession = {
  name: string;
  startedAt: string | null;
  durationMin: number | null;
  description: string | null;
  exercises: AccExercise[];
  exerciseIndex: Map<string, number>;
};

export function parseStrongCsv(
  text: string,
  opts?: { fallbackWeightUnit?: WeightUnit },
): ParsedWorkoutFile {
  const parsed = parseCsv(text);
  if (!looksLikeStrongCsv(parsed.headers)) {
    throw new Error('Not a Strong export CSV');
  }
  const headers = parsed.headers ?? [];
  const dateIdx = indexOf(headers, 'date');
  const nameIdx = indexOf(headers, 'workout name', 'workout');
  const durationIdx = indexOf(headers, 'duration');
  const exerciseIdx = indexOf(headers, 'exercise name', 'exercise');
  const setOrderIdx = indexOf(headers, 'set order', 'set');
  const weightIdx = headers.findIndex((header) => headerKey(header).startsWith('weight'));
  const repsIdx = indexOf(headers, 'reps');
  const distanceIdx = indexOf(headers, 'distance');
  const secondsIdx = indexOf(headers, 'seconds', 'duration_seconds');
  const notesIdx = indexOf(headers, 'notes');
  const workoutNotesIdx = indexOf(headers, 'workout notes');
  const rpeIdx = indexOf(headers, 'rpe');

  const weightCells = parsed.rows.map((cells) => (weightIdx >= 0 ? cells[weightIdx] ?? '' : ''));
  const sourceWeightUnit = detectStrongWeightUnit(headers, weightCells, opts?.fallbackWeightUnit ?? 'kg');

  // Distance: Strong exports km or miles unlabeled; treat as km unless header says otherwise.
  let distanceUnit: 'km' | 'mi' = 'km';
  for (const header of headers) {
    const key = headerKey(header);
    if (key.includes('distance') && (key.includes('mile') || key.includes('mi'))) distanceUnit = 'mi';
  }

  const sessions: AccSession[] = [];
  const sessionIndex = new Map<string, number>();

  for (const cells of parsed.rows) {
    const workoutName = (nameIdx >= 0 ? cells[nameIdx] : '')?.trim() || '';
    const exerciseName = (exerciseIdx >= 0 ? cells[exerciseIdx] : '')?.trim() || '';
    if (!workoutName || !exerciseName) continue;

    const startedAt = dateIdx >= 0 ? parseStrongDate(cells[dateIdx] ?? '') : null;
    const sessionKey = `${workoutName.toLowerCase()}|${startedAt ?? ''}`;
    let session = sessions[sessionIndex.get(sessionKey) ?? -1];
    if (!session) {
      session = {
        name: workoutName,
        startedAt,
        durationMin: durationIdx >= 0 ? parseStrongDurationToMinutes(cells[durationIdx]) : null,
        description: workoutNotesIdx >= 0 ? (cells[workoutNotesIdx] ?? '').trim() || null : null,
        exercises: [],
        exerciseIndex: new Map(),
      };
      sessionIndex.set(sessionKey, sessions.length);
      sessions.push(session);
    }

    let exercise = session.exercises[session.exerciseIndex.get(exerciseName.toLowerCase()) ?? -1];
    if (!exercise) {
      exercise = {
        name: exerciseName,
        note: notesIdx >= 0 ? (cells[notesIdx] ?? '').trim() || null : null,
        sets: [],
      };
      session.exerciseIndex.set(exerciseName.toLowerCase(), session.exercises.length);
      session.exercises.push(exercise);
    }

    const weightRaw = weightIdx >= 0 ? cells[weightIdx] ?? '' : '';
    const weightNum = parseNumber(weightRaw);
    const distanceRaw = distanceIdx >= 0 ? cells[distanceIdx] ?? '' : '';
    const distanceNum = parseNumber(distanceRaw);
    const secondsRaw = secondsIdx >= 0 ? cells[secondsIdx] ?? '' : '';

    exercise.sets.push({
      reps: repsIdx >= 0 ? (cells[repsIdx] ?? '').trim() || null : null,
      weightKg: weightNum != null ? weightToStoredKg(weightNum, sourceWeightUnit) : null,
      distanceM: distanceNum != null ? distanceToMeters(distanceNum, distanceUnit) : null,
      durationSec: parseDurationSeconds(secondsRaw),
      rpe: rpeIdx >= 0 ? parseRpe(cells[rpeIdx]) : null,
      setType: setOrderIdx >= 0 ? setTypeFromOrder(cells[setOrderIdx] ?? '') : 'normal',
    });
  }

  const result: WorkoutImportSession[] = sessions.map((session) => ({
    name: session.name,
    startedAt: session.startedAt,
    endedAt: null,
    durationMin: session.durationMin,
    description: session.description,
    exercises: session.exercises.map((exercise) =>
      buildExerciseFromSets(exercise.name, exercise.sets, exercise.note),
    ),
    status: 'ready',
    note: null,
  }));

  return { sourceWeightUnit, sessions: result };
}

function detectStrong(input: ListSourceInput) {
  const fileName = (input.fileName ?? '').toLowerCase();
  if (fileName.endsWith('.zip')) return null;
  const text = input.text?.replace(/^\uFEFF/, '') ?? null;
  if (!text) return null;
  const mime = (input.mimeType ?? '').toLowerCase();
  if (!(fileName.endsWith('.csv') || mime.includes('csv') || /[,;\t]/.test(text))) return null;
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const delimiter =
    firstLine.includes(';') && (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const headers = firstLine.split(delimiter).map((cell) => cell.replace(/^"|"$/g, '').trim());
  if (looksLikeStrongCsv(headers)) return 'strong-csv' as const;
  return null;
}

registerListSourceDetector({ id: 'strong', detect: detectStrong });
