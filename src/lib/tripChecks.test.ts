import { describe, expect, test } from 'vitest';
import { checkTripCompleteness } from './tripCompleteness';
import { makeFlight, makeHotel, makeTrip } from '../test/fixtures';

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
