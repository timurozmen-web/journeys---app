// Deep links to external search tools, pre-filled with real details from
// the itinerary. These use publicly-documented natural-language query
// patterns (confirmed via multiple independent third-party tools that
// build Google Flights links this same way) rather than an official API,
// since neither service offers one -- worth a quick confirm that these
// still open correctly, as Google doesn't guarantee the format long-term.

export type StopsFilter = 'any' | 'nonstop' | 'one-stop';
export type CabinFilter = 'any' | 'economy' | 'premium-economy' | 'business' | 'first';
export type AllianceFilter = 'any' | 'star-alliance' | 'oneworld' | 'skyteam';

const CABIN_LABELS: Record<CabinFilter, string> = {
  any: '', economy: 'economy', 'premium-economy': 'premium economy', business: 'business class', first: 'first class',
};
const ALLIANCE_LABELS: Record<AllianceFilter, string> = {
  any: '', 'star-alliance': 'Star Alliance', oneworld: 'Oneworld', skyteam: 'SkyTeam',
};

export interface FlightSearchFilters {
  stops?: StopsFilter;
  cabin?: CabinFilter;
  alliance?: AllianceFilter;
  airline?: string; // free text, e.g. "British Airways" -- reasonably well parsed by Google's natural-language search, but less firmly confirmed than the "nonstop" keyword. Same caveat applies to alliance names.
}

export function googleFlightsSearchUrl(
  fromCity: string, toCity: string, departDateISO: string | null, returnDateISO?: string | null,
  filters?: FlightSearchFilters
): string {
  const stopsText = filters?.stops === 'nonstop' ? 'nonstop ' : filters?.stops === 'one-stop' ? '1 stop or fewer ' : '';
  const cabinText = filters?.cabin && filters.cabin !== 'any' ? `${CABIN_LABELS[filters.cabin]} ` : '';
  const tripTypeText = returnDateISO ? 'Return' : 'One-way';

  // Each clause is comma-separated and unambiguous on its own, rather than
  // stacking multiple bare "on X" phrases back to back -- that collided
  // directly when both an alliance/airline filter and a date were present
  // (e.g. "...on Oneworld on 2027-03-10..."), which is very likely what
  // broke Google's natural-language parsing when filters were combined.
  const clauses: string[] = [`${tripTypeText} ${cabinText}${stopsText}flights from ${fromCity} to ${toCity}`];
  if (departDateISO) clauses.push(`departing ${departDateISO}`);
  if (returnDateISO) clauses.push(`returning ${returnDateISO}`);
  if (filters?.alliance && filters.alliance !== 'any') clauses.push(`on ${ALLIANCE_LABELS[filters.alliance]}`);
  if (filters?.airline) clauses.push(`on ${filters.airline}`);

  const query = clauses.join(', ');
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Search directly on a hotel programme's own site where the URL pattern is
 * confidently verified, falling back to a brand-qualified Google Hotels
 * search otherwise. Only Marriott's pattern (marriott.com/en-us/destinations/
 * {country}/{city}.mi) was confirmed against multiple real international
 * examples (Japan, France, UK, Italy, Netherlands all verified working).
 * Other brands' patterns either weren't confirmed at all, or (Hilton) were
 * only confirmed for US cities -- rather than guess at a URL that might
 * 404 for a real trip, those fall back to the safer brand-qualified search.
 */
export function brandHotelSearchUrl(programmeName: string, city: string, country: string): string {
  if (programmeName === 'Marriott Bonvoy') {
    return `https://www.marriott.com/en-us/destinations/${slugify(country)}/${slugify(city)}.mi`;
  }
  return googleHotelsSearchUrlBranded(programmeName, city, country);
}

function googleHotelsSearchUrlBranded(brand: string, city: string, country: string): string {
  const query = `${brand} hotels in ${city}, ${country}`;
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(query)}`;
}

export function googleHotelsSearchUrl(city: string, country: string, checkIn: string | null, nights: number | null): string {
  let query = `Hotels in ${city}, ${country}`;
  if (checkIn && nights) {
    const checkInDate = new Date(checkIn + 'T00:00:00');
    const checkOutDate = new Date(checkInDate.getTime() + nights * 86400000);
    query += ` ${checkIn} to ${checkOutDate.toISOString().slice(0, 10)}`;
  }
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(query)}`;
}
