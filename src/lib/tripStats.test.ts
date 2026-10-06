import { describe, expect, it } from 'vitest';
import { groupDestinations } from './tripStats';
import { makeHotel, makeTrip } from '../test/fixtures';

describe('groupDestinations', () => {
  it('ends a stay on the right day across the clocks going forward', () => {
    const trip = makeTrip({ hotels: [makeHotel({ city: 'Lisbon', date: '2026-03-28', nights: 2 })] });
    expect(groupDestinations(trip)[0].end).toBe('2026-03-30');
  });

  it('joins consecutive stays in one place and splits on a new one', () => {
    const trip = makeTrip({ hotels: [
      makeHotel({ id: 'a', city: 'Goa', date: '2027-01-16', nights: 1 }),
      makeHotel({ id: 'b', city: 'Goa', date: '2027-01-17', nights: 2 }),
      makeHotel({ id: 'c', city: 'Madrid', date: '2027-01-15', nights: 1 }),
    ] });
    expect(groupDestinations(trip).map((d) => [d.place, d.nights, d.start])).toEqual([['Madrid', 1, '2027-01-15'], ['Goa', 3, '2027-01-16']]);
  });
});
