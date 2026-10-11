import { describe, expect, it } from 'vitest';
import { dedupeStays, foldEmptyTrips } from './tripFold';
import { makeHotel, makeTrip } from '../test/fixtures';

describe('dedupeStays', () => {
  it('counts a stay logged twice once, keeping the copy with a price', () => {
    const a = makeHotel({ id: 'a', name: 'Hyatt Regency London Olympia', date: '2026-08-26', total: null });
    const b = makeHotel({ id: 'b', name: 'Hyatt Regency London  Olympia ', date: '2026-08-26', total: 145.6 });
    const c = makeHotel({ id: 'c', name: 'Hyatt Regency London Olympia', date: '2026-08-27', total: 150 });
    expect(dedupeStays([a, b, c]).map((h) => h.id)).toEqual(['b', 'c']);
  });
});

describe('foldEmptyTrips', () => {
  const london = makeTrip({ id: 'l', title: 'London', start: '2026-08-16', end: '2026-10-22', hotels: [makeHotel()] });
  it('folds an empty trip of the same name inside a trip with bookings', () => {
    const shell = makeTrip({ id: 's', title: 'london', start: '2026-09-23', end: '2026-09-24', hotels: [], flights: [] });
    expect(foldEmptyTrips([london, shell]).map((t) => t.id)).toEqual(['l']);
  });

  it('keeps a new, differently named trip being planned inside those dates', () => {
    const plan = makeTrip({ id: 'p', title: 'Paris', start: '2026-09-23', end: '2026-09-24', hotels: [], flights: [] });
    expect(foldEmptyTrips([london, plan]).map((t) => t.id)).toEqual(['l', 'p']);
  });

  it('keeps an empty trip that runs past the other one', () => {
    const later = makeTrip({ id: 'x', title: 'London', start: '2026-10-20', end: '2026-10-30', hotels: [], flights: [] });
    expect(foldEmptyTrips([london, later]).map((t) => t.id)).toEqual(['l', 'x']);
  });
});
