import type { Hotel, Trip } from '../types';
import { addDays, addMonths, daysBetweenISO } from './tripDay';

// The Trips screen is one timeline for work and leisure together, opened
// at today: the last few months above the today line, everything still
// to come below it, and anything older folded into a single "earlier"
// row until it's asked for.

export const HISTORY_MONTHS = 3;

export interface TripTimeline {
  /** Older than the history window, oldest first. Folded by default. */
  earlier: Trip[];
  /** Started on or before today and inside the history window (past and under way), oldest first. */
  recent: Trip[];
  /** Starts after today, soonest first. */
  upcoming: Trip[];
}

export function buildTripTimeline(trips: Trip[], today: string, historyMonths = HISTORY_MONTHS): TripTimeline {
  const cutoff = addMonths(today, -historyMonths);
  const byStart = [...trips].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const earlier: Trip[] = [];
  const recent: Trip[] = [];
  const upcoming: Trip[] = [];
  for (const t of byStart) {
    if (t.start > today) upcoming.push(t);
    // A trip still under way stays in view however long ago it started.
    else if (t.end < cutoff) earlier.push(t);
    else recent.push(t);
  }
  return { earlier, recent, upcoming };
}

/** "2026-08" for a YYYY-MM-DD date. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** Months strictly between two dates' months that no trip touches ("2026-11", "2026-12"). */
export function emptyMonthsBetween(fromDate: string, toDate: string, trips: Trip[]): string[] {
  const busy = new Set<string>();
  for (const t of trips) {
    for (let m = monthKey(t.start); m <= monthKey(t.end); m = monthKey(addMonths(`${m}-01`, 1))) busy.add(m);
  }
  const out: string[] = [];
  for (let m = monthKey(addMonths(`${monthKey(fromDate)}-01`, 1)); m < monthKey(toDate); m = monthKey(addMonths(`${m}-01`, 1))) {
    if (!busy.has(m)) out.push(m);
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Aug" for "2026-08"; with the year ("Aug 2025") when it isn't the current year. */
export function monthLabel(month: string, today: string): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1];
  return month.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${month.slice(0, 4)}`;
}

/** "Jan – Jun 2026" for the span covered by the folded trips. */
export function spanLabel(trips: Trip[]): string {
  if (trips.length === 0) return '';
  const first = monthKey(trips[0].start);
  const last = monthKey(trips.reduce((m, t) => (t.start > m ? t.start : m), trips[0].start));
  const name = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
  if (first === last) return `${name(first)} ${first.slice(0, 4)}`;
  if (first.slice(0, 4) === last.slice(0, 4)) return `${name(first)} – ${name(last)} ${last.slice(0, 4)}`;
  return `${name(first)} ${first.slice(0, 4)} – ${name(last)} ${last.slice(0, 4)}`;
}

/** The stay you're sleeping at tonight, if any: checked in on or before today and checking out after it. */
export function tonightStay(trips: Trip[], today: string): { hotel: Hotel; trip: Trip } | null {
  for (const trip of trips) {
    for (const hotel of trip.hotels) {
      if (hotel.date <= today && today < addDays(hotel.date, hotel.nights)) return { hotel, trip };
    }
  }
  return null;
}

/** Whole days from today until a date (0 on the day itself, never negative). */
export function daysUntil(today: string, date: string): number {
  return Math.max(0, daysBetweenISO(today, date));
}

/** "17 days", "Tomorrow", "Today". */
export function countdownLabel(today: string, date: string): string {
  const d = daysUntil(today, date);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `${d} days`;
}

/** Finished trips for the Then scrapbook, newest year first and newest trip first within it. */
export function pastTripsByYear(trips: Trip[], today: string): { year: string; trips: Trip[] }[] {
  const done = trips.filter((t) => t.end < today).sort((a, b) => b.start.localeCompare(a.start));
  const out: { year: string; trips: Trip[] }[] = [];
  for (const t of done) {
    const year = t.start.slice(0, 4);
    const group = out.find((g) => g.year === year);
    if (group) group.trips.push(t);
    else out.push({ year, trips: [t] });
  }
  return out;
}
