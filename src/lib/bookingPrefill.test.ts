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
  test('the booking class marks an award seat and its cabin, on the airline it belongs to', () => {
    const qr = bookingRoute({ type: 'flight', date: '2027-05-22', from: 'HEL', to: 'HND', airline: 'Qatar Airways', flightNo: 'QR304', bookingClass: 'U', cabin: null });
    expect(qr.state).toMatchObject({ prefill: { award: true, cabin: 'Business' } });
    const lot = bookingRoute({ type: 'flight', date: '2026-10-26', from: 'BUD', to: 'LHR', airline: 'LOT Polish Airlines', flightNo: 'LO538', bookingClass: 'U', cabin: 'Economy' });
    expect(lot.state).toMatchObject({ prefill: { award: false, cabin: 'Economy' } });
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
