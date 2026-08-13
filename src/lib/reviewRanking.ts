export type Sentiment = 'liked' | 'okay' | 'disliked';

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  liked: 'Liked it',
  okay: 'It was okay',
  disliked: "Didn't like it",
};

interface Band {
  min: number;
  max: number;
}

const BANDS: Record<Sentiment, Band> = {
  liked: { min: 7, max: 10 },
  okay: { min: 4, max: 6.9 },
  disliked: { min: 1, max: 3.9 },
};

export interface RankedItem {
  hotelName: string;
  score: number;
}

/**
 * Given the sentiment band and the existing same-category, same-band
 * reviews (any order), returns the comparison candidate for a binary
 * search insertion, narrowing `lo`/`hi` indices into the band's
 * score-descending list. Returns null once bounds have converged --
 * meaning the insertion point is found and a final score can be computed.
 */
export function pickComparisonCandidate(
  sameBand: RankedItem[],
  lo: number,
  hi: number
): RankedItem | null {
  if (lo >= hi) return null;
  const mid = Math.floor((lo + hi) / 2);
  return sameBand[mid];
}

// Narrows the search range based on whether the new stay was preferred
// over the comparison candidate at `mid`.
export function narrowRange(lo: number, hi: number, mid: number, preferredNew: boolean): { lo: number; hi: number } {
  return preferredNew ? { lo, hi: mid } : { lo: mid + 1, hi };
}

/**
 * Once lo === hi (the insertion index is found), compute the final score
 * by interpolating between whichever two existing items (or band edges)
 * the new item landed between.
 */
export function computeFinalScore(sentiment: Sentiment, sameBandSorted: RankedItem[], insertionIndex: number): number {
  const band = BANDS[sentiment];
  const above = insertionIndex > 0 ? sameBandSorted[insertionIndex - 1].score : band.max;
  const below = insertionIndex < sameBandSorted.length ? sameBandSorted[insertionIndex].score : band.min;
  const score = (above + below) / 2;
  // Round to 2dp -- 1dp was rounding away the actual interpolated
  // midpoint in cases like (10 + 9.7) / 2 = 9.85.
  return Math.min(band.max, Math.max(band.min, Math.round(score * 100) / 100));
}

export function sortedSameBand(sentiment: Sentiment, existing: RankedItem[]): RankedItem[] {
  const band = BANDS[sentiment];
  return existing.filter((r) => r.score >= band.min && r.score <= band.max).sort((a, b) => b.score - a.score);
}
