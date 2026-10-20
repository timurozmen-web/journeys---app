// What events actually do to hotel prices, measured rather than assumed.
// Each sample prices the same hotels for an event's dates and for a plain
// window of the same weekdays nearby, from SlickTrip (a hotel price
// comparison across booking sites: Expedia, Booking.com and the rest),
// 2 adults, cheapest room, USD a night, searched 20 Oct 2026.
//
// They don't all go up. Business cities empty out over holidays: Tokyo's
// Marriotts were cheaper in Golden Week than two weeks later, Paris's at
// Christmas than in late November, Rome's at Easter than in mid-April.
// Leisure ones surge: Dubai's Marriotts more than doubled over New Year,
// Edinburgh's quadrupled for Hogmanay. Big events surge whatever the
// city: Milan's Design Week, Abu Dhabi's Grand Prix, Rio's Carnival. Some
// that sound big barely move: Las Vegas's Grand Prix (Marriott's hotels
// there are off the Strip), Songkran in Bangkok, King's Day in Amsterdam.
// So a holiday isn't priced as a surge unless a sample says so.
//
// To add one: search the city's hotels for the event's nights and for the
// same weekdays a fortnight away (brand-filtered searches return the same
// hotels both times), keep the hotels priced in both, and add them here.
// The brand filter matches the hotel's name, so "Marriott" finds a
// Courtyard by Marriott but not a Sheraton, a Westin or a Moxy: search
// each sub-brand too (`set` says what was searched). A 4-5★ search adds
// the other groups' hotels. Every pair is put to its programme by name
// (`programmeOfHotel`, src/data/brandMap.ts), so a Sheraton counts as
// Marriott and a Mercure as Accor whichever search found it, and an
// event's samples are pooled. A hotel with no rate for the event's nights
// is usually sold out: it's left out of the pairs and noted.

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
  // No Manhattan Marriott had a rate on either window; these are Midtown's.
  {
    city: 'New York', country: 'United States', event: "New Year's Eve", window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: '4-5★',
    pairs: [p('The Empire Hotel', 420, 156), p('Royalton New York', 447, 171), p('Arlo Midtown', 479, 191)],
  },
  // Searched ten days out: JW Marriott Polanco, Marriott Reforma and
  // Courtyard Revolución had no rate on one side, so aren't in the pairs.
  {
    city: 'Mexico City', country: 'Mexico', event: 'Day of the Dead and the Grand Prix', window: ['2026-10-30', '2026-11-02'], baseline: ['2026-11-06', '2026-11-09'], set: 'Marriott',
    pairs: [
      p('JW Marriott Hotel Mexico City Santa Fe', 353, 173), p('City Express Plus by Marriott Reforma El Ángel', 541, 120),
      p('City Centro by Marriott Ciudad de México', 595, 117),
    ],
  },
  // Marriott's Las Vegas hotels are off the Strip; the Strip's casino
  // resorts, where the race runs, aren't in the set.
  {
    city: 'Las Vegas', country: 'United States', event: 'Grand Prix', window: ['2026-11-19', '2026-11-22'], baseline: ['2026-11-12', '2026-11-15'], set: 'Marriott',
    pairs: [
      p('Element Las Vegas Symphony Park', 105, 108), p('Residence Inn Las Vegas Stadium Area', 133, 174), p('Courtyard Las Vegas Stadium Area', 136, 136),
      p('SpringHill Suites Las Vegas Convention Center', 156, 166), p('JW Marriott Las Vegas Resort & Spa', 271, 269),
    ],
  },
  // UAE National Day (2-3 Dec) falls on the race weekend too.
  {
    city: 'Abu Dhabi', country: 'UAE', event: 'Grand Prix', window: ['2026-12-03', '2026-12-06'], baseline: ['2026-11-19', '2026-11-22'], set: 'Marriott',
    pairs: [
      p('Aloft Abu Dhabi', 799, 210), p('Courtyard World Trade Center Abu Dhabi', 819, 177), p('Marriott Hotel Downtown Abu Dhabi', 972, 186),
      p('Marriott Hotel Al Forsan Abu Dhabi', 1658, 255),
    ],
  },
  {
    city: 'Edinburgh', country: 'United Kingdom', event: 'Hogmanay', window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: 'Marriott',
    pairs: [
      p('Courtyard Edinburgh West', 342, 73), p('Edinburgh Marriott Hotel Holyrood', 487, 127), p('Residence Inn Edinburgh', 500, 122),
      p('Courtyard Edinburgh', 522, 127),
    ],
  },
  // Searched ten months out, when both windows were already priced far
  // above winter (Courtyard West $315 and $308 against $73 in January);
  // the Fringe's own premium may grow as it sells.
  {
    city: 'Edinburgh', country: 'United Kingdom', event: 'Festival Fringe', window: ['2027-08-13', '2027-08-16'], baseline: ['2027-09-10', '2027-09-13'], set: 'Marriott',
    pairs: [
      p('Courtyard Edinburgh West', 315, 308), p('Residence Inn Edinburgh', 488, 489), p('Courtyard Edinburgh', 529, 451),
      p('Edinburgh Marriott Hotel Holyrood', 567, 460),
    ],
  },
  // 8 of Sydney's 12 Marriotts had no rate for New Year's Eve.
  {
    city: 'Sydney', country: 'Australia', event: "New Year's Eve", window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: 'Marriott',
    pairs: [p('Sydney Harbour Marriott at Circular Quay', 971, 306)],
  },
  {
    city: 'Sydney', country: 'Australia', event: "New Year's Eve", window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: '4-5★',
    pairs: [p('The Ultimo Sydney', 469, 130), p('Mercure Sydney', 480, 131), p('Novotel Sydney on Darling Harbour', 632, 153), p('InterContinental Sydney', 1117, 300)],
  },
  // The St. Regis and the Four Points are Marriott brands from the 4-5★ search.
  {
    city: 'Singapore', country: 'Singapore', event: 'Lunar New Year', window: ['2027-02-05', '2027-02-08'], baseline: ['2027-02-19', '2027-02-22'], set: 'Marriott',
    pairs: [p('Singapore Marriott Tang Plaza', 362, 372), p('The St. Regis Singapore', 225, 176), p('Four Points by Sheraton Singapore, Riverview', 152, 160)],
  },
  {
    city: 'Singapore', country: 'Singapore', event: 'Lunar New Year', window: ['2027-02-05', '2027-02-08'], baseline: ['2027-02-19', '2027-02-22'], set: '4-5★',
    pairs: [
      p('Four Points by Sheraton Singapore, Riverview', 152, 160), p('Park Regis by Prince Singapore', 191, 161), p('InterContinental Singapore Robertson Quay', 203, 202),
      p('The St. Regis Singapore', 225, 176), p('Mondrian Singapore Duxton', 231, 215), p('Shangri-La Singapore', 359, 288),
    ],
  },
  {
    city: 'Hong Kong', country: 'Hong Kong', event: 'Lunar New Year', window: ['2027-02-05', '2027-02-08'], baseline: ['2027-02-19', '2027-02-22'], set: 'Marriott',
    pairs: [p('Hong Kong Ocean Park Marriott', 246, 194), p('JW Marriott Hotel Hong Kong', 464, 343)],
  },
  {
    city: 'Rio de Janeiro', country: 'Brazil', event: 'Carnival', window: ['2027-02-05', '2027-02-10'], baseline: ['2027-02-19', '2027-02-24'], set: 'Marriott',
    pairs: [p('JW Marriott Hotel Rio de Janeiro', 959, 410)],
  },
  // Copacabana and Ipanema; the Copacabana Palace had no rate for Carnival.
  {
    city: 'Rio de Janeiro', country: 'Brazil', event: 'Carnival', window: ['2027-02-05', '2027-02-10'], baseline: ['2027-02-19', '2027-02-24'], set: '4-5★',
    pairs: [
      p('Atlantic Hotel Copacabana', 354, 89), p('Mar Palace Copacabana', 458, 153), p('Windsor Excelsior Copacabana', 581, 187),
      p('Hotel Rio Othon Palace', 630, 249), p('Pestana Rio Atlântica', 771, 231), p('Hilton Rio de Janeiro Copacabana', 865, 260),
    ],
  },
  // No Barcelona Marriott had a rate on either window. Mandarin Oriental,
  // Hotel 1898 and Sofitel Skipper had none for the congress nights.
  {
    city: 'Barcelona', country: 'Spain', event: 'Mobile World Congress', window: ['2027-02-28', '2027-03-04'], baseline: ['2027-03-14', '2027-03-18'], set: '4-5★',
    pairs: [p('La Casa Gran Bed & Breakfast', 312, 139), p('Hotel Duquesa de Cardona', 600, 213)],
  },
  // Mid-April is Rome's high season, so the fortnight after Easter cost more.
  {
    city: 'Rome', country: 'Italy', event: 'Easter', window: ['2027-03-25', '2027-03-29'], baseline: ['2027-04-08', '2027-04-12'], set: 'Marriott',
    pairs: [p('Rome Marriott Grand Hotel Flora', 675, 944)],
  },
  {
    city: 'Rome', country: 'Italy', event: 'Easter', window: ['2027-03-25', '2027-03-29'], baseline: ['2027-04-08', '2027-04-12'], set: '4-5★',
    pairs: [
      p('Caravel Hotel', 101, 116), p('River Palace Hotel', 139, 184), p('Hotel Quirinale', 206, 223), p('The Hoxton, Rome', 233, 316),
      p('NH Collection Roma Palazzo Cinquecento', 314, 433),
    ],
  },
  {
    city: 'Bangkok', country: 'Thailand', event: 'Songkran', window: ['2027-04-12', '2027-04-16'], baseline: ['2027-04-26', '2027-04-30'], set: 'Marriott',
    pairs: [
      p('Courtyard Bangkok', 127, 110), p('Courtyard Bangkok Sukhumvit 20', 128, 117), p('Aloft Bangkok Sukhumvit 11', 130, 124),
      p('Bangkok Marriott Hotel Sukhumvit', 199, 199), p('Bangkok Marriott Marquis Queen’s Park', 205, 187), p('JW Marriott Hotel Bangkok', 214, 214),
    ],
  },
  // The Netherlands' May school holiday (24 Apr-2 May 2027) covers it too.
  {
    city: 'Amsterdam', country: 'Netherlands', event: "King's Day", window: ['2027-04-26', '2027-04-28'], baseline: ['2027-04-12', '2027-04-14'], set: 'Marriott',
    pairs: [p('Amsterdam Marriott Hotel', 547, 536)],
  },
  {
    city: 'Amsterdam', country: 'Netherlands', event: "King's Day", window: ['2027-04-26', '2027-04-28'], baseline: ['2027-04-12', '2027-04-14'], set: '4-5★',
    pairs: [
      p('Fletcher Hotel Amsterdam', 147, 131), p('Four Elements Hotel Amsterdam', 148, 175), p('Mercure Hotel Amsterdam West', 159, 155),
      p('Inntel Hotels Amsterdam Zaandam', 185, 163), p('Tribe Amsterdam City', 228, 200), p('Grand Hotel Amrâth Amsterdam', 356, 344),
    ],
  },
  {
    city: 'Milan', country: 'Italy', event: 'Salone del Mobile', window: ['2027-04-12', '2027-04-16'], baseline: ['2027-04-26', '2027-04-30'], set: 'Marriott',
    pairs: [p('Milan Marriott Hotel', 860, 279)],
  },
  // Park Hyatt, Four Seasons, Casa Cipriani, Excelsior Gallia and Hotel
  // Indigo had no rate for the fair's nights.
  {
    city: 'Milan', country: 'Italy', event: 'Salone del Mobile', window: ['2027-04-12', '2027-04-16'], baseline: ['2027-04-26', '2027-04-30'], set: '4-5★',
    pairs: [
      p('Hotel Da Vinci Milano', 311, 103), p('Milan Suite Hotel', 374, 115), p('NH Collection Milano CityLife', 719, 231), p('Meliá Milano', 777, 255),
      p('Hyatt Centric Milan Centrale', 787, 338),
    ],
  },

  // Marriott's other brands, searched by name (20 Oct 2026, same windows as above).
  // Sharjah's hotels came back in Dubai's search and are left out; the
  // Sheraton Jumeirah Beach had no rate for New Year's Eve.
  {
    city: 'Dubai', country: 'UAE', event: 'New Year', window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: 'Sheraton, Le Méridien',
    pairs: [
      p('Four Points by Sheraton Bur Dubai', 226, 125), p('Four Points by Sheraton Production City', 250, 93), p('Four Points by Sheraton Sheikh Zayed Road', 401, 210),
      p('Sheraton Dubai Creek Hotel & Towers', 473, 193), p('Sheraton Mall of the Emirates Hotel', 501, 240), p('Sheraton Grand Hotel, Dubai', 553, 287),
      p('Sheraton The Walk, Dubai', 566, 217), p('Le Méridien Dubai Hotel & Conference Centre', 323, 215), p('Le Méridien Mina Seyahi Beach Resort', 726, 290),
      p('Le Royal Méridien Beach Resort & Spa', 856, 356),
    ],
  },
  {
    city: 'Abu Dhabi', country: 'UAE', event: 'Grand Prix', window: ['2026-12-03', '2026-12-06'], baseline: ['2026-11-19', '2026-11-22'], set: 'Sheraton',
    pairs: [p('Sheraton Khalidiya Hotel', 359, 132), p('Sheraton Abu Dhabi Hotel & Resort', 634, 229)],
  },
  // The Sheraton Grand and the Four Points Flex had no rate for Hogmanay.
  {
    city: 'Edinburgh', country: 'United Kingdom', event: 'Hogmanay', window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: 'Moxy, W',
    pairs: [p('Moxy Edinburgh', 398, 93), p('W Edinburgh', 776, 289)],
  },
  // Sheraton Lincoln Harbor came back too but is in New Jersey, so it's left out.
  {
    city: 'New York', country: 'United States', event: "New Year's Eve", window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: 'Moxy, Sheraton',
    pairs: [
      p('Moxy NYC Downtown', 381, 176), p('Moxy Brooklyn Williamsburg', 413, 209), p('Moxy NYC East Village', 529, 302), p('Moxy NYC Chelsea', 551, 253),
      p('Moxy NYC Lower East Side', 600, 225), p('Moxy NYC Times Square', 996, 195), p('Four Points by Sheraton Flushing', 259, 151),
      p('Sheraton LaGuardia East Hotel', 276, 240), p('Sheraton Brooklyn New York Hotel', 419, 157), p('Four Points by Sheraton Manhattan SoHo Village', 450, 209),
      p('Sheraton New York Times Square Hotel', 502, 193), p('Four Points by Sheraton New York Downtown', 512, 141),
      p('Four Points by Sheraton Manhattan Midtown West', 598, 254), p('Four Points by Sheraton Midtown - Times Square', 644, 172),
      p('Sheraton Tribeca New York Hotel', 1292, 215),
    ],
  },
  // No Westin had a rate on either night.
  {
    city: 'Sydney', country: 'Australia', event: "New Year's Eve", window: ['2026-12-30', '2027-01-02'], baseline: ['2027-01-13', '2027-01-16'], set: 'Sheraton',
    pairs: [p('Sheraton Grand Sydney Hyde Park', 805, 334)],
  },
  {
    city: 'Singapore', country: 'Singapore', event: 'Lunar New Year', window: ['2027-02-05', '2027-02-08'], baseline: ['2027-02-19', '2027-02-22'], set: 'Sheraton, Westin',
    pairs: [p('Sheraton Towers Singapore', 337, 331), p('The Westin Singapore', 472, 366)],
  },
  {
    city: 'Hong Kong', country: 'Hong Kong', event: 'Lunar New Year', window: ['2027-02-05', '2027-02-08'], baseline: ['2027-02-19', '2027-02-22'], set: 'Sheraton',
    pairs: [p('Sheraton Hong Kong Hotel & Towers', 363, 225)],
  },
  {
    city: 'Rio de Janeiro', country: 'Brazil', event: 'Carnival', window: ['2027-02-05', '2027-02-10'], baseline: ['2027-02-19', '2027-02-24'], set: 'Sheraton',
    pairs: [p('Sheraton Grand Rio Hotel & Resort', 1030, 526)],
  },
  {
    city: 'Rome', country: 'Italy', event: 'Easter', window: ['2027-03-25', '2027-03-29'], baseline: ['2027-04-08', '2027-04-12'], set: 'Sheraton',
    pairs: [p("Sheraton Rome Parco de' Medici", 154, 188), p("Sheraton Golf Parco de' Medici", 166, 199)],
  },
  {
    city: 'Bangkok', country: 'Thailand', event: 'Songkran', window: ['2027-04-12', '2027-04-16'], baseline: ['2027-04-26', '2027-04-30'], set: 'Sheraton',
    pairs: [
      p('Four Points by Sheraton Bangkok Ploenchit Sukhumvit', 110, 107), p('Four Points by Sheraton Bangkok, Sukhumvit 22', 116, 116),
      p('Royal Orchid Sheraton Riverside Hotel Bangkok', 122, 123), p('Sheraton Grande Sukhumvit, a Luxury Collection Hotel', 256, 256),
    ],
  },
  {
    city: 'Amsterdam', country: 'Netherlands', event: "King's Day", window: ['2027-04-26', '2027-04-28'], baseline: ['2027-04-12', '2027-04-14'], set: 'Moxy',
    pairs: [p('Moxy Amsterdam Houthavens', 262, 252)],
  },
  // AC Hotel Milano had no rate for the fair's nights.
  {
    city: 'Milan', country: 'Italy', event: 'Salone del Mobile', window: ['2027-04-12', '2027-04-16'], baseline: ['2027-04-26', '2027-04-30'], set: 'Sheraton',
    pairs: [p('Sheraton Milan San Siro', 694, 260)],
  },
  {
    city: 'Tokyo', country: 'Japan', event: 'Golden Week', window: ['2027-05-01', '2027-05-05'], baseline: ['2027-05-15', '2027-05-19'], set: 'Courtyard, Sheraton',
    pairs: [p('Courtyard by Marriott Tokyo Ginza', 519, 571), p('Sheraton Miyako Hotel Tokyo', 291, 363)],
  },
  // The Renaissance Vendôme had no rate for the holiday nights.
  {
    city: 'Paris', country: 'France', event: 'Christmas school holidays', window: ['2026-12-19', '2026-12-23'], baseline: ['2026-11-28', '2026-12-02'], set: 'Renaissance',
    pairs: [
      p('Renaissance Paris Hippodrome de St. Cloud', 179, 176), p('Renaissance Paris La Defense', 204, 277), p('Renaissance Paris Republique', 359, 421),
      p('Renaissance Paris Nobel Tour Eiffel', 409, 440), p('Renaissance Paris Arc de Triomphe', 573, 551),
    ],
  },
];

// Events with no sample yet, and why: Munich's Oktoberfest (18 Sep-3 Oct
// 2027) had no published rates when searched, eleven months out. Sub-brand
// searches found nothing priced for both windows in Barcelona (AC Hotels,
// Renaissance: none for the congress nights) or Mexico City (the Sheraton
// Maria Isabel: none for the event weekend).

// Marriott's member rate is 2-3% under the booking sites' price for the
// same room: the user's own observation (20 Oct 2026). 2.5%, the middle,
// is taken off cash a Marriott night would cost.
export const MEMBER_RATE_DISCOUNT: Record<string, number> = { 'Marriott Bonvoy': 0.025 };
