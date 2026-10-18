import type { Flight, Hotel, Promotion, Trip } from '../types';
import { addDays, daysBetweenISO } from './tripDay';
import { promoBonusForStay } from './promoBonus';

// The Today screen: tonight's stay, what's next, and the few things that
// need doing. Everything here is worked out from the bookings themselves.

export type NextItem =
  | { kind: 'stay'; date: string; hotel: Hotel; trip: Trip }
  | { kind: 'flight'; date: string; flight: Flight; trip: Trip }
  /** Nights inside a trip under way with no stay booked: `date` is the first, `last` the last. */
  | { kind: 'gap'; date: string; last: string; nights: number; trip: Trip }
  | { kind: 'trip'; date: string; trip: Trip };

/** Is someone booked to sleep somewhere on this night (a stay, or an overnight flight)? */
function nightCovered(trip: Trip, night: string): boolean {
  return trip.hotels.some((h) => h.date <= night && night < addDays(h.date, h.nights))
    || trip.flights.some((f) => f.overnight && f.date === night);
}

/**
 * Runs of nights in a trip with nowhere booked, from `from` up to the
 * night before the trip ends (its end date is the day you leave). Each run
 * is its first and last night.
 */
export function uncoveredNights(trip: Trip, from: string, until: string = trip.end): { first: string; last: string; nights: number }[] {
  const runs: { first: string; last: string; nights: number }[] = [];
  for (let n = from < trip.start ? trip.start : from; n < trip.end && n < until; n = addDays(n, 1)) {
    if (nightCovered(trip, n)) continue;
    const prev = runs[runs.length - 1];
    if (prev && addDays(prev.last, 1) === n) { prev.last = n; prev.nights += 1; }
    else runs.push({ first: n, last: n, nights: 1 });
  }
  return runs;
}

/**
 * What's coming after tonight: the rest of any trip under way (stays,
 * flights and unbooked nights over the next `horizonDays`), then the next
 * trip to start. With nothing under way, the next two trips.
 */
