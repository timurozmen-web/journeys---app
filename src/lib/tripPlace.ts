import type { Trip } from '../types';

export interface TripPlace {
  country: string | null;
  city: string | null;
  multiCountry: boolean;
}

// Where a trip is. The stays already on it say so; a trip with no stays yet
// is placed by its title if that is a known city ("Budapest"). Used so the
// add forms only ask for a country and city when the trip doesn't already
// answer it, i.e. it spans more than one country or the place is unknown.
export function tripPlace(trip: Pick<Trip, 'title' | 'hotels'>, cities: { name: string; country: string }[] = []): TripPlace {
  const countries = [...new Set(trip.hotels.map((h) => h.country).filter(Boolean))];
  if (countries.length > 1) return { country: null, city: null, multiCountry: true };
  if (countries.length === 1) {
    const inCountry = trip.hotels.filter((h) => h.country === countries[0] && h.city);
    const counts = new Map<string, number>();
    for (const h of inCountry) counts.set(h.city as string, (counts.get(h.city as string) ?? 0) + 1);
    const city = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { country: countries[0], city, multiCountry: false };
  }
  // The city list says 'United States of America'; stays and card rules use 'United States'.
  const match = cities.find((c) => c.name.toLowerCase() === trip.title.trim().toLowerCase());
  return match ? { country: match.country === 'United States of America' ? 'United States' : match.country, city: match.name, multiCountry: false } : { country: null, city: null, multiCountry: false };
}

// Country and city are worth asking for unless the trip settles them.
export function needsPlaceFields(place: TripPlace | null): boolean {
  return !place || place.multiCountry || !place.country;
}
