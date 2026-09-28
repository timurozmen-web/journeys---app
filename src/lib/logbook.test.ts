import { describe, expect, test } from 'vitest';
import { averageOverall, nightsByCountry, nightsByYear, shareOfWorld, travellingSince, tripsTaken } from './logbook';
import { makeHotel, makeTrip } from '../test/fixtures';
import type { Review } from '../types';

const stays = [
  makeHotel({ id: 'a', country: 'Turkey', nights: 5, date: '2025-07-01' }),
  makeHotel({ id: 'b', country: 'Turkey', nights: 3, date: '2026-08-13' }),
  makeHotel({ id: 'c', country: 'United Kingdom', nights: 2, date: '2024-08-22' }),
  makeHotel({ id: 'd', country: 'Japan', nights: 9, date: '2027-04-10', status: 'Booked' }),
];

describe('nightsByCountry', () => {
  test('adds up completed stays per country, most nights first', () => {
    expect(nightsByCountry(stays)).toEqual([
      { country: 'Turkey', nights: 8, stays: 2 },
      { country: 'United Kingdom', nights: 2, stays: 1 },
    ]);
  });

  test('booked stays are not in the logbook yet', () => {
    expect(nightsByCountry(stays).map((r) => r.country)).not.toContain('Japan');
  });
});

describe('nightsByYear', () => {
  test('nights and distinct countries per year, in order', () => {
    expect(nightsByYear(stays)).toEqual([
      { year: 2024, nights: 2, countries: 1 },
      { year: 2025, nights: 5, countries: 1 },
      { year: 2026, nights: 3, countries: 1 },
    ]);
  });
});

describe('travellingSince', () => {
  test('month and year of the first completed stay', () => {
    expect(travellingSince(stays)).toBe('August 2024');
    expect(travellingSince([])).toBeNull();
  });
});

describe('shareOfWorld', () => {
  test('against 195 countries', () => {
    expect(shareOfWorld(19)).toBe(10);
    expect(shareOfWorld(0)).toBe(0);
  });
});

describe('tripsTaken', () => {
  test('counts trips that have started, not future plans', () => {
    const trips = [makeTrip({ id: 'p', start: '2026-07-25' }), makeTrip({ id: 'f', start: '2027-01-16' })];
    expect(tripsTaken(trips, '2026-09-28').map((t) => t.id)).toEqual(['p']);
  });
});

describe('averageOverall', () => {
  const r = (score: number, category = 'overall'): Review => ({ id: String(score), hotelId: null, hotelName: 'H', country: 'X', date: '2026-01-01', category, score });
  test('averages overall ratings only', () => {
    expect(averageOverall([r(8), r(10), r(2, 'food')])).toEqual({ avg: 9, count: 2 });
    expect(averageOverall([])).toEqual({ avg: null, count: 0 });
  });
});
