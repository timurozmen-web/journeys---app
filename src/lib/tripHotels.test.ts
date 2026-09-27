import { afterEach, describe, expect, test, vi } from 'vitest';
import { destinationQuery, relevantHotel } from './tripHotels';
import { makeHotel, makeTrip } from '../test/fixtures';

describe('relevantHotel', () => {
  afterEach(() => { vi.useRealTimers(); });

  test('no hotels -> null', () => {
    expect(relevantHotel(makeTrip())).toBeNull();
  });

  test('past trip shows the first stay chronologically, not list order', () => {
    const later = makeHotel({ id: 'later', date: '2026-09-06' });
    const earlier = makeHotel({ id: 'earlier', date: '2026-09-04' });
    expect(relevantHotel(makeTrip({ hotels: [later, earlier] }))?.id).toBe('earlier');
  });

  test('current trip shows the stay happening today; checkout day belongs to the next stay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
    const first = makeHotel({ id: 'first', date: '2026-09-04', nights: 2 }); // checks out 6th
    const second = makeHotel({ id: 'second', date: '2026-09-06', nights: 2 });
    expect(relevantHotel(makeTrip({ section: 'current', hotels: [first, second] }))?.id).toBe('second');
  });
});

describe('destinationQuery', () => {
  test('picks the city with the most total nights, adding up separate stays there', () => {
    const trip = makeTrip({
      hotels: [
        makeHotel({ city: 'Lisbon', country: 'Portugal', nights: 4 }),
        makeHotel({ city: 'Faro', country: 'Portugal', nights: 2 }),
        makeHotel({ city: 'Faro', country: 'Portugal', nights: 3 }),
      ],
    });
    expect(destinationQuery(trip)).toBe('Faro, Portugal');
  });

  test('falls back to country when the hotel has no city', () => {
    const trip = makeTrip({ hotels: [makeHotel({ city: null, country: 'Iceland' })] });
    expect(destinationQuery(trip)).toBe('Iceland');
  });

  test('falls back to the first part of the trip title when there are no hotels', () => {
    expect(destinationQuery(makeTrip({ title: 'Japan · Tokyo + Kyoto' }))).toBe('Japan');
  });
});
