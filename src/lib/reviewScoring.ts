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
// trip's real end date) and it has no "overall" review logged yet.
// Matches by hotel_id where available, but falls back to matching by
// name -- the originally-imported reviews predate this app's own hotel
// records and may not have a reliable hotel_id link.
export function findHotelsNeedingReview(
  trips: { id: string; title: string; end: string; hotels: { id: string; name: string; country: string; date: string; nights: number; status: string }[] }[],
  reviews: { hotelId: string | null; hotelName: string; category: string }[],
  today: string
): HotelNeedingReview[] {
  const overallReviews = reviews.filter((r) => r.category === 'overall');
  const reviewedHotelIds = new Set(overallReviews.map((r) => r.hotelId).filter(Boolean));
  const reviewedHotelNames = new Set(overallReviews.map((r) => r.hotelName.trim().toLowerCase()));

  const result: HotelNeedingReview[] = [];
  for (const trip of trips) {
    for (const h of trip.hotels) {
      if (h.status !== 'Completed') continue;
      // The stay's own checkout must have passed -- not the whole trip's
      // end date, since a stay can genuinely finish mid-trip.
      const checkOut = new Date(new Date(h.date + 'T00:00:00').getTime() + h.nights * 86400000).toISOString().slice(0, 10);
      if (checkOut > today) continue;
      if (reviewedHotelIds.has(h.id)) continue;
      if (reviewedHotelNames.has(h.name.trim().toLowerCase())) continue;
      result.push({ tripId: trip.id, tripTitle: trip.title, hotelId: h.id, hotelName: h.name, country: h.country, date: h.date });
    }
  }
  return result;
}
