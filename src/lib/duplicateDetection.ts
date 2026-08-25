import type { Hotel, Flight } from '../types';
import { normalizeBrand } from '../data/brandMap';

/**
 * Finds a likely-duplicate existing hotel stay for a newly-extracted one --
 * same brand and a check-in date within a day of each other (allowing for
 * timezone/rounding differences in how a confirmation states the date).
 * Used to warn before creating a second entry for a stay that's probably
 * already logged, rather than silently allowing duplicates once scanning
 * makes it easy to re-extract the same confirmation twice.
 */
export function findLikelyDuplicateHotel(
  extracted: { name: string; brand: string | null; checkIn: string | null },
  existing: Hotel[]
): Hotel | null {
  if (!extracted.checkIn) return null;
  const extractedBrand = extracted.brand ? normalizeBrand(extracted.brand) : null;
  const target = new Date(extracted.checkIn).getTime();

  return (
    existing.find((h) => {
      const sameBrand = extractedBrand ? h.brand === extractedBrand : h.name.trim().toLowerCase() === extracted.name.trim().toLowerCase();
      if (!sameBrand) return false;
      const diffDays = Math.abs(new Date(h.date).getTime() - target) / 86400000;
      return diffDays <= 1;
    }) ?? null
  );
}

/** Same idea for flights: same date, same route, in either direction. */
export function findLikelyDuplicateFlight(
  extracted: { date: string | null; from: string | null; to: string | null },
  existing: Flight[]
): Flight | null {
  if (!extracted.date || !extracted.from || !extracted.to) return null;
  return (
    existing.find(
      (f) =>
        f.date === extracted.date &&
        ((f.from === extracted.from && f.to === extracted.to) || (f.from === extracted.to && f.to === extracted.from))
    ) ?? null
  );
}
