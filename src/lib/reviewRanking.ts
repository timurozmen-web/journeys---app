// An aspect of a stay is scored out of 10 by hand, then "which was better?"
// orders it only among the other stays given the same score in that
// aspect. The score stays what was given (an 8 is stored between 7.5 and
// 8.49, so it always reads as an 8) and the comparisons are only ever
// about near-equals: none when nothing else has that score, two or three
// at most in practice. It replaced liked / fine / didn't like followed by
// a binary search across a whole third of the scale, which took many more
// comparisons and could land a stay well away from what it deserved.

export interface RankedItem {
  hotelName: string;
  score: number;
}

// The whole score a stored one reads as: 8.49 is an 8, 8.5 a 9.
export function wholeScore(score: number): number {
  return Math.min(10, Math.max(1, Math.round(score)));
}

// The stays a new score of `n` is compared against: those with the same
// whole score in that aspect, best first, leaving out the hotel being
// rated (re-rating W Melbourne asked "W Melbourne or W Melbourne?").
export function sameScore(n: number, existing: RankedItem[], ratingHotel?: string): RankedItem[] {
  const self = ratingHotel?.trim().toLowerCase();
  return existing
    .filter((r) => wholeScore(r.score) === n && r.hotelName.trim().toLowerCase() !== self)
    .sort((a, b) => b.score - a.score);
}

// The next stay to compare against while placing between `lo` and `hi`
// (indices into the best-first list); null once the place is found.
export function pickComparisonCandidate(sorted: RankedItem[], lo: number, hi: number): RankedItem | null {
  if (lo >= hi) return null;
  return sorted[Math.floor((lo + hi) / 2)];
}

// Narrows the search on whether the new stay was preferred over the one at `mid`.
export function narrowRange(lo: number, hi: number, mid: number, preferredNew: boolean): { lo: number; hi: number } {
  return preferredNew ? { lo, hi: mid } : { lo: mid + 1, hi };
}

// The stored score for a stay given `n` and placed at `index` among the
// same-score stays (best first): halfway between its neighbours, or the
// edge of the whole score. Alone, it is exactly `n`.
export function placedScore(n: number, sorted: RankedItem[], index: number): number {
  if (sorted.length === 0) return n;
  const top = n === 10 ? 10 : n + 0.49;
  const bottom = n === 1 ? 1 : n - 0.5;
  const above = index > 0 ? sorted[index - 1].score : top;
  const below = index < sorted.length ? sorted[index].score : bottom;
  // 2dp: 1dp rounded away midpoints like (10 + 9.7) / 2 = 9.85.
  const score = Math.round(((above + below) / 2) * 100) / 100;
  return Math.min(top, Math.max(bottom, score));
}
