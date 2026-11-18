export const DAY_TASK_LIMIT = 30;
export const HOUSEHOLD_DAY_TASK_LIMIT = 40;
export const JOURNAL_LIMIT = 8000;
export const WORKOUT_TITLE_LIMIT = 80;
export const WORKOUT_NOTES_LIMIT = 1200;

export type DayTask = {
  id: string;
  label: string;
  done: boolean;
};

export type DayTaskBucket = {
  date: string;
  tasks: DayTask[];
};

/** Move incomplete personal tasks from earlier days onto `targetDate` (newest sources first). */
export function rollIncompleteDayTasks(
  buckets: readonly DayTaskBucket[],
  targetDate: string,
): { target: DayTask[]; priors: DayTaskBucket[] } {
  const byDate = new Map<string, DayTask[]>();
  for (const bucket of buckets) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bucket.date)) continue;
    byDate.set(bucket.date, normalizeDayTasks(bucket.tasks));
  }
  const target = [...(byDate.get(targetDate) ?? [])];
  byDate.delete(targetDate);
  const seen = new Set(target.map((task) => task.id));
  const priorDates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const priors: DayTaskBucket[] = [];
  for (const date of priorDates) {
    const tasks = byDate.get(date) ?? [];
    const kept: DayTask[] = [];
    for (const task of tasks) {
      if (task.done) {
        kept.push(task);
        continue;
      }
      if (seen.has(task.id) || target.length >= DAY_TASK_LIMIT) {
        kept.push(task);
        continue;
      }
      seen.add(task.id);
      target.push({ ...task, done: false });
    }
    priors.push({ date, tasks: kept });
  }
  return { target: normalizeDayTasks(target), priors };
}

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
