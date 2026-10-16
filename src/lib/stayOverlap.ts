import { addDays } from './tripDay';

/**
 * The first stay whose nights overlap a new one (`date` for `nights`),
 * ignoring the stay being edited. Check-out day is free: one stay can end
 * the day the next begins. Worked in date strings with addDays: the form
 * used to add days to a local-time Date and read it back in UTC, which put
 * the end a day early across the clocks going forward.
 */
export function overlappingStay<T extends { id: string; name: string; date: string; nights: number }>(
  stays: T[], date: string, nights: number, exceptId?: string,
): T | null {
  const end = addDays(date, Math.max(1, nights));
  return stays.find((h) => h.id !== exceptId && date < addDays(h.date, h.nights) && h.date < end) ?? null;
}
