// Deep links to external search tools, pre-filled with real details from
// the itinerary. These use publicly-documented natural-language query
// patterns (confirmed via multiple independent third-party tools that
// build Google Flights links this same way) rather than an official API,
// since neither service offers one -- worth a quick confirm that these
// still open correctly, as Google doesn't guarantee the format long-term.

export type StopsFilter = 'any' | 'nonstop' | 'one-stop';

export interface FlightSearchFilters {
  stops?: StopsFilter;
  airline?: string; // free text, e.g. "British Airways" -- reasonably well parsed by Google's natural-language search, but less firmly confirmed than the "nonstop" keyword
}

export function googleFlightsSearchUrl(
  fromCity: string, toCity: string, departDateISO: string | null, returnDateISO?: string | null,
  filters?: FlightSearchFilters
): string {
  const departText = departDateISO ? ` on ${departDateISO}` : '';
  const stopsText = filters?.stops === 'nonstop' ? 'nonstop ' : filters?.stops === 'one-stop' ? '1 stop or fewer ' : '';
  const airlineText = filters?.airline ? ` on ${filters.airline}` : '';
  const query = returnDateISO
    ? `Return ${stopsText}flights from ${fromCity} to ${toCity}${airlineText}${departText} returning ${returnDateISO}`
    : `One-way ${stopsText}flights from ${fromCity} to ${toCity}${airlineText}${departText}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
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
