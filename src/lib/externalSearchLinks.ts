// Deep links to external search tools, pre-filled with real details from
// the itinerary. These use publicly-documented natural-language query
// patterns (confirmed via multiple independent third-party tools that
// build Google Flights links this same way) rather than an official API,
// since neither service offers one -- worth a quick confirm that these
// still open correctly, as Google doesn't guarantee the format long-term.

export function googleFlightsSearchUrl(
  fromCity: string, toCity: string, departDateISO: string | null, returnDateISO?: string | null
): string {
  const departText = departDateISO ? ` on ${departDateISO}` : '';
  const query = returnDateISO
    ? `Return flights from ${fromCity} to ${toCity}${departText} returning ${returnDateISO}`
    : `One-way flights from ${fromCity} to ${toCity}${departText}`;
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
