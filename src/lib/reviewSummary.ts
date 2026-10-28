import type { Review, ReviewPhoto } from '../types';
import { REVIEW_CATEGORIES } from './reviewScoring';

// Reviews and photos are matched to a hotel by name, as the review prompts
// are (most reviews predate the app's hotel records).
export const propertyKey = (name: string) => name.trim().toLowerCase();

export interface AspectSummary {
  key: string;
  label: string;
  score: number | null; // the average across visits, as the map's ranking uses
  count: number;
  note: string | null; // the latest visit's
  noteReviewId: string | null; // the latest visit's review, where a note edit is saved
  photos: ReviewPhoto[]; // newest first
}

export interface PropertyReview {
  hotelName: string;
  country: string;
  visits: string[]; // newest first
  overall: AspectSummary;
  aspects: AspectSummary[]; // the rest, in the order they're rated
}

const newestFirst = (a: ReviewPhoto, b: ReviewPhoto) => b.createdAt.localeCompare(a.createdAt);

// Everything known about one hotel's reviews, aspect by aspect; null when
// it has neither a review nor a photo.
export function propertyReview(name: string, reviews: Review[], photos: ReviewPhoto[]): PropertyReview | null {
  const key = propertyKey(name);
  const own = reviews.filter((r) => propertyKey(r.hotelName) === key).sort((a, b) => b.date.localeCompare(a.date));
  const ownPhotos = photos.filter((p) => propertyKey(p.hotelName) === key).sort(newestFirst);
  if (own.length === 0 && ownPhotos.length === 0) return null;

  const summary = (c: { key: string; label: string }): AspectSummary => {
    const rs = own.filter((r) => r.category === c.key);
    const latest = rs[0] ?? null;
    return {
      key: c.key,
      label: c.label,
      score: rs.length ? rs.reduce((s, r) => s + r.score, 0) / rs.length : null,
      count: rs.length,
      note: rs.find((r) => r.note?.trim())?.note?.trim() ?? null,
      noteReviewId: latest?.id ?? null,
      photos: ownPhotos.filter((p) => p.category === c.key),
    };
  };
  const [overall, ...aspects] = REVIEW_CATEGORIES.map(summary);
  const overallDates = own.filter((r) => r.category === 'overall').map((r) => r.date);
  return {
    hotelName: own[0]?.hotelName ?? ownPhotos[0].hotelName,
    country: own[0]?.country ?? '',
    visits: [...new Set(overallDates.length ? overallDates : own.map((r) => r.date))],
    overall,
    aspects,
  };
}

// The photo to show for a hotel in one aspect (a comparison card, a row
// on the map): its newest of that aspect. Overall falls back to any of the
// hotel's photos; another aspect doesn't, as a bed photo set against a
// shower would mislead.
export function aspectPhoto(photos: ReviewPhoto[], name: string, category: string): ReviewPhoto | null {
  const own = photos.filter((p) => propertyKey(p.hotelName) === propertyKey(name)).sort(newestFirst);
  return own.find((p) => p.category === category) ?? (category === 'overall' ? own[0] ?? null : null);
}

// A score's colour, the thirds the map's ranking uses.
export function scoreColour(score: number): string {
  return score >= 6.7 ? 'var(--green)' : score >= 3.4 ? 'var(--amber)' : 'var(--red)';
}

// The aspects a photo can be filed under: all but Value, which has no
// photo of its own. netlify/lib/photoAspects.js sorts into the same keys.
export const PHOTO_ASPECTS = REVIEW_CATEGORIES.filter((c) => c.key !== 'value');

// Every aspect a saved photo is filed under (one row per aspect, sharing
// the file's path).
export function photoAspects(photos: ReviewPhoto[], path: string): string[] {
  return photos.filter((p) => p.path === path).map((p) => p.category);
}

// The photos to show for a hotel, one per file however many aspects it's
// under, newest first.
export function distinctPhotos(photos: ReviewPhoto[], name: string): ReviewPhoto[] {
  const seen = new Set<string>();
  return photos
    .filter((p) => propertyKey(p.hotelName) === propertyKey(name))
    .sort(newestFirst)
    .filter((p) => (seen.has(p.path) ? false : (seen.add(p.path), true)));
}
