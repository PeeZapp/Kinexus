import { headerKey, parseCsv } from '../csv';
import type { WeightUnit } from '../train/units';
import { registerListSourceDetector, type ListSourceInput } from './detect';
import {
  buildExerciseFromSets,
  detectUnitFromHeader,
  distanceToMeters,
  parseDurationSeconds,
  parseNumber,
  parseRpe,
  weightToStoredKg,
  type ParsedWorkoutFile,
} from './workout-import';
import type { WorkoutImportSession, WorkoutImportSet } from './types';

/**
 * Hevy workout CSV headers (documented export):
 * title, start_time, end_time, description, exercise_title, superset_id,
 * exercise_notes, set_index, set_type, weight_kg|weight_lbs, reps,
 * distance_km|distance_miles, duration_seconds, rpe
 * @see https://help.hevyapp.com/hc/en-us/articles/43708290987415-Exporting-Your-Data-from-Hevy
 * @see https://gymlog.info/analyze/hevy-workout-data/
 */
const HEVY_CORE = ['title', 'exercise_title', 'start_time'] as const;

function indexOf(headers: readonly string[], ...aliases: string[]): number {
  const keys = aliases.map((alias) => headerKey(alias));
  return headers.findIndex((header) => keys.includes(headerKey(header)));
}

export function looksLikeHevyCsv(headers: readonly string[] | null | undefined): boolean {
  if (!headers || headers.length < 6) return false;
  const keys = new Set(headers.map(headerKey));
  if (!HEVY_CORE.every((key) => keys.has(key))) return false;
  const hasWeight = [...keys].some((key) => key.startsWith('weight'));
  const hasSet = keys.has('set_index') || keys.has('set_type') || keys.has('reps');
  return hasWeight && hasSet;
}

function parseHevyTimestamp(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // "28 Mar 2025, 17:29" or "15 Jul 2026, 09:52"
  const match = trimmed.match(
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (match) {
    const months: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    const month = months[match[2]!.toLowerCase()];
    if (!month) return null;
    const dd = match[1]!.padStart(2, '0');
    const hh = match[4]!.padStart(2, '0');
    const mm = match[5]!.padStart(2, '0');
    const ss = (match[6] ?? '00').padStart(2, '0');
    return `${match[3]}-${month}-${dd}T${hh}:${mm}:${ss}`;
  }
  const iso = Date.parse(trimmed);
  if (!Number.isFinite(iso)) return null;
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, '');
}

function detectHevyWeightUnit(headers: readonly string[]): WeightUnit {
  for (const header of headers) {
    const unit = detectUnitFromHeader(header);
    if (unit && headerKey(header).includes('weight')) return unit;
  }
  return 'kg';
}

function detectHevyDistanceUnit(headers: readonly string[]): 'km' | 'mi' {
  for (const header of headers) {
    const key = headerKey(header);
    if (key.includes('distance') && (key.includes('mile') || key.endsWith('_mi') || key.includes('miles'))) {
      return 'mi';
    }
  }
  return 'km';
}

type AccExercise = {
  name: string;
  note: string | null;
  sets: WorkoutImportSet[];
};

type AccSession = {
  name: string;
  startedAt: string | null;
  endedAt: string | null;
  description: string | null;
  exercises: AccExercise[];
  exerciseIndex: Map<string, number>;
};

export function parseHevyCsv(text: string): ParsedWorkoutFile {
  const parsed = parseCsv(text);
  if (!looksLikeHevyCsv(parsed.headers)) {
    throw new Error('Not a Hevy export CSV');
  }
  const headers = parsed.headers ?? [];
  const titleIdx = indexOf(headers, 'title');
  const startIdx = indexOf(headers, 'start_time', 'start time');
  const endIdx = indexOf(headers, 'end_time', 'end time');
  const descIdx = indexOf(headers, 'description');
  const exerciseIdx = indexOf(headers, 'exercise_title', 'exercise title');
  const notesIdx = indexOf(headers, 'exercise_notes', 'exercise notes');
  const setTypeIdx = indexOf(headers, 'set_type', 'set type');
  const weightIdx = headers.findIndex((header) => headerKey(header).startsWith('weight'));
  const repsIdx = indexOf(headers, 'reps');
  const distanceIdx = headers.findIndex((header) => headerKey(header).startsWith('distance'));
  const durationIdx = indexOf(headers, 'duration_seconds', 'duration seconds', 'duration');
  const rpeIdx = indexOf(headers, 'rpe');

  const sourceWeightUnit = detectHevyWeightUnit(headers);
  const distanceUnit = detectHevyDistanceUnit(headers);

  const sessions: AccSession[] = [];
  const sessionIndex = new Map<string, number>();

  for (const cells of parsed.rows) {
    const workoutName = (titleIdx >= 0 ? cells[titleIdx] : '')?.trim() || '';
    const exerciseName = (exerciseIdx >= 0 ? cells[exerciseIdx] : '')?.trim() || '';
    if (!workoutName || !exerciseName) continue;

    const startedAt = startIdx >= 0 ? parseHevyTimestamp(cells[startIdx] ?? '') : null;
    const sessionKey = `${workoutName.toLowerCase()}|${startedAt ?? ''}`;
    let session = sessions[sessionIndex.get(sessionKey) ?? -1];
    if (!session) {
      session = {
        name: workoutName,
        startedAt,
        endedAt: endIdx >= 0 ? parseHevyTimestamp(cells[endIdx] ?? '') : null,
        description: descIdx >= 0 ? (cells[descIdx] ?? '').trim() || null : null,
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

    exercise.sets.push({
      reps: repsIdx >= 0 ? (cells[repsIdx] ?? '').trim() || null : null,
      weightKg: weightNum != null ? weightToStoredKg(weightNum, sourceWeightUnit) : null,
      distanceM: distanceNum != null ? distanceToMeters(distanceNum, distanceUnit) : null,
      durationSec: durationIdx >= 0 ? parseDurationSeconds(cells[durationIdx]) : null,
      rpe: rpeIdx >= 0 ? parseRpe(cells[rpeIdx]) : null,
      setType: setTypeIdx >= 0 ? (cells[setTypeIdx] ?? '').trim() || null : null,
    });
  }

  const result: WorkoutImportSession[] = sessions.map((session) => {
    let durationMin: number | null = null;
    if (session.startedAt && session.endedAt) {
      const start = Date.parse(session.startedAt);
      const end = Date.parse(session.endedAt);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        durationMin = Math.max(1, Math.round((end - start) / 60000));
      }
    }
    return {
      name: session.name,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMin,
      description: session.description,
      exercises: session.exercises.map((exercise) =>
        buildExerciseFromSets(exercise.name, exercise.sets, exercise.note),
      ),
      status: 'ready',
      note: null,
    };
  });

  return { sourceWeightUnit, sessions: result };
}

function detectHevy(input: ListSourceInput) {
  const fileName = (input.fileName ?? '').toLowerCase();
  if (fileName.endsWith('.zip')) return null;
  const text = input.text?.replace(/^\uFEFF/, '') ?? null;
  if (!text) return null;
  const mime = (input.mimeType ?? '').toLowerCase();
  if (!(fileName.endsWith('.csv') || mime.includes('csv') || /[,;\t]/.test(text))) return null;
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const delimiter = firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const headers = firstLine.split(delimiter).map((cell) => cell.replace(/^"|"$/g, '').trim());
  if (looksLikeHevyCsv(headers)) return 'hevy-csv' as const;
  return null;
}

registerListSourceDetector({ id: 'hevy', detect: detectHevy });
