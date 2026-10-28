import { describe, expect, it } from 'vitest';
import { computeFinalScore, sortedSameBand } from './reviewRanking';

describe('sortedSameBand', () => {
  const existing = [
    { hotelName: 'Park Hyatt Tokyo', score: 9.6 },
    { hotelName: 'W Melbourne', score: 8.6 },
    { hotelName: 'Hilton Dalaman', score: 7.4 },
    { hotelName: 'Ibis Leeds', score: 3.2 },
  ];
  it('keeps the band\'s stays, best first', () => {
    expect(sortedSameBand('liked', existing).map((r) => r.hotelName)).toEqual(['Park Hyatt Tokyo', 'W Melbourne', 'Hilton Dalaman']);
  });
  // Re-rating W Melbourne asked "W Melbourne or W Melbourne?" against
  // its own earlier rating.
  it('leaves out the hotel being rated, whatever its case', () => {
    expect(sortedSameBand('liked', existing, ' w melbourne').map((r) => r.hotelName)).toEqual(['Park Hyatt Tokyo', 'Hilton Dalaman']);
  });
  it('scores a hotel with nothing else in its band at the band\'s middle', () => {
    expect(computeFinalScore('liked', sortedSameBand('liked', [{ hotelName: 'W Melbourne', score: 8.6 }], 'W Melbourne'), 0)).toBe(8.5);
  });
});
