import {
  applyImportRows,
  toStoredKg,
  type ImportApplySummary,
  type ImportRow,
  type KinexusListKind,
  type WeightUnit,
} from '@kinexus/domain';

export type ListImportTarget =
  | { mode: 'new'; name: string }
  | { mode: 'existing'; listId: string; name: string };

export type ListImportWriters = {
  ensureTargetList: (target: ListImportTarget) => Promise<string | null>;
  writeRow: (listId: string | null, row: ImportRow) => Promise<void>;
};

export async function runListImport(opts: {
  kind: KinexusListKind;
  rows: readonly ImportRow[];
  target: ListImportTarget;
  writers: ListImportWriters;
  signal: { cancelled: boolean };
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportApplySummary> {
  const listId = await opts.writers.ensureTargetList(opts.target);
  return applyImportRows(
    opts.rows,
    (row) => opts.writers.writeRow(listId, row),
    { signal: opts.signal, onProgress: opts.onProgress },
  );
}

export function workoutWeightToKg(value: number | null, unit: WeightUnit): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return toStoredKg(value, unit);
}
