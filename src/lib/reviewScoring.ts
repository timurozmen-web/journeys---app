export type ReviewIntensity = 'mild' | 'strong' | 'extreme';

export const REVIEW_CATEGORIES = [
  { key: 'overall', label: 'Overall' },
  { key: 'service', label: 'Service' },
  { key: 'value', label: 'Value' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'food', label: 'Food' },
  { key: 'shower', label: 'Shower' },
];

// Liked -> top band (6-10), not liked -> bottom band (1-5). Intensity
// picks the position within that band -- this is the real, deterministic
// "system" a like/dislike choice maps through, rather than an arbitrary
// fixed score.
export function computeBucketScore(liked: boolean, intensity: ReviewIntensity): number {
  if (liked) {
    if (intensity === 'mild') return 6;
    if (intensity === 'strong') return 8;
    return 10;
  }
  if (intensity === 'mild') return 5;
  if (intensity === 'strong') return 3;
  return 1;
}

export const INTENSITY_LABELS: Record<ReviewIntensity, { liked: string; disliked: string }> = {
  mild: { liked: 'It was good', disliked: "Wasn't great" },
  strong: { liked: 'Really good', disliked: 'Disappointing' },
  extreme: { liked: 'One of the best', disliked: 'Avoid' },
};

export interface HotelNeedingReview {
  tripId: string;
  tripTitle: string;
  hotelId: string;
  hotelName: string;
  country: string;
  date: string;
}

// A hotel needs review once its trip has actually finished (not just
// "past" by section label, which can be stale -- checked against the
// trip's real end date) and this specific stay hasn't been reviewed yet.
// Repeat stays at the same property genuinely can trigger a new review
// (opinions change), capped at 3 reviews total per property -- past that,
// the property's score is considered settled and stops prompting.
const MAX_REVIEWS_PER_PROPERTY = 3;

export function findHotelsNeedingReview(
  trips: { id: string; title: string; end: string; hotels: { id: string; name: string; country: string; date: string; nights: number; status: string }[] }[],
  reviews: { hotelId: string | null; hotelName: string; category: string }[],
  today: string
): HotelNeedingReview[] {
  const overallReviews = reviews.filter((r) => r.category === 'overall');
  const reviewCountByName = new Map<string, number>();
  for (const r of overallReviews) {
    const key = r.hotelName.trim().toLowerCase();
    reviewCountByName.set(key, (reviewCountByName.get(key) ?? 0) + 1);
  }

  // Group every genuinely-finished stay by property, oldest first. Matching
  // by name+count rather than by hotel_id, since most historically-imported
  // reviews predate this app's hotel records and don't have a reliable id
  // link -- id matching alone left almost nothing recognised as "already
  // reviewed" and flagged every past stay at once.
  const stopsByProperty = new Map<string, { trip: (typeof trips)[number]; hotel: (typeof trips)[number]['hotels'][number] }[]>();
  for (const trip of trips) {
    for (const h of trip.hotels) {
      if (h.status !== 'Completed') continue;
      // The stay's own checkout must have passed -- not the whole trip's
      // end date, since a stay can genuinely finish mid-trip.
      const checkOut = new Date(new Date(h.date + 'T00:00:00').getTime() + h.nights * 86400000).toISOString().slice(0, 10);
      if (checkOut > today) continue;
      const key = h.name.trim().toLowerCase();
      const arr = stopsByProperty.get(key) ?? [];
      arr.push({ trip, hotel: h });
      stopsByProperty.set(key, arr);
    }
  }

  const result: HotelNeedingReview[] = [];
  for (const [key, stops] of stopsByProperty) {
    const reviewedCount = reviewCountByName.get(key) ?? 0;
    if (reviewedCount >= MAX_REVIEWS_PER_PROPERTY) continue; // property's score is settled
    if (reviewedCount >= stops.length) continue; // no stay beyond what's already been reviewed
    // Only the next chronologically-unreviewed stay -- not every stay past
    // the reviewed count at once, so a property with several old
    // never-reviewed stays prompts one at a time instead of all together.
    const sorted = [...stops].sort((a, b) => a.hotel.date.localeCompare(b.hotel.date));
    const next = sorted[reviewedCount];
    result.push({ tripId: next.trip.id, tripTitle: next.trip.title, hotelId: next.hotel.id, hotelName: next.hotel.name, country: next.hotel.country, date: next.hotel.date });
  }
  return result;
}
