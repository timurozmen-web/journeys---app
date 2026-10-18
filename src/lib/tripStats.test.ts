import { describe, expect, it } from 'vitest';
import { computeTripPoints, groupDestinations, tripPointsLines } from './tripStats';
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

describe('tripPointsLines', () => {
  // Budapest, 23-26 Oct 2026, as booked: W Budapest 2 nights (paid on a
  // card the app doesn't know), Dorothea 1 night, Titanium, Fall promo.
  const fall = {
    id: 'fall', title: 'Fall 2026: 1,500 bonus points on stays of 2+ nights', brand: 'Marriott Bonvoy',
    description: 'Register by 13 Nov 2026.', startDate: '2026-09-22', endDate: '2026-11-22', promoType: 'threshold_bonus' as const,
    bonusPoints: 1500, multiplier: null, thresholdSpend: null, discountValue: null, discountUsed: false,
    statusNightsBonus: null, statusNightsApplied: false, partnerAirline: null, registered: false,
  };
  const programmes = [{ name: 'Marriott Bonvoy', abbr: 'MB', points: 0, ptValue: 0.5, color: '#000', accent: '#000', font: '', shape: '', tier: 'Titanium Elite', category: 'hotel' as const }];
  const trip = makeTrip({ hotels: [
    makeHotel({ id: 'w', name: 'W Budapest', country: 'Hungary', date: '2026-10-23', nights: 2, total: 245.6, status: 'Booked', card: 'MasterCard 1039' }),
    makeHotel({ id: 'd', name: 'Dorothea Hotel, Budapest, Autograph Collection', country: 'Hungary', date: '2026-10-25', nights: 1, total: 106.76, status: 'Booked', card: 'MasterCard 1039' }),
  ] });

  it("splits a stay's own points from the promotion bonus", () => {
    const lines = tripPointsLines(trip, programmes, [fall], trip.hotels, true);
    expect(lines.map((l) => [l.label, l.points])).toEqual([
      ['W Budapest', 5458],
      ['Dorothea Hotel, Budapest, Autograph Collection', 2373],
      ['Promotions', 1500],
    ]);
    expect(computeTripPoints(trip, programmes, [fall], trip.hotels, true).totalPoints).toBe(9331);
  });

  it('counts nothing yet on a past trip whose stays are still only booked', () => {
    expect(tripPointsLines(trip, programmes, [fall], trip.hotels, false)).toEqual([]);
  });
});
