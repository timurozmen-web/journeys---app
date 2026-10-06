import { findHotelsMissingCategories, findHotelsNeedingReview } from './reviewScoring';
import type { DiscoverItem, Review, Trip } from '../types';

// What a count badge shows: nothing for none, the number up to 9, then "9+".
export function badgeLabel(n: number): string | null {
  if (n <= 0) return null;
  return n > 9 ? '9+' : String(n);
}

// Things waiting on the Profile screen: stays to rate, and rated stays
// missing some categories.
export function profileActionCount(trips: Trip[], reviews: Review[], today: string): number {
  return findHotelsNeedingReview(trips, reviews, today).length + findHotelsMissingCategories(trips, reviews).length;
}

// New Discover items not yet looked at (kept or dismissed).
export function newDiscoverCount(items: DiscoverItem[]): number {
  return items.filter((i) => i.status === 'new').length;
}
