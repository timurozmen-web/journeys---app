// Public holidays for any country and year, from Nager.Date: free, no key,
// open data (date.nager.at). Fetched here rather than from the browser so
// the app doesn't depend on Nager allowing cross-site requests, and so the
// answer can be cached for everyone.
//
// School holidays come from OpenHolidays (openholidaysapi.org): free, no
// key, run by a German non-profit. They're regional (a German state's, a
// French zone's), so each comes with the regions that keep it.

const NAGER = 'https://date.nager.at/api/v3/PublicHolidays';
const OPENHOLIDAYS = 'https://openholidaysapi.org/SchoolHolidays';

// The countries OpenHolidays has school holidays for: the folders with
// school files in its data repository (github.com/openpotato/
// openholidaysapi.data, src/<code>/holidays), read 20 Oct 2026. Asking
// for any other gets an empty list, so it isn't asked.
export const SCHOOL_COUNTRIES = new Set('AD AL AT BE BG BY CH CZ DE EE ES FR HR HU IE IT LI LT LU LV MC MD MT MX NL PL PT RO RS SI SK SM ZA'.split(' '));

/** The country (ISO 3166 alpha-2) and year asked for, or null if either isn't one. */
export function parseQuery(params) {
  const country = String(params?.country ?? '').trim().toUpperCase();
  const year = Number(params?.year);
  if (!/^[A-Z]{2}$/.test(country) || !Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { country, year };
}

/**
 * Nager's holidays, kept to what the app uses. `global` is false for a
 * holiday kept only in some regions (a German state's), which the app
 * doesn't count as a national surge.
 */
export function mapHolidays(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((h) => h && typeof h.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date))
    .map((h) => ({
      date: h.date,
      name: typeof h.name === 'string' ? h.name : '',
      localName: typeof h.localName === 'string' ? h.localName : '',
      global: h.global !== false,
      types: Array.isArray(h.types) ? h.types.filter((t) => typeof t === 'string') : [],
    }));
}

/**
 * The holidays for a country and year. A country Nager doesn't cover
 * comes back as not supported with none, so the app shows nothing
 * rather than an error.
 */
export async function fetchHolidays({ country, year }, fetchImpl = fetch) {
  const res = await fetchImpl(`${NAGER}/${year}/${country}`, { headers: { Accept: 'application/json' } });
  if (res.status === 404 || res.status === 204) return { supported: false, holidays: [] };
  if (!res.ok) throw new Error(`Nager.Date answered ${res.status}`);
  return { supported: true, holidays: mapHolidays(await res.json()) };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * OpenHolidays' school holidays, kept to what the app uses: the dates
 * (the end is the last day off), the English name, and the regions that
 * keep it, or nationwide. Its school endpoint also returns one-day
 * markers (end of lessons, back to school), which aren't holidays.
 */
export function mapSchoolHolidays(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((h) => h && h.type === 'School' && typeof h.startDate === 'string' && DATE.test(h.startDate))
    .map((h) => {
      const names = Array.isArray(h.name) ? h.name : [];
      const name = names.find((n) => n?.language === 'EN')?.text ?? names[0]?.text ?? '';
      const regions = Array.isArray(h.subdivisions) ? h.subdivisions.map((s) => s?.code).filter((c) => typeof c === 'string') : [];
      return {
        start: h.startDate,
        end: typeof h.endDate === 'string' && DATE.test(h.endDate) ? h.endDate : h.startDate,
        name: typeof name === 'string' ? name : '',
        // One with no regions applies everywhere (Portugal splits its
        // holidays by school year group, not region).
        nationwide: h.nationwide === true || regions.length === 0,
        regions,
      };
    });
}

/** A country's school holidays in a year; a country OpenHolidays doesn't cover has none. */
export async function fetchSchoolHolidays({ country, year }, fetchImpl = fetch) {
  if (!SCHOOL_COUNTRIES.has(country)) return { supported: false, school: [] };
  const url = `${OPENHOLIDAYS}?countryIsoCode=${country}&languageIsoCode=EN&validFrom=${year}-01-01&validTo=${year}-12-31`;
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`OpenHolidays answered ${res.status}`);
  return { supported: true, school: mapSchoolHolidays(await res.json()) };
}
