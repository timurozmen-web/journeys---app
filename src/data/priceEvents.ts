// Events whose effect on hotel prices has been measured, and the plain
// nights each is set against: the same hotels priced for both, in
// src/data/hotelPrices.json (the price database), give the event's ratio.
//
// They don't all go up. Business cities empty out over holidays: Tokyo's
// Marriotts were cheaper in Golden Week than two weeks later, Paris's at
// Christmas than in late November, Rome's at Easter than in mid-April.
// Leisure ones surge: Dubai's Marriotts more than doubled over New Year,
// Edinburgh's quadrupled for Hogmanay. Big events surge whatever the city:
// Barcelona's Mobile World Congress, Milan's Design Week, Abu Dhabi's Grand
// Prix, Rio's Carnival, Lisbon's Web Summit, Berlin's EULAR congress, the
// Open at St Andrews (Edinburgh's hotels, 50 miles off, at 1.8 times a
// fortnight later). Some that sound big barely move: Las Vegas's Grand Prix
// (Marriott's hotels there are off the Strip), Songkran in Bangkok, King's
// Day in Amsterdam, the end of Ramadan in Istanbul, the Berlinale. So a
// holiday isn't priced as a surge unless an event here says so.
//
// To add one: list it here, then search the city's hotels for the event's
// nights and for the same weekdays a fortnight away, a search for each
// hotel group and one for the city's 4-5★ hotels (see the note in
// src/lib/hotelPrices.ts), and add the searches to the database.

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
    note: "Sharjah's hotels came back in Dubai's search and are left out, as is Arabian Courtyard (not a Courtyard). The Sheraton Jumeirah Beach and Courtyard Culture Village had no rate for New Year's Eve; no Moxy or Bulgari had a rate on either.",
  },
  { city: 'Tokyo', country: 'Japan', event: 'Golden Week', window: ['2027-05-01', '2027-05-05'], baseline: ['2027-05-15', '2027-05-19'] },
  {
    city: 'Paris', country: 'France', event: 'Christmas school holidays', window: ['2026-12-19', '2026-12-23'], baseline: ['2026-11-28', '2026-12-02'],
    note: "The Renaissance Vendôme had no rate for the holiday nights; Paris's W, EDITION, Westin and Autograph Collection hotels had none on either. The Sheraton and Four Points are at Charles de Gaulle.",
  },
  {
    city: 'New York', country: 'United States', event: 'Week before Christmas', window: ['2026-12-18', '2026-12-22'], baseline: ['2026-12-04', '2026-12-08'],
    note: "Early December is New York's dearest stretch (the same hotels cost 2.6x as much as in mid-January), so the week before Christmas comes in under it. Hotels in New Jersey and Westchester that came back are left out.",
  },
  {
    city: 'New York', country: 'United States', event: "New Year's Eve", window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'],
    note: 'Hotels in New Jersey (Sheraton Lincoln Harbor, the Westin and Residence Inn in Jersey City, the Residence Inns at Newark and Weehawken) and Westchester came back too and are left out.',
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
    // The 155th Open is at the Old Course, St Andrews, 15-18 July 2027 (R&A,
    // randa.org). Edinburgh's month-by-month search landed on it: the
    // Courtyard was $1,002 a night against $555 a fortnight later.
    city: 'Edinburgh', country: 'United Kingdom', event: 'The Open at St Andrews', window: ['2027-07-14', '2027-07-17'], baseline: ['2027-07-28', '2027-07-31'],
    note: 'The Moxy Edinburgh and the Sheraton Grand had no rate for the Open, nor the Courtyard West; the Balmoral and the InterContinental had none in the 4-5★ search.',
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
    // Web Summit is 9-12 November 2026 at the MEO Arena and FIL, Parque das
    // Nações (websummit.com; the Dutch delegation's page, rvo.nl). The Moxy
    // Lisboa Oriente, beside the venue, was $711 a night against $107 a
    // fortnight later.
    city: 'Lisbon', country: 'Portugal', event: 'Web Summit', window: ['2026-11-09', '2026-11-12'], baseline: ['2026-11-23', '2026-11-26'],
    note: 'Searched three weeks out. Hotels in Cascais, Sintra, Setúbal, Caparica and Oeiras that came back in the brand searches are left out.',
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
  {
    // Ramazan Bayramı 2027 is 9-11 March, the eve (arife) on the 8th
    // (Diyanet's calendar). Istanbul's March search landed on it.
    city: 'Istanbul', country: 'Türkiye', event: 'Ramazan Bayramı (Eid al-Fitr)', window: ['2027-03-10', '2027-03-13'], baseline: ['2027-03-24', '2027-03-27'],
    note: 'Hotels in Gebze that came back in the brand searches are left out.',
  },
  {
    // The 77th Berlinale is 10-21 February 2027, the European Film Market
    // 9-16 February (berlinale.de). Berlin's February search landed on it.
    city: 'Berlin', country: 'Germany', event: 'Berlinale', window: ['2027-02-10', '2027-02-13'], baseline: ['2027-02-24', '2027-02-27'],
    note: 'Measured on the 4-5★ search alone; Potsdam hotels that came back are left out.',
  },
  {
    // EULAR, the European rheumatology congress, is at Messe Berlin on 9-12
    // June 2027, about 14,000 delegates (visitBerlin's Convention Office, 9
    // June 2026). Berlin's June search landed on it: the Ritz-Carlton was
    // $1,161 a night against $444 a fortnight later.
    city: 'Berlin', country: 'Germany', event: 'EULAR congress', window: ['2027-06-09', '2027-06-12'], baseline: ['2027-06-23', '2027-06-26'],
    note: "BDEW's energy congress (22-24 June, STATION Berlin) is on the plain nights. Hotels in Potsdam, Schönefeld and Hoppegarten that came back in the group searches are left out; the Grand Hyatt and the JW Marriott had no rate for the congress.",
  },
  {
    // The WeAreDevelopers World Congress is at CityCube Berlin on 14-16 July
    // 2027, 15,000 expected. Berlin's July search landed on it.
    city: 'Berlin', country: 'Germany', event: 'WeAreDevelopers World Congress', window: ['2027-07-14', '2027-07-17'], baseline: ['2027-07-28', '2027-07-31'],
    note: 'Measured on the 4-5★ search alone.',
  },
  {
    // Ireland v France at the Aviva, Saturday 13 March 2027, the Six Nations'
    // last round (irishrugby.ie, fixtures published 9 March 2026). The
    // fortnight before, Ireland are away (Wales on the 20th, Scotland on 5
    // March).
    city: 'Dublin', country: 'Ireland', event: 'Six Nations: Ireland v France', window: ['2027-03-12', '2027-03-14'], baseline: ['2027-02-26', '2027-02-28'],
    note: "The Shelbourne's cheapest room for the match weekend was $5,251 a night. Hotels in Blackrock, Killiney, Enniskerry, Maynooth and Naas that came back are left out.",
  },
  {
    // St Patrick's Day is Wednesday 17 March 2027; the eve and the day
    // against the same weekdays a fortnight before.
    city: 'Dublin', country: 'Ireland', event: "St Patrick's Day", window: ['2027-03-16', '2027-03-18'], baseline: ['2027-03-02', '2027-03-04'],
    note: 'The city-centre three- and four-star brands more than doubled (Hampton x3.2, Moxy City x2.9); the five-stars hardly moved (the Shelbourne was cheaper). Hotels in Blackrock, Killiney, Enniskerry, Maynooth and Naas are left out.',
  },
];

