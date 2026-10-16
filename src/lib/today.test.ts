import { describe, expect, it } from 'vitest';
import { missingFlights, missingFlightsLabel, nextUp, promoShortName, promosToRegister, registrationDeadline, uncoveredNights, weekdayShort } from './today';
import { makeFlight, makeHotel, makeTrip } from '../test/fixtures';
import type { Promotion } from '../types';

// The London work stint as it stood on 13 Oct 2026: tonight at Gatwick,
// Sofitel on the 14th, nothing 15-19, Croydon on the 20th, Dorking on the
// 21st, home on the 22nd. Then Budapest from the 23rd.
const london = makeTrip({
  id: 'lon', title: 'London', start: '2026-08-16', end: '2026-10-22',
  hotels: [
    makeHotel({ id: 'gat', name: 'Holiday Inn London Gatwick Airport', date: '2026-10-13', status: 'Booked' }),
    makeHotel({ id: 'sof', name: 'Sofitel London Gatwick', date: '2026-10-14', status: 'Booked' }),
    makeHotel({ id: 'cro', name: 'Holiday Inn Express London Croydon', date: '2026-10-20', status: 'Booked' }),
    makeHotel({ id: 'whi', name: 'The White Horse, Dorking', date: '2026-10-21', status: 'Booked' }),
  ],
  flights: [],
});
const budapest = makeTrip({
  id: 'bud', title: 'Budapest', start: '2026-10-23', end: '2026-10-26',
  hotels: [makeHotel({ id: 'w', name: 'W Budapest', date: '2026-10-23', nights: 2, status: 'Booked' })],
  flights: [makeFlight({ id: 'ba', date: '2026-10-23', from: 'LHR', to: 'BUD', flightNo: 'BA870', status: 'Booked' })],
});
const athens = makeTrip({ id: 'ath', title: 'Athens', start: '2026-11-13', end: '2026-11-15', hotels: [], flights: [] });

describe('uncoveredNights', () => {
  it('finds the run of nights with nothing booked, up to the night before the trip ends', () => {
    expect(uncoveredNights(london, '2026-10-14')).toEqual([{ first: '2026-10-15', last: '2026-10-19', nights: 5 }]);
  });

  it('counts an overnight flight as somewhere to sleep', () => {
    const trip = makeTrip({ start: '2026-11-13', end: '2026-11-15', hotels: [makeHotel({ date: '2026-11-14', nights: 1 })], flights: [makeFlight({ date: '2026-11-13', overnight: true })] });
    expect(uncoveredNights(trip, '2026-11-13')).toEqual([]);
  });
});

describe('nextUp', () => {
  it('lists the rest of the trip under way, its unbooked nights, then the next trip', () => {
    const items = nextUp([london, budapest, athens], '2026-10-13');
    expect(items.map((i) => (i.kind === 'stay' ? i.hotel.id : i.kind === 'gap' ? `gap ${i.date}..${i.last}` : i.kind === 'trip' ? i.trip.id : i.kind)))
      .toEqual(['sof', 'gap 2026-10-15..2026-10-19', 'cro', 'whi', 'bud']);
  });

  it('shows the next two trips when nothing is under way', () => {
    const items = nextUp([budapest, athens], '2026-10-01');
    expect(items.map((i) => i.trip.id)).toEqual(['bud', 'ath']);
  });

  it("includes a flight on today's date", () => {
    const items = nextUp([budapest], '2026-10-23');
    expect(items.some((i) => i.kind === 'flight' && i.flight.id === 'ba')).toBe(true);
  });
});

const fall: Promotion = {
  id: 'fall', title: 'Fall 2026: 1,500 bonus points on stays of 2+ nights', brand: 'Marriott Bonvoy',
  description: 'Paid stays of two or more nights between 22 Sep and 22 Nov 2026. Register by 13 Nov 2026.',
  startDate: '2026-09-22', endDate: '2026-11-22', promoType: 'threshold_bonus', bonusPoints: 1500,
  multiplier: null, thresholdSpend: null, discountValue: null, statusNightsBonus: null, partnerAirline: null,
  discountUsed: false, statusNightsApplied: false,
} as Promotion;

