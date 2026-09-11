import type { Trip } from '../types';

// Parsed as explicit local midnight, not left to the Date constructor's
// UTC-for-date-only-strings default -- that mismatch against Date.now()
// (local time) was producing off-by-one results near midnight.
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

// Adds days to a Y-M-D date string and returns a Y-M-D string back, done
// entirely in UTC so it's safe regardless of the browser's timezone.
// The bug this replaces: parsing "date + 'T00:00:00'" gives *local*
// midnight, and adding milliseconds then calling toISOString() (always
// UTC) can shift the result by a day depending on the local UTC offset --
// e.g. a hotel checkout computed this way came out a day early for
// anyone in a positive UTC offset (BST included). Date.UTC + setUTCDate
// never touches local time, so there's nothing to shift.
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// "Day X of Y" for a trip. Y is the span from start to end (a 4–8 Sep
// stay is 4 days, not 5) -- the one previous bug here was adding 1 to
// the total as well as the index. X is clamped into [1, Y] so a trip
// that hasn't started yet or has already ended still shows something
// sane rather than a negative or run-away number.
export function tripDayInfo(trip: Trip, today: string): { dayIndex: number; totalDays: number } {
  const totalDays = Math.max(1, daysBetween(trip.start, trip.end));
  const dayIndex = Math.min(totalDays, Math.max(1, daysBetween(trip.start, today) + 1));
  return { dayIndex, totalDays };
}