// Events with no measurement yet, and why. Their nights are still kept out
// of the month-by-month index (seasonIndex): Madrid's September search
// landed on the Grand Prix, and counted as a plain month it would have
// taught the index that September there is dear.
export const UNMEASURED_EVENTS: (Omit<PriceEvent, 'baseline' | 'note'> & { why: string })[] = [
  { city: 'Munich', country: 'Germany', event: 'Oktoberfest', window: ['2027-09-18', '2027-10-04'], why: 'No published rates when searched, eleven months out.' },
  {
    // MADRING, 10-12 September 2027 (madring.com; the 2027 F1 calendar,
    // published 16 Sep 2026).
    city: 'Madrid', country: 'Spain', event: 'Spanish Grand Prix', window: ['2027-09-09', '2027-09-13'],
    why: 'Searched eleven months out, most hotels had no rate for the race nights or a fortnight later; only Hotel Atlántico was priced on both sides of it ($278 a night against $250 the week before).',
  },
];

// Marriott's member rate is 2-3% under the booking sites' price for the
// same room: the user's own observation (20 Oct 2026). 2.5%, the middle,
// is taken off cash a Marriott night would cost.
export const MEMBER_RATE_DISCOUNT: Record<string, number> = { 'Marriott Bonvoy': 0.025 };
