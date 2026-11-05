export type WeightUnit = 'kg' | 'lb';
export type MeasurementSystem = 'metric' | 'imperial';

const LB_PER_KG = 2.2046226218;
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

export function roundWeight(value: number, step: number): number {
  if (!Number.isFinite(value) || step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Convert stored kg to display lb, rounded to 1 lb. */
export function kgToLb(kg: number): number {
  return roundWeight(kg * LB_PER_KG, 1);
}

/** Convert display lb to stored kg, rounded to 0.5 kg. */
export function lbToKg(lb: number): number {
  return roundWeight(lb / LB_PER_KG, 0.5);
}

export function formatWeight(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kgToLb(kg) : roundWeight(kg, 0.5);
}

export function toStoredKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? lbToKg(value) : roundWeight(value, 0.5);
}

export function defaultsForRegion(regionCode: string | null | undefined): {
  weightUnit: WeightUnit;
  measurementSystem: MeasurementSystem;
} {
  const code = (regionCode ?? '').trim().toUpperCase();
  if (IMPERIAL_REGIONS.has(code)) {
    return { weightUnit: 'lb', measurementSystem: 'imperial' };
  }
  return { weightUnit: 'kg', measurementSystem: 'metric' };
}

export function weightUnitFrom(value: unknown): WeightUnit | null {
  return value === 'kg' || value === 'lb' ? value : null;
}

export function measurementSystemFrom(value: unknown): MeasurementSystem | null {
  return value === 'metric' || value === 'imperial' ? value : null;
}
