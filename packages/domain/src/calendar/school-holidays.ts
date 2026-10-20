import { normalizeCountryCode } from '../meals/markets';

import { isIsoDate } from './events';

export type SchoolHolidayRange = {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  source: string;
};

type CountryPack = {
  source: string;
  ranges: readonly { id: string; title: string; startsOn: string; endsOn: string }[];
};

/**
 * Curated school holiday ranges for markets OpenHolidays does not cover well.
 * AU uses NSW Eastern Division (largest population) as the household default.
 */
const PACKS: Record<string, CountryPack> = {
  AU: {
    source: 'NSW Eastern Division',
    ranges: [
      { id: 'au-2025-autumn', title: 'School holidays', startsOn: '2025-04-14', endsOn: '2025-04-24' },
      { id: 'au-2025-winter', title: 'School holidays', startsOn: '2025-07-07', endsOn: '2025-07-18' },
      { id: 'au-2025-spring', title: 'School holidays', startsOn: '2025-09-29', endsOn: '2025-10-10' },
      { id: 'au-2025-summer', title: 'School holidays', startsOn: '2025-12-22', endsOn: '2026-01-26' },
      { id: 'au-2026-autumn', title: 'School holidays', startsOn: '2026-04-07', endsOn: '2026-04-17' },
      { id: 'au-2026-winter', title: 'School holidays', startsOn: '2026-07-06', endsOn: '2026-07-17' },
      { id: 'au-2026-spring', title: 'School holidays', startsOn: '2026-09-28', endsOn: '2026-10-09' },
      { id: 'au-2026-summer', title: 'School holidays', startsOn: '2026-12-18', endsOn: '2027-01-27' },
      { id: 'au-2027-autumn', title: 'School holidays', startsOn: '2027-04-12', endsOn: '2027-04-23' },
      { id: 'au-2027-winter', title: 'School holidays', startsOn: '2027-07-05', endsOn: '2027-07-16' },
      { id: 'au-2027-spring', title: 'School holidays', startsOn: '2027-09-27', endsOn: '2027-10-08' },
      { id: 'au-2027-summer', title: 'School holidays', startsOn: '2027-12-21', endsOn: '2028-01-28' },
    ],
  },
  NZ: {
    source: 'New Zealand (typical)',
    ranges: [
      { id: 'nz-2025-t1', title: 'School holidays', startsOn: '2025-04-12', endsOn: '2025-04-27' },
      { id: 'nz-2025-t2', title: 'School holidays', startsOn: '2025-07-05', endsOn: '2025-07-20' },
      { id: 'nz-2025-t3', title: 'School holidays', startsOn: '2025-09-27', endsOn: '2025-10-12' },
      { id: 'nz-2025-summer', title: 'School holidays', startsOn: '2025-12-13', endsOn: '2026-02-01' },
      { id: 'nz-2026-t1', title: 'School holidays', startsOn: '2026-04-11', endsOn: '2026-04-26' },
      { id: 'nz-2026-t2', title: 'School holidays', startsOn: '2026-07-04', endsOn: '2026-07-19' },
      { id: 'nz-2026-t3', title: 'School holidays', startsOn: '2026-09-26', endsOn: '2026-10-11' },
      { id: 'nz-2026-summer', title: 'School holidays', startsOn: '2026-12-12', endsOn: '2027-01-31' },
      { id: 'nz-2027-t1', title: 'School holidays', startsOn: '2027-04-10', endsOn: '2027-04-25' },
      { id: 'nz-2027-t2', title: 'School holidays', startsOn: '2027-07-03', endsOn: '2027-07-18' },
      { id: 'nz-2027-t3', title: 'School holidays', startsOn: '2027-09-25', endsOn: '2027-10-10' },
      { id: 'nz-2027-summer', title: 'School holidays', startsOn: '2027-12-11', endsOn: '2028-01-30' },
    ],
  },
  GB: {
    source: 'England (typical)',
    ranges: [
      { id: 'gb-2025-spring', title: 'School holidays', startsOn: '2025-04-07', endsOn: '2025-04-21' },
      { id: 'gb-2025-half1', title: 'School holidays', startsOn: '2025-05-26', endsOn: '2025-05-30' },
      { id: 'gb-2025-summer', title: 'School holidays', startsOn: '2025-07-21', endsOn: '2025-09-01' },
      { id: 'gb-2025-half2', title: 'School holidays', startsOn: '2025-10-27', endsOn: '2025-10-31' },
      { id: 'gb-2025-xmas', title: 'School holidays', startsOn: '2025-12-22', endsOn: '2026-01-02' },
      { id: 'gb-2026-spring', title: 'School holidays', startsOn: '2026-03-30', endsOn: '2026-04-10' },
      { id: 'gb-2026-half1', title: 'School holidays', startsOn: '2026-05-25', endsOn: '2026-05-29' },
      { id: 'gb-2026-summer', title: 'School holidays', startsOn: '2026-07-20', endsOn: '2026-08-31' },
      { id: 'gb-2026-half2', title: 'School holidays', startsOn: '2026-10-26', endsOn: '2026-10-30' },
      { id: 'gb-2026-xmas', title: 'School holidays', startsOn: '2026-12-21', endsOn: '2027-01-01' },
      { id: 'gb-2027-spring', title: 'School holidays', startsOn: '2027-03-29', endsOn: '2027-04-09' },
      { id: 'gb-2027-half1', title: 'School holidays', startsOn: '2027-05-31', endsOn: '2027-06-04' },
      { id: 'gb-2027-summer', title: 'School holidays', startsOn: '2027-07-26', endsOn: '2027-09-03' },
      { id: 'gb-2027-half2', title: 'School holidays', startsOn: '2027-10-25', endsOn: '2027-10-29' },
      { id: 'gb-2027-xmas', title: 'School holidays', startsOn: '2027-12-20', endsOn: '2027-12-31' },
    ],
  },
};

/** Countries where school holidays should be loaded from OpenHolidays API instead. */
export const OPEN_HOLIDAYS_SCHOOL_COUNTRIES = new Set(['IE', 'ZA']);

export function usesOpenHolidaysSchoolData(country: string | null | undefined): boolean {
  return OPEN_HOLIDAYS_SCHOOL_COUNTRIES.has(normalizeCountryCode(country));
}

export function schoolHolidayRangesForCountry(
  country: string | null | undefined,
  from: string,
  to: string,
): SchoolHolidayRange[] {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return [];
  const code = normalizeCountryCode(country);
  if (usesOpenHolidaysSchoolData(code)) return [];
  const pack = PACKS[code];
  if (!pack) return [];
  return pack.ranges
    .filter((range) => range.startsOn <= to && range.endsOn >= from)
    .map((range) => ({
      ...range,
      source: pack.source,
    }));
}
