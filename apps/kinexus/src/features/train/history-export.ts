import type { FinishedSessionRow } from '@/src/features/train/api';

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function sessionMinutes(row: FinishedSessionRow): number {
  if (row.durationMin != null && row.durationMin > 0) return row.durationMin;
  const start = Date.parse(row.startedAt);
  const end = Date.parse(row.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

/** Lite session summary CSV for History export. */
export function buildHistoryCsv(rows: FinishedSessionRow[]): { fileName: string; mimeType: string; text: string } {
  const header = ['date', 'name', 'duration_min', 'calories_burned'];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        csvCell(row.finishedAt.slice(0, 10)),
        csvCell(row.name),
        csvCell(sessionMinutes(row) || ''),
        csvCell(row.caloriesBurned ?? ''),
      ].join(','),
    ),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    fileName: `kinexus-workout-history-${stamp}.csv`,
    mimeType: 'text/csv',
    text: `${lines.join('\n')}\n`,
  };
}
