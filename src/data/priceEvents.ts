// Events whose effect on hotel prices has been measured, and the plain
// nights each is set against: the same hotels priced for both, in
// src/data/hotelPrices.json (the price database), give the event's ratio.
//
// They don't all go up. Business cities empty out over holidays: Tokyo's
// Marriotts were cheaper in Golden Week than two weeks later, Paris's at
// Christmas than in late November, Rome's at Easter than in mid-April.
// Leisure ones surge: Dubai's Marriotts more than doubled over New Year,
// Edinburgh's quadrupled for Hogmanay. Big events surge whatever the
// city: Barcelona's Mobile World Congress, Milan's Design Week, Abu
// Dhabi's Grand Prix, Rio's Carnival. Some that sound big barely move:
// Las Vegas's Grand Prix (Marriott's hotels there are off the Strip),
// Songkran in Bangkok, King's Day in Amsterdam. So a holiday isn't priced
// as a surge unless an event here says so.
//
// To add one: list it here, then search the city's hotels for the event's
// nights and for the same weekdays a fortnight away, every brand by name
// (see the note in src/lib/hotelPrices.ts), and add the searches to the
// database.

export interface PriceEvent {
  city: string;
  country: string;
  event: string;
  /** Check-in and check-out of the event's nights, and of the plain nights it's set against. */
  window: [string, string];
  baseline: [string, string];
  note?: string;
}

export const PRICE_EVENTS: PriceEvent[] = [
  {
    city: 'Dubai', country: 'UAE', event: 'New Year', window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'],
    note: "Sharjah's hotels came back in Dubai's search and are left out; the Sheraton Jumeirah Beach had no rate for New Year's Eve.",
  },
  { city: 'Tokyo', country: 'Japan', event: 'Golden Week', window: ['2027-05-01', '2027-05-05'], baseline: ['2027-05-15', '2027-05-19'] },
  {
    city: 'Paris', country: 'France', event: 'Christmas school holidays', window: ['2026-12-19', '2026-12-23'], baseline: ['2026-11-28', '2026-12-02'],
    note: 'The Renaissance Vendôme had no rate for the holiday nights.',
  },
  {
    city: 'New York', country: 'United States', event: 'Week before Christmas', window: ['2026-12-18', '2026-12-22'], baseline: ['2026-12-04', '2026-12-08'],
    note: "Manhattan's Marriotts mostly weren't priced on 4-8 Dec (full, or the search left them out), so the Marriott pairs are outer-borough ones.",
  },
  {
    city: 'New York', country: 'United States', event: "New Year's Eve", window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'],
    note: 'Sheraton Lincoln Harbor came back too but is in New Jersey, so it is left out.',
  },
  {
    city: 'Mexico City', country: 'Mexico', event: 'Day of the Dead and the Grand Prix', window: ['2026-10-30', '2026-11-02'], baseline: ['2026-11-06', '2026-11-09'],
    note: 'Searched ten days out: JW Marriott Polanco, Marriott Reforma, Courtyard Revolución and the Sheraton Maria Isabel had no rate on one side.',
  },
  {
    city: 'Las Vegas', country: 'United States', event: 'Grand Prix', window: ['2026-11-19', '2026-11-22'], baseline: ['2026-11-12', '2026-11-15'],
    note: "Marriott's Las Vegas hotels are off the Strip; the Strip's casino resorts, where the race runs, aren't in the set.",
  },
  {
    city: 'Abu Dhabi', country: 'UAE', event: 'Grand Prix', window: ['2026-12-03', '2026-12-06'], baseline: ['2026-11-19', '2026-11-22'],
    note: 'UAE National Day (2-3 Dec) falls on the race weekend too.',
  },
  {
    city: 'Edinburgh', country: 'United Kingdom', event: 'Hogmanay', window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'],
    note: 'The Sheraton Grand and the Four Points Flex had no rate for Hogmanay.',
  },
  {
    city: 'Edinburgh', country: 'United Kingdom', event: 'Festival Fringe', window: ['2027-08-13', '2027-08-16'], baseline: ['2027-09-10', '2027-09-13'],
    note: 'Searched ten months out, when both windows were already priced far above winter (Courtyard West $315 and $308 against $73 in January); the Fringe premium may grow as it sells.',
  },
  {
    city: 'Sydney', country: 'Australia', event: "New Year's Eve", window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'],
    note: "8 of Sydney's 12 Marriotts had no rate for New Year's Eve; no Westin had a rate on either night.",
  },
  { city: 'Singapore', country: 'Singapore', event: 'Lunar New Year', window: ['2027-02-05', '2027-02-08'], baseline: ['2027-02-19', '2027-02-22'] },
  { city: 'Hong Kong', country: 'Hong Kong', event: 'Lunar New Year', window: ['2027-02-05', '2027-02-08'], baseline: ['2027-02-19', '2027-02-22'] },
  {
    city: 'Rio de Janeiro', country: 'Brazil', event: 'Carnival', window: ['2027-02-05', '2027-02-10'], baseline: ['2027-02-19', '2027-02-24'],
    note: 'Copacabana and Ipanema; the Copacabana Palace had no rate for Carnival.',
  },
  {
    city: 'Barcelona', country: 'Spain', event: 'Mobile World Congress', window: ['2027-02-28', '2027-03-04'], baseline: ['2027-03-14', '2027-03-18'],
    note: "Hotel Arts, the Renaissance, Le Méridien, Hotel 1898, Soho House, Miramar, Mandarin Oriental and Sofitel Skipper had no rate for the congress nights. AC Hotels don't come back priced in any search, here or in Milan.",
  },
  {
    city: 'Rome', country: 'Italy', event: 'Easter', window: ['2027-03-25', '2027-03-29'], baseline: ['2027-04-08', '2027-04-12'],
    note: "Mid-April is Rome's high season, so the fortnight after Easter cost more.",
  },
  { city: 'Bangkok', country: 'Thailand', event: 'Songkran', window: ['2027-04-12', '2027-04-16'], baseline: ['2027-04-26', '2027-04-30'] },
  {
    city: 'Amsterdam', country: 'Netherlands', event: "King's Day", window: ['2027-04-26', '2027-04-28'], baseline: ['2027-04-12', '2027-04-14'],
    note: "The Netherlands' May school holiday (24 Apr-2 May 2027) covers it too.",
  },
  {
    city: 'Milan', country: 'Italy', event: 'Salone del Mobile', window: ['2027-04-12', '2027-04-16'], baseline: ['2027-04-26', '2027-04-30'],
    note: 'Park Hyatt, Four Seasons, Casa Cipriani, Excelsior Gallia, Hotel Indigo and AC Hotel Milano had no rate for the fair nights.',
  },
];

// Events with no measurement yet, and why: Munich's Oktoberfest (18 Sep-3
// Oct 2027) had no published rates when searched, eleven months out.

// Marriott's member rate is 2-3% under the booking sites' price for the
// same room: the user's own observation (20 Oct 2026). 2.5%, the middle,
// is taken off cash a Marriott night would cost.
export const MEMBER_RATE_DISCOUNT: Record<string, number> = { 'Marriott Bonvoy': 0.025 };