export function nextUp(trips: Trip[], today: string, horizonDays = 21): NextItem[] {
  const horizon = addDays(today, horizonDays);
  const items: NextItem[] = [];
  const current = trips.filter((t) => t.start <= today && today <= t.end);
  for (const trip of current) {
    for (const hotel of trip.hotels) {
      if (hotel.date > today && hotel.date <= horizon) items.push({ kind: 'stay', date: hotel.date, hotel, trip });
    }
    for (const flight of trip.flights) {
      if (flight.date && flight.date >= today && flight.date <= horizon) items.push({ kind: 'flight', date: flight.date, flight, trip });
    }
    // Tonight counts too: with no stay booked for it, it starts the gap.
    for (const run of uncoveredNights(trip, today, horizon)) {
      items.push({ kind: 'gap', date: run.first, last: run.last, nights: run.nights, trip });
    }
  }
  const upcoming = trips.filter((t) => t.start > today).sort((a, b) => a.start.localeCompare(b.start));
  for (const trip of upcoming.slice(0, current.length > 0 ? 1 : 2)) items.push({ kind: 'trip', date: trip.start, trip });
  // Same day: a flight before a check-in, and the next trip last.
  const order = { flight: 0, stay: 1, gap: 2, trip: 3 } as const;
  return items.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * The date to register for a promotion by, read from its wording
 * ("Register by 13 Nov 2026", "register by November 13, 2026"), or null
 * when it doesn't say.
 */
export function registrationDeadline(p: Pick<Promotion, 'title' | 'description'>): string | null {
  const text = `${p.title} ${p.description ?? ''}`.toLowerCase();
  const dmy = text.match(/register(?:\s+\w+){0,3}?\s+by\s+(\d{1,2})\s+([a-z]{3})[a-z]*,?\s+(\d{4})/);
  const mdy = text.match(/register(?:\s+\w+){0,3}?\s+by\s+([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/);
  const parts = dmy ? [dmy[1], dmy[2], dmy[3]] : mdy ? [mdy[2], mdy[1], mdy[3]] : null;
  if (!parts) return null;
  const [day, mon, year] = parts;
  const m = MONTHS.indexOf(mon);
  if (m < 0) return null;
  return `${year}-${String(m + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export interface PromoToRegister {
  promotion: Promotion;
  deadline: string;
  /** Bonus points the booked stays would earn once registered. */
  points: number;
}

/**
 * Promotions that need registering before a deadline still to come, and
 * would pay out on stays already booked. A promotion nothing booked would
 * earn from isn't worth a reminder, nor is one already registered. `only`
 * limits the stays it pays out on (one trip's) while `stays` is every stay,
 * for bonuses counted across them.
 */
export function promosToRegister(promotions: Promotion[], stays: Hotel[], today: string, only: Hotel[] = stays): PromoToRegister[] {
  const out: PromoToRegister[] = [];
  for (const p of promotions) {
    if (p.registered) continue;
    const deadline = registrationDeadline(p);
    if (!deadline || deadline < today) continue;
    const points = only
      .filter((h) => h.status === 'Booked' && h.date >= today)
      .reduce((s, h) => s + promoBonusForStay(h, stays, [p]), 0);
    if (points > 0) out.push({ promotion: p, deadline, points });
  }
  return out.sort((a, b) => a.deadline.localeCompare(b.deadline));
}

export interface Place { lat: number; lng: number; city: string }

const NEAR_KM = 150;
function km(a: Place, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Flights a trip still needs, judged from the ones it has: a journey that
 * starts somewhere other than home needs a flight there first, and one
 * whose last flight doesn't land back where it began (or at home) needs a
 * flight home. Airports within 150km count as one place, so Gatwick out
 * and Heathrow back is a round trip. Null when nothing is missing, or the
 * airports can't be placed.
 */
export function missingFlights(trip: Trip, locate: (iata: string) => Place | null, home: { lat: number; lng: number } | null): { toStart: string | null; home: boolean } | null {
  const flights = trip.flights.filter((f) => f.date).sort((a, b) => a.date!.localeCompare(b.date!));
  if (flights.length === 0) return null;
  const start = locate(flights[0].from.trim().toUpperCase());
  const end = locate(flights[flights.length - 1].to.trim().toUpperCase());
  if (!start || !end) return null;
  // "Helsinki (Vantaa)" reads as Helsinki.
  const toStart = home && km(start, home) > NEAR_KM ? start.city.replace(/\s*\(.*\)$/, '') : null;
  const backHome = km(end, start) <= NEAR_KM || (home != null && km(end, home) <= NEAR_KM);
  return toStart || !backHome ? { toStart, home: !backHome } : null;
}

/** "No flight to Helsinki or home", "No flight home". */
export function missingFlightsLabel(m: { toStart: string | null; home: boolean }): string {
  if (m.toStart && m.home) return `No flight to ${m.toStart} or home`;
  if (m.toStart) return `No flight to ${m.toStart}`;
  return 'No flight home';
}

/** "Thu" for a date. */
export function weekdayShort(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Whole days from today to a date, never negative. */
export function daysTo(today: string, date: string): number {
  return Math.max(0, daysBetweenISO(today, date));
}

/** "Marriott Fall 2026" for a promotion titled "Fall 2026: 1,500 bonus points…" under Marriott Bonvoy. */
export function promoShortName(p: Pick<Promotion, 'title' | 'brand'>): string {
  const head = p.title.split(/[:–—]/)[0].trim();
  const brand = p.brand?.split(' ')[0] ?? '';
  return brand && !head.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${head}` : head;
}

/** "13 Nov" */
export function dayMonthShort(date: string): string {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(date.slice(8, 10))} ${MON[Number(date.slice(5, 7)) - 1]}`;
}

/** Nights a trip spends away: its stays, or the span of its dates when none are logged. */
export function tripNights(trip: Pick<Trip, 'start' | 'end' | 'hotels'>): number {
  const stays = trip.hotels.reduce((s, h) => s + h.nights, 0);
  return stays > 0 ? stays : Math.max(0, daysBetweenISO(trip.start, trip.end));
}
