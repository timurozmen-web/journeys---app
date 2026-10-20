// What events actually do to hotel prices, measured rather than assumed.
// Each sample prices the same hotels for an event's dates and for a plain
// window of the same weekdays nearby, from SlickTrip (a hotel price
// comparison across booking sites: Expedia, Booking.com and the rest),
// 2 adults, cheapest room, USD a night, searched 20 Oct 2026.
//
// They don't all go up. Business cities empty out over holidays: Tokyo's
// Marriotts were cheaper in Golden Week than two weeks later, Paris's at
// Christmas than in late November. Leisure ones surge: Dubai's Marriotts
// more than doubled over New Year. So a holiday isn't priced as a surge
// unless a sample says so.
//
// To add one: search the city's hotels for the event's nights and for the
// same weekdays a fortnight away (brand-filtered searches return the same
// hotels both times), keep the hotels priced in both, and add them here.

export interface PricePair { hotel: string; event: number; base: number }

export interface PriceSample {
  city: string;
  country: string;
  event: string;
  /** Check-in and check-out of the event's nights, and of the plain nights it's set against. */
  window: [string, string];
  baseline: [string, string];
  /** Which hotels: a brand, or "4-5★" for the top-rated of that class. */
  set: string;
  pairs: PricePair[];
}

export const SAMPLED_ON = '2026-10-20';

const p = (hotel: string, event: number, base: number): PricePair => ({ hotel, event, base });

export const PRICE_SAMPLES: PriceSample[] = [
  {
    city: 'Dubai', country: 'UAE', event: 'New Year', window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: 'Marriott',
    pairs: [
      p('Marriott Hotel Production City', 188, 138), p('Aloft Palm Jumeirah', 448, 181), p('JW Marriott Hotel Marina', 610, 289),
      p('JW Marriott Marquis Hotel Dubai', 877, 260), p('Marriott Resort Palm Jumeirah', 1011, 294),
    ],
  },
  {
    city: 'Dubai', country: 'UAE', event: 'New Year', window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: '4-5★',
    pairs: [p('Atlantis The Palm', 1440, 505)],
  },
  {
    city: 'Tokyo', country: 'Japan', event: 'Golden Week', window: ['2027-05-01', '2027-05-05'], baseline: ['2027-05-15', '2027-05-19'], set: 'Marriott',
    pairs: [p('Tokyo Marriott Hotel', 401, 496), p('JW Marriott Hotel Tokyo', 811, 948)],
  },
  {
    city: 'Tokyo', country: 'Japan', event: 'Golden Week', window: ['2027-05-01', '2027-05-05'], baseline: ['2027-05-15', '2027-05-19'], set: '4-5★',
    pairs: [
      p('Tokyo East Side Hotel Kaie', 121, 102), p('Tokyo Bay Shiomi Prince Hotel', 201, 188), p('Mitsui Garden Hotel Nihonbashi Premier', 258, 237),
      p('Mitsui Garden Hotel Gotanda', 127, 127), p('The Prince Park Tower Tokyo', 227, 269),
    ],
  },
  {
    city: 'Paris', country: 'France', event: 'Christmas school holidays', window: ['2026-12-19', '2026-12-23'], baseline: ['2026-11-28', '2026-12-02'], set: 'Marriott',
    pairs: [
      p('Paris Marriott Rive Gauche', 184, 230), p('Residence Inn Paris Didot Montparnasse', 200, 240), p('Courtyard Paris Gare de Lyon', 245, 292),
      p('Paris Marriott Opera Ambassador', 364, 395), p('Paris Marriott Champs Elysees', 677, 832),
    ],
  },
  // Manhattan's Marriotts mostly weren't priced on 4-8 Dec (full, or the
  // search left them out), so the Marriott pairs are outer-borough ones.
  {
    city: 'New York', country: 'United States', event: 'Week before Christmas', window: ['2026-12-18', '2026-12-22'], baseline: ['2026-12-04', '2026-12-08'], set: 'Marriott',
    pairs: [p('Fairfield Inn & Suites Queens/Fresh Meadows', 128, 130), p('Fairfield Inn & Suites Staten Island', 142, 142), p('Courtyard Queens/Fresh Meadows', 170, 166)],
  },
  {
    city: 'New York', country: 'United States', event: 'Week before Christmas', window: ['2026-12-18', '2026-12-22'], baseline: ['2026-12-04', '2026-12-08'], set: '4-5★',
    pairs: [p('Hotel Indigo Lower East Side', 302, 444), p('M Social Hotel New York Downtown', 346, 487)],
  },
];

// Marriott's member rate is 2-3% under the booking sites' price for the
// same room: the user's own observation (20 Oct 2026). 2.5%, the middle,
// is taken off cash a Marriott night would cost.
export const MEMBER_RATE_DISCOUNT: Record<string, number> = { 'Marriott Bonvoy': 0.025 };