describe('registrationDeadline', () => {
  it('reads "Register by 13 Nov 2026"', () => {
    expect(registrationDeadline(fall)).toBe('2026-11-13');
  });
  it('reads "register by November 13, 2026"', () => {
    expect(registrationDeadline({ title: 'x', description: 'You must register by November 13, 2026 to earn.' })).toBe('2026-11-13');
  });
  it('is null when the wording names no deadline', () => {
    expect(registrationDeadline({ title: 'Earn 2K every 2 nights', description: 'Stay between July 1 and September 7.' })).toBeNull();
  });
});

describe('promosToRegister', () => {
  const stays = [
    makeHotel({ id: 'w', name: 'W Budapest', brand: 'Marriott Bonvoy', date: '2026-10-23', nights: 2, total: 245.6, status: 'Booked' }),
    makeHotel({ id: 'd', name: 'Dorothea', brand: 'Marriott Bonvoy', date: '2026-10-25', nights: 1, total: 106.76, status: 'Booked' }),
    makeHotel({ id: 'gb', name: 'Grande Bretagne', brand: 'Marriott Bonvoy', date: '2026-11-13', nights: 2, total: 294.38, status: 'Booked' }),
  ];
  it('totals the bonus on booked stays that qualify', () => {
    expect(promosToRegister([fall], stays, '2026-10-16')).toEqual([{ promotion: fall, deadline: '2026-11-13', points: 3000 }]);
  });
  it('drops a promotion once its deadline has passed', () => {
    expect(promosToRegister([fall], stays, '2026-11-14')).toEqual([]);
  });
});

describe('missingFlights', () => {
  const places: Record<string, { lat: number; lng: number; city: string }> = {
    LHR: { lat: 51.47, lng: -0.45, city: 'London' },
    LGW: { lat: 51.15, lng: -0.19, city: 'London' },
    BUD: { lat: 47.44, lng: 19.26, city: 'Budapest' },
    HEL: { lat: 60.32, lng: 24.95, city: 'Helsinki' },
    HND: { lat: 35.55, lng: 139.78, city: 'Tokyo' },
    GOX: { lat: 15.74, lng: 73.83, city: 'Goa' },
  };
  const locate = (code: string) => places[code] ?? null;
  const home = { lat: 51.5, lng: -0.12 };

  it('flags an award that starts abroad and has no way home (Japan, May 2027)', () => {
    const japan = makeTrip({ flights: [makeFlight({ date: '2027-05-22', from: 'HEL', to: 'HND' })] });
    const m = missingFlights(japan, locate, home);
    expect(m).toEqual({ toStart: 'Helsinki', home: true });
    expect(missingFlightsLabel(m!)).toBe('No flight to Helsinki or home');
  });

  it('treats Gatwick out and Heathrow back as a round trip', () => {
    const india = makeTrip({ flights: [
      makeFlight({ id: 'a', date: '2027-01-15', from: 'LGW', to: 'GOX' }),
      makeFlight({ id: 'b', date: '2027-01-23', from: 'GOX', to: 'LHR' }),
    ] });
    expect(missingFlights(india, locate, home)).toBeNull();
  });

  it('flags a one-way trip from home', () => {
    const oneWay = makeTrip({ flights: [makeFlight({ date: '2026-10-23', from: 'LHR', to: 'BUD' })] });
    expect(missingFlights(oneWay, locate, home)).toEqual({ toStart: null, home: true });
  });
});

describe('weekdayShort', () => {
  it('names the day without shifting it in BST', () => {
    expect(weekdayShort('2026-10-13')).toBe('Tue');
  });
});

describe('promoShortName', () => {
  it('puts the programme in front of the promotion name', () => {
    expect(promoShortName({ title: 'Fall 2026: 1,500 bonus points on stays of 2+ nights', brand: 'Marriott Bonvoy' })).toBe('Marriott Fall 2026');
    expect(promoShortName({ title: 'Marriott Summer: double points', brand: 'Marriott Bonvoy' })).toBe('Marriott Summer');
  });
});

describe('nextUp with nothing booked tonight', () => {
  it('starts the gap tonight (16 Oct: Sofitel was the 14th, Croydon the 20th)', () => {
    const items = nextUp([london, budapest], '2026-10-16');
    expect(items[0]).toMatchObject({ kind: 'gap', date: '2026-10-16', last: '2026-10-19', nights: 4 });
  });
});
