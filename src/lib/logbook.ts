// Totals for the Profile "logbook": what's actually been travelled, so
// only completed stays and trips that have begun count -- a booked trip
// next spring isn't in the logbook yet.
import type { Hotel, Review, Trip } from '../types';

export interface CountryNights { country: string; nights: number; stays: number }
export interface YearNights { year: number; nights: number; countries: number }

export function completedStays(hotels: Hotel[]): Hotel[] {
  return hotels.filter((h) => h.status === 'Completed');
}

export function nightsByCountry(hotels: Hotel[]): CountryNights[] {
  const m = new Map<string, CountryNights>();
  for (const h of completedStays(hotels)) {
    const country = h.country.trim();
    if (!country) continue;
    const row = m.get(country) ?? { country, nights: 0, stays: 0 };
    row.nights += h.nights;
    row.stays += 1;
    m.set(country, row);
  }
  return [...m.values()].sort((a, b) => b.nights - a.nights || a.country.localeCompare(b.country));
}

export function nightsByYear(hotels: Hotel[]): YearNights[] {
  const m = new Map<number, { nights: number; countries: Set<string> }>();
  for (const h of completedStays(hotels)) {
    const year = Number(h.date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const row = m.get(year) ?? { nights: 0, countries: new Set<string>() };
    row.nights += h.nights;
    row.countries.add(h.country.trim());
    m.set(year, row);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, r]) => ({ year, nights: r.nights, countries: r.countries.size }));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "August 2024" -- the month of the earliest completed stay.
export function travellingSince(hotels: Hotel[]): string | null {
  const first = completedStays(hotels).map((h) => h.date).filter(Boolean).sort()[0];
  if (!first) return null;
  return `${MONTHS[Number(first.slice(5, 7)) - 1]} ${first.slice(0, 4)}`;
}

// Share of the world's countries visited, against 195: the 193 UN member
// states plus its two observer states (Holy See, Palestine) -- the usual
// basis for "countries of the world" counts.
export const WORLD_COUNTRIES = 195;
export function shareOfWorld(countries: number): number {
  return Math.round((countries / WORLD_COUNTRIES) * 100);
}

// Trips that have started (so under way or past), not future plans.
export function tripsTaken(trips: Trip[], today: string): Trip[] {
  return trips.filter((t) => t.start <= today);
}

export function averageOverall(reviews: Review[]): { avg: number | null; count: number } {
  const overall = reviews.filter((r) => r.category === 'overall');
  if (overall.length === 0) return { avg: null, count: 0 };
  return { avg: overall.reduce((s, r) => s + r.score, 0) / overall.length, count: overall.length };
}
