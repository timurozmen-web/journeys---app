// Tidying what's loaded so one real journey reads as one.

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * One stay per hotel per check-in date. The Hyatt Regency London Olympia
 * night of 26 Aug 2026 was logged twice (under its own one-night trip and
 * under the London trip), so it counted as two Hyatt nights. A room can't
 * be checked into twice on one day, and programmes credit one room a night
 * toward status anyway. Of two copies, the one with a price is kept.
 */
export function dedupeStays<T extends { name: string; date: string; total: number | null }>(stays: T[]): T[] {
  const kept = new Map<string, T>();
  for (const s of stays) {
    const key = `${norm(s.name)}|${s.date}`;
    const prev = kept.get(key);
    if (!prev || (prev.total == null && s.total != null)) kept.set(key, s);
  }
  // Keep the original order.
  const winners = new Set(kept.values());
  return stays.filter((s) => winners.has(s));
}

/**
 * Drops an empty trip that sits inside another trip of the same name. The
 * London work stint was logged as several one- and two-night "London"
 * trips; merging moved their stays into one London trip, and an empty
 * shell left inside its dates is part of that journey, not a separate one.
 * A trip with any bookings, or with a different name (a new trip being
 * planned inside those dates), always stays.
 */
export function foldEmptyTrips<T extends { id: string; title: string; start: string; end: string; hotels: unknown[]; flights: unknown[] }>(trips: T[]): T[] {
  return trips.filter((t) => {
    if (t.hotels.length > 0 || t.flights.length > 0) return true;
    return !trips.some((o) => o.id !== t.id && norm(o.title) === norm(t.title)
      && (o.hotels.length > 0 || o.flights.length > 0) && o.start <= t.start && o.end >= t.end);
  });
}
