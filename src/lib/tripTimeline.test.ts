import { describe, expect, it } from 'vitest';
import { buildTripTimeline, pastTripsByYear, countdownLabel, emptyMonthsBetween, monthLabel, spanLabel, tonightStay } from './tripTimeline';
import { makeHotel, makeTrip } from '../test/fixtures';

const TODAY = '2026-10-06';
const trips = [
  makeTrip({ id: 'feb', start: '2026-02-12', end: '2026-02-15' }),
  makeTrip({ id: 'tur', start: '2026-07-25', end: '2026-08-15' }),
  makeTrip({ id: 'work', start: '2026-08-24', end: '2026-10-07', tripType: 'work', section: 'current' }),
  makeTrip({ id: 'por', start: '2026-09-04', end: '2026-09-08' }),
  makeTrip({ id: 'bud', start: '2026-10-23', end: '2026-10-25', section: 'upcoming' }),
  makeTrip({ id: 'si', start: '2027-01-15', end: '2027-01-23', section: 'upcoming' }),
];

describe('buildTripTimeline', () => {
  it('splits work and leisure trips around today with three months of history', () => {
    const t = buildTripTimeline(trips, TODAY);
    expect(t.earlier.map((x) => x.id)).toEqual(['feb']);
    expect(t.recent.map((x) => x.id)).toEqual(['tur', 'work', 'por']);
    expect(t.upcoming.map((x) => x.id)).toEqual(['bud', 'si']);
  });

  it('keeps a trip that ended inside the window even if it started before it', () => {
    const t = buildTripTimeline([makeTrip({ id: 'x', start: '2026-06-20', end: '2026-07-10' })], TODAY);
    expect(t.recent.map((x) => x.id)).toEqual(['x']);
  });

  it('counts a trip starting today as under way, not upcoming', () => {
    const t = buildTripTimeline([makeTrip({ id: 'x', start: TODAY, end: '2026-10-09' })], TODAY);
    expect(t.recent.map((x) => x.id)).toEqual(['x']);
    expect(t.upcoming).toEqual([]);
  });
});

describe('emptyMonthsBetween', () => {
  it('lists the months with nothing booked between two trips', () => {
    expect(emptyMonthsBetween('2026-10-23', '2027-01-15', trips)).toEqual(['2026-11', '2026-12']);
  });

  it('treats a month a trip runs into as busy', () => {
    const spanning = [makeTrip({ start: '2026-10-28', end: '2026-11-03' })];
    expect(emptyMonthsBetween('2026-10-01', '2027-01-15', spanning)).toEqual(['2026-12']);
  });
});

describe('labels', () => {
  it('names months, adding the year only when it is not this year', () => {
    expect(monthLabel('2026-08', TODAY)).toBe('Aug');
    expect(monthLabel('2027-01', TODAY)).toBe('Jan 2027');
  });

  it('describes the span of folded trips', () => {
    expect(spanLabel([makeTrip({ start: '2026-01-10' }), makeTrip({ start: '2026-06-02' })])).toBe('Jan – Jun 2026');
    expect(spanLabel([makeTrip({ start: '2025-11-10' }), makeTrip({ start: '2026-03-02' })])).toBe('Nov 2025 – Mar 2026');
    expect(spanLabel([makeTrip({ start: '2026-03-02' })])).toBe('Mar 2026');
  });

  it('counts down in days', () => {
    expect(countdownLabel(TODAY, '2026-10-23')).toBe('17 days');
    expect(countdownLabel(TODAY, '2026-10-07')).toBe('Tomorrow');
    expect(countdownLabel(TODAY, TODAY)).toBe('Today');
  });
});

describe('tonightStay', () => {
  it("finds tonight's hotel and ignores one you've checked out of", () => {
    const croydon = makeHotel({ id: 'c', name: 'Holiday Inn Express London Croydon', date: TODAY, nights: 1 });
    const gatwick = makeHotel({ id: 'g', name: 'ibis Styles London Gatwick Airport', date: '2026-10-05', nights: 1 });
    const work = makeTrip({ hotels: [gatwick, croydon] });
    expect(tonightStay([work], TODAY)?.hotel.id).toBe('c');
    expect(tonightStay([work], '2026-10-07')).toBeNull();
  });
});

describe('pastTripsByYear', () => {
  it('groups finished trips by year, newest first, leaving out anything still going', () => {
    const groups = pastTripsByYear([...trips, makeTrip({ id: 'old', start: '2025-05-01', end: '2025-05-04' })], TODAY);
    expect(groups.map((g) => g.year)).toEqual(['2026', '2025']);
    expect(groups[0].trips.map((t) => t.id)).toEqual(['por', 'tur', 'feb']);
  });
});
