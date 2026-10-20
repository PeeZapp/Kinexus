export const DAY_TASK_LIMIT = 30;
export const JOURNAL_LIMIT = 8000;
export const WORKOUT_TITLE_LIMIT = 80;
export const WORKOUT_NOTES_LIMIT = 1200;

export type DayTask = {
  id: string;
  label: string;
  done: boolean;
};

const TASK_ID = /^[a-zA-Z0-9_-]{4,40}$/;

export function clipDayText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').slice(0, max);
}

export function normalizeDayTask(value: unknown): DayTask | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !TASK_ID.test(row.id)) return null;
  if (typeof row.label !== 'string') return null;
  const label = row.label.replace(/\s+/g, ' ').trim();
  if (label.length < 1 || label.length > 120) return null;
  return { id: row.id, label, done: row.done === true };
}

export function normalizeDayTasks(values: unknown): DayTask[] {
  if (!Array.isArray(values)) return [];
  const out: DayTask[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const task = normalizeDayTask(value);
    if (!task || seen.has(task.id)) continue;
    seen.add(task.id);
    out.push(task);
    if (out.length >= DAY_TASK_LIMIT) break;
  }
  return out;
}
