import type { Trip } from '../types';
import { addDays } from './tripDay';

// The hotel worth showing at a glance: whichever stay is actually
// happening right now if the trip is under way, otherwise the first stay
// chronologically -- not just whatever order the hotels happen to be in.
export function relevantHotel(t: Trip): Trip['hotels'][number] | null {
  if (t.hotels.length === 0) return null;
  const sorted = [...t.hotels].sort((a, b) => a.date.localeCompare(b.date));
  if (t.section === 'current') {
    const today = new Date().toISOString().slice(0, 10);
    const ongoing = sorted.find((h) => {
      const checkOut = addDays(h.date, h.nights);
      return h.date <= today && today < checkOut;
    });
    if (ongoing) return ongoing;
  }
  return sorted[0];
}

// The city/country the trip is really "about" -- most total nights spent
// there, aggregating stays that share a city (a 2-night stop plus a
// 5-night stop in the same city count as 7, not two separate 2s and 5s).
// Used for the destination photo, so a one-night stopover doesn't end up
// picking the photo for a multi-city trip.
function featuredHotel(t: Trip): Trip['hotels'][number] | null {
  if (t.hotels.length === 0) return null;
  const byPlace = new Map<string, { nights: number; hotel: Trip['hotels'][number] }>();
  for (const h of t.hotels) {
    const key = `${h.city ?? ''}|${h.country}`;
    const existing = byPlace.get(key);
    if (existing) existing.nights += h.nights;
    else byPlace.set(key, { nights: h.nights, hotel: h });
  }
  let best: { nights: number; hotel: Trip['hotels'][number] } | null = null;
  for (const v of byPlace.values()) {
    if (!best || v.nights > best.nights) best = v;
  }
  return best?.hotel ?? null;
}

// Most-specific-first, same rule everywhere a destination photo is looked
// up: city + country beats country alone, which beats the trip's own
// title. A Faro stay should surface Faro's own photo, not a generic
// Portugal one.
export function destinationQuery(t: Trip) {
  const hotel = featuredHotel(t);
  if (hotel?.city) return `${hotel.city}, ${hotel.country}`;
  return hotel?.country?.trim() || t.title.split(/[·+]/)[0].trim();
}
