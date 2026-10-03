import { describe, expect, test } from 'vitest';
import { bookingRoute, summarizeBooking } from './bookingPrefill';

describe('bookingRoute', () => {
  test('a hotel goes to the stay form, prefilled and attached to the trip', () => {
    const r = bookingRoute({ type: 'hotel', name: 'Hotel Gellert', country: 'Hungary', city: 'Budapest', checkIn: '2026-11-10', nights: 2, total: 300 }, { tripId: 't1' });
    expect(r.to).toBe('/log-hotel');
    expect(r.state).toMatchObject({ tripId: 't1', prefill: { name: 'Hotel Gellert', date: '2026-11-10', nights: 2, total: 300, rateType: 'Standard' } });
  });
  test('a flight goes to the flight form', () => {
    const r = bookingRoute({ type: 'flight', date: '2026-11-10', from: 'LHR', to: 'BUD', airline: 'British Airways' });
    expect(r.to).toBe('/log-flight');
    expect(r.state).toMatchObject({ prefill: { from: 'LHR', to: 'BUD' } });
  });
  test('a foreign-currency amount carries a note to double-check it', () => {
    expect((bookingRoute({ type: 'hotel', name: 'H', currency: 'EUR' }).state.extractNote as string)).toMatch(/EUR/);
    expect(bookingRoute({ type: 'hotel', name: 'H', currency: 'GBP' }).state.extractNote).toBeUndefined();
  });
});

describe('summarizeBooking', () => {
  test('one line per booking', () => {
    expect(summarizeBooking({ type: 'hotel', name: 'Gellert', checkIn: '2026-11-10', nights: 2 })).toBe('Gellert · 2026-11-10 · 2n');
    expect(summarizeBooking({ type: 'flight', airline: 'BA', from: 'LHR', to: 'BUD', date: '2026-11-10' })).toBe('BA LHR → BUD · 2026-11-10');
  });
});
