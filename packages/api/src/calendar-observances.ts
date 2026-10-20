import { normalizeCountryCode } from '@kinexus/domain';

type NagerHoliday = {
  date?: string;
  localName?: string;
  name?: string;
  global?: boolean;
  counties?: string[] | null;
  types?: string[];
};

type OpenHoliday = {
  startDate?: string;
  endDate?: string;
  name?: { text?: string; language?: string }[];
};

export type ObservanceHoliday = {
  date: string;
  name: string;
};

export type ObservanceSchoolRange = {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  source: string;
};

const NAGER_BASE = 'https://date.nager.at/api/v3/PublicHolidays';
const OPEN_HOLIDAYS_BASE = 'https://openholidaysapi.org';

function yearsInRange(from: string, to: string): number[] {
  const start = Number(from.slice(0, 4));
  const end = Number(to.slice(0, 4));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const years: number[] = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return years;
}

function isNationalHoliday(row: NagerHoliday, country: string): boolean {
  if (row.global) return true;
  if (!row.counties || row.counties.length === 0) return true;
  const name = `${row.localName ?? ''} ${row.name ?? ''}`.toLowerCase();
  // Common national observances that Nager marks as regional in some countries.
  if (country === 'AU' && name.includes('anzac')) return true;
  if (country === 'NZ' && name.includes('waitangi')) return true;
  return false;
}

export async function fetchPublicHolidays(
  country: string,
  from: string,
  to: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ObservanceHoliday[]> {
  const code = normalizeCountryCode(country);
  const out: ObservanceHoliday[] = [];
  const seen = new Set<string>();

  for (const year of yearsInRange(from, to)) {
    let response: Response;
    try {
      response = await fetchImpl(`${NAGER_BASE}/${year}/${code}`, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const rows = (await response.json().catch(() => [])) as NagerHoliday[];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row.date || row.date < from || row.date > to) continue;
      if (!isNationalHoliday(row, code)) continue;
      const name = (row.localName || row.name || '').trim();
      if (!name) continue;
      const key = `${row.date}:${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ date: row.date, name });
    }
  }

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)));
}

export async function fetchOpenHolidaysSchoolRanges(
  country: string,
  from: string,
  to: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ObservanceSchoolRange[]> {
  const code = normalizeCountryCode(country);
  const url =
    `${OPEN_HOLIDAYS_BASE}/SchoolHolidays?countryIsoCode=${encodeURIComponent(code)}` +
    `&languageIsoCode=EN&validFrom=${encodeURIComponent(from)}&validTo=${encodeURIComponent(to)}`;

  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const rows = (await response.json().catch(() => [])) as OpenHoliday[];
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, index) => {
      const startsOn = row.startDate?.slice(0, 10) ?? '';
      const endsOn = (row.endDate ?? row.startDate)?.slice(0, 10) ?? '';
      const title =
        row.name?.find((item) => item.language?.toUpperCase() === 'EN')?.text?.trim() ||
        row.name?.[0]?.text?.trim() ||
        'School holidays';
      if (!startsOn || !endsOn) return null;
      return {
        id: `open:${code}:${startsOn}:${index}`,
        title,
        startsOn,
        endsOn,
        source: 'OpenHolidays',
      } satisfies ObservanceSchoolRange;
    })
    .filter((row): row is ObservanceSchoolRange => Boolean(row));
}

export async function handleCalendarObservances(body: {
  country?: unknown;
  from?: unknown;
  to?: unknown;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const country = typeof body.country === 'string' ? body.country : 'AU';
  const from = typeof body.from === 'string' ? body.from : '';
  const to = typeof body.to === 'string' ? body.to : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return { status: 400, body: { error: 'from and to must be YYYY-MM-DD dates.' } };
  }

  const publicHolidays = await fetchPublicHolidays(country, from, to);
  const code = normalizeCountryCode(country);
  const schoolHolidays =
    code === 'IE' || code === 'ZA' ? await fetchOpenHolidaysSchoolRanges(code, from, to) : [];

  return {
    status: 200,
    body: {
      country: code,
      from,
      to,
      publicHolidays,
      schoolHolidays,
    },
  };
}
