import { describe, expect, test } from 'vitest';
import { needsPlaceFields, tripPlace } from './tripPlace';
import { makeHotel, makeTrip } from '../test/fixtures';

const cities = [{ name: 'Budapest', country: 'Hungary' }];

describe('tripPlace', () => {
  test('stays in one country settle the place, using the most common city', () => {
    const trip = makeTrip({ hotels: [
      makeHotel({ id: 'a', country: 'Hungary', city: 'Budapest' }), makeHotel({ id: 'b', country: 'Hungary', city: 'Budapest' }), makeHotel({ id: 'c', country: 'Hungary', city: 'Eger' }),
    ] });
    expect(tripPlace(trip)).toEqual({ country: 'Hungary', city: 'Budapest', multiCountry: false });
  });

  test('stays in more than one country: the place is not settled', () => {
    const trip = makeTrip({ hotels: [makeHotel({ id: 'a', country: 'Hungary' }), makeHotel({ id: 'b', country: 'Austria' })] });
    expect(tripPlace(trip)).toMatchObject({ multiCountry: true, country: null });
  });

  test('no stays yet: a title that is a known city places the trip', () => {
    expect(tripPlace(makeTrip({ title: 'Budapest', hotels: [] }), cities)).toEqual({ country: 'Hungary', city: 'Budapest', multiCountry: false });
    expect(tripPlace(makeTrip({ title: 'budapest ', hotels: [] }), cities).country).toBe('Hungary');
  });

  test('a city in the US is given the country name stays and card rules use', () => {
    expect(tripPlace(makeTrip({ title: 'Chicago', hotels: [] }), [{ name: 'Chicago', country: 'United States of America' }]).country).toBe('United States');
  });

  test('no stays and an unrecognised title: unknown', () => {
    expect(tripPlace(makeTrip({ title: 'Summer holiday', hotels: [] }), cities).country).toBeNull();
  });
});

describe('needsPlaceFields', () => {
  test('asked for only when the trip does not already say', () => {
    expect(needsPlaceFields(null)).toBe(true);
    expect(needsPlaceFields({ country: null, city: null, multiCountry: true })).toBe(true);
    expect(needsPlaceFields({ country: null, city: null, multiCountry: false })).toBe(true);
    expect(needsPlaceFields({ country: 'Hungary', city: 'Budapest', multiCountry: false })).toBe(false);
  });
});
