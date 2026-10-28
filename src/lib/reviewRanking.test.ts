import { describe, expect, it } from 'vitest';
import { narrowRange, pickComparisonCandidate, placedScore, sameScore, wholeScore } from './reviewRanking';

const existing = [
  { hotelName: 'Park Hyatt Tokyo', score: 8.3 },
  { hotelName: 'W Melbourne', score: 8.0 },
  { hotelName: 'Hilton Dalaman', score: 7.6 },
  { hotelName: 'Marriott Marble Arch', score: 8.6 },
  { hotelName: 'Ibis Leeds', score: 3.2 },
];

describe('sameScore', () => {
  it('compares only with stays given the same whole score, best first', () => {
    expect(sameScore(8, existing).map((r) => r.hotelName)).toEqual(['Park Hyatt Tokyo', 'W Melbourne', 'Hilton Dalaman']);
    expect(sameScore(5, existing)).toEqual([]);
  });
  // Re-rating W Melbourne asked "W Melbourne or W Melbourne?" against
  // its own earlier rating.
  it('leaves out the hotel being rated, whatever its case', () => {
    expect(sameScore(8, existing, ' w melbourne').map((r) => r.hotelName)).toEqual(['Park Hyatt Tokyo', 'Hilton Dalaman']);
  });
  it('reads a stored score as the whole score it rounds to', () => {
    expect([wholeScore(8.49), wholeScore(8.5), wholeScore(10), wholeScore(1)]).toEqual([8, 9, 10, 1]);
  });
});

describe('placedScore', () => {
  const eights = sameScore(8, existing);
  it('is exactly the score given when nothing else has it', () => {
    expect(placedScore(6, [], 0)).toBe(6);
  });
  it('places between its neighbours and always reads as the score given', () => {
    expect(placedScore(8, eights, 0)).toBe(8.4); // above Park Hyatt's 8.3
    expect(placedScore(8, eights, 1)).toBe(8.15);
    expect(placedScore(8, eights, 3)).toBe(7.55); // below Hilton's 7.6
    for (let i = 0; i <= eights.length; i++) expect(wholeScore(placedScore(8, eights, i))).toBe(8);
  });
  it('keeps 10 and 1 inside the scale', () => {
    expect(placedScore(10, [{ hotelName: 'A', score: 10 }], 0)).toBe(10);
    expect(placedScore(1, [{ hotelName: 'A', score: 1 }], 1)).toBe(1);
  });
  it('needs two comparisons to place among three', () => {
    let lo = 0, hi = eights.length, asked = 0;
    while (pickComparisonCandidate(eights, lo, hi)) {
      const mid = Math.floor((lo + hi) / 2);
      ({ lo, hi } = narrowRange(lo, hi, mid, eights[mid].score < 8.1)); // better than the 8.0 and below, worse than 8.3
      asked++;
    }
    expect(asked).toBe(2);
    expect(placedScore(8, eights, lo)).toBe(8.15);
  });
});
