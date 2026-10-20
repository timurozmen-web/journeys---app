// Public holidays for any country and year, from Nager.Date: free, no key,
// open data (date.nager.at). Fetched here rather than from the browser so
// the app doesn't depend on Nager allowing cross-site requests, and so the
// answer can be cached for everyone.

const NAGER = 'https://date.nager.at/api/v3/PublicHolidays';

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
