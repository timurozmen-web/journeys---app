export type ReviewIntensity = 'mild' | 'strong' | 'extreme';

export const REVIEW_CATEGORIES = [
  { key: 'overall', label: 'Overall' },
  { key: 'service', label: 'Service' },
  { key: 'value', label: 'Value' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'food', label: 'Food' },
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
// trip's real end date) and it has no "overall" review logged yet.
export function findHotelsNeedingReview(
  trips: { id: string; title: string; end: string; hotels: { id: string; name: string; country: string; date: string; status: string }[] }[],
  reviews: { hotelId: string; category: string }[],
  today: string
): HotelNeedingReview[] {
  const reviewedHotelIds = new Set(reviews.filter((r) => r.category === 'overall').map((r) => r.hotelId));
  const result: HotelNeedingReview[] = [];
  for (const trip of trips) {
    if (trip.end >= today) continue; // trip hasn't actually finished yet
    for (const h of trip.hotels) {
      if (h.status !== 'Completed') continue;
      if (reviewedHotelIds.has(h.id)) continue;
      result.push({ tripId: trip.id, tripTitle: trip.title, hotelId: h.id, hotelName: h.name, country: h.country, date: h.date });
    }
  }
  return result;
}
