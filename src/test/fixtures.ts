// Minimal builders for test data -- every required field gets a neutral
// default so a test only spells out the fields it's actually about.
import type { Flight, Hotel, Trip } from '../types';

export function makeHotel(overrides: Partial<Hotel> = {}): Hotel {
  return {
    id: 'h1',
    name: 'Test Hotel',
    country: 'United Kingdom',
    city: 'London',
    brand: 'Marriott Bonvoy',
    nights: 1,
    date: '2026-09-04',
    status: 'Completed',
    total: null,
    nightlyRate: null,
    avgRate: null,
    sqm: null,
    card: null,
    category: 'Premium',
    lat: 0,
    lng: 0,
    benefitValue: null,
    benefitType: null,
    benefitNote: null,
    bookingChannel: null,
    roomType: null,
    rateType: null,
    award: false,
    createdAt: null,
    ...overrides,
  };
}

export function makeFlight(overrides: Partial<Flight> = {}): Flight {
  return {
    id: 'f1',
    date: '2026-09-04',
    from: 'LHR',
    via: [],
    to: 'JFK',
    airline: 'British Airways',
    flightNo: 'BA 117',
    cabin: 'Economy',
    status: 'Completed',
    cost: null,
    award: false,
    overnight: false,
    departureTime: null,
    arrivalTime: null,
    ...overrides,
  };
}

export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    title: 'Test Trip',
    start: '2026-09-04',
    end: '2026-09-08',
    section: 'past',
    tripType: 'leisure',
    hotels: [],
    flights: [],
    notes: '',
    heroImageUrl: null,
    ...overrides,
  };
}
