import { describe, expect, it } from 'vitest';
import { hotelBadge } from './bookingBadge';
import { airlineBadge } from '../data/airlineBrand';
import { makeHotel } from '../test/fixtures';
import type { LoyaltyProgramme } from '../types';

const marriott = { name: 'Marriott Bonvoy', color: '#1C1C1C' } as LoyaltyProgramme;

describe('hotelBadge', () => {
  it("uses the programme's colour and the brand's initials", () => {
    expect(hotelBadge(makeHotel({ name: 'St Regis Goa', brand: 'Marriott Bonvoy' }), [marriott])).toEqual({ code: 'SR', colour: '#1C1C1C' });
    expect(hotelBadge(makeHotel({ name: 'W Budapest', brand: 'Marriott Bonvoy' }), [marriott]).code).toBe('W');
    expect(hotelBadge(makeHotel({ name: 'AC San Sebastian', brand: 'Marriott Bonvoy' }), [marriott]).code).toBe('AC');
  });

  it('has no colour for a hotel outside your programmes', () => {
    expect(hotelBadge(makeHotel({ name: 'Liberty Signa', brand: 'Independent' }), [marriott])).toEqual({ code: 'LS', colour: null });
  });
});

describe('airlineBadge', () => {
  it('prefers the airline name over an ICAO-style flight number', () => {
    expect(airlineBadge('EZY8565', 'easyJet')).toEqual({ code: 'U2', colour: '#FF6600' });
  });
  it('reads the code from the flight number when the name is unknown', () => {
    expect(airlineBadge('QR148/QR522', 'Qatar')).toEqual({ code: 'QR', colour: '#5C0632' });
    expect(airlineBadge('U2 8540', 'Unknown')).toEqual({ code: 'U2', colour: '#FF6600' });
  });
  it('puts BA sub-brands under BA', () => {
    expect(airlineBadge('BA7029', 'BA Cityflyer').code).toBe('BA');
  });
});
