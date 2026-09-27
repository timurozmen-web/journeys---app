import { describe, expect, test } from 'vitest';
import { computeBucketScore } from './reviewScoring';
import { checkTripCompleteness } from './tripCompleteness';
import { makeFlight, makeHotel, makeTrip } from '../test/fixtures';

describe('computeBucketScore', () => {
  test('liked lands in 6-10, disliked in 1-5, by intensity', () => {
    expect([computeBucketScore(true, 'mild'), computeBucketScore(true, 'strong'), computeBucketScore(true, 'extreme')]).toEqual([6, 8, 10]);
    expect([computeBucketScore(false, 'mild'), computeBucketScore(false, 'strong'), computeBucketScore(false, 'extreme')]).toEqual([5, 3, 1]);
  });
});

describe('checkTripCompleteness', () => {
  test('a trip with no hotel is never flagged', () => {
    expect(checkTripCompleteness(makeTrip())).toBeNull();
  });

  test('hotel with no flights is missing both ways', () => {
    expect(checkTripCompleteness(makeTrip({ hotels: [makeHotel()] }))).toEqual({ missingOutbound: true, missingReturn: true });
  });

  test('one flight -> only the return is missing; two -> complete', () => {
    expect(checkTripCompleteness(makeTrip({ hotels: [makeHotel()], flights: [makeFlight()] }))).toEqual({ missingOutbound: false, missingReturn: true });
    expect(checkTripCompleteness(makeTrip({ hotels: [makeHotel()], flights: [makeFlight(), makeFlight({ id: 'f2' })] }))).toBeNull();
  });
});
