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
// Prix, Rio's Carnival, Lisbon's Web Summit, Berlin's EULAR congress,
// Munich's trade fairs, the Open at St Andrews (Edinburgh's hotels, 50 miles
// off, at 1.8 times a fortnight later). Some that sound big barely move: Las Vegas's Grand Prix
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
  {
    // electronica, the electronics trade fair, is at Messe München on 10-13
    // November 2026 (electronica.de). Munich's November search was moved to
    // the 24th to miss it: the Sofitel was $658 a night for the fair against
    // $259 a fortnight later.
    city: 'Munich', country: 'Germany', event: 'electronica', window: ['2026-11-10', '2026-11-13'], baseline: ['2026-11-24', '2026-11-27'],
    note: 'Hotels at the airport and in Weßling, Garching, Olching, Erding, Haar, Aschheim, Feldkirchen and Taufkirchen that came back in the group searches are left out.',
  },
  {
    // BAU, the building trade fair, is at Messe München on 11-15 January
    // 2027 (bau-muenchen.com). Munich's January search was moved to the
    // 25th to miss it.
    city: 'Munich', country: 'Germany', event: 'BAU', window: ['2027-01-11', '2027-01-15'], baseline: ['2027-01-25', '2027-01-29'],
    note: 'Hotels at the airport and in nearby towns are left out, as for electronica.',
  },
  {
    // IAA Mobility is at Messe München and in the city centre on 7-12
    // September 2027, its Summit on 7-10 September (iaa-mobility.com). Set
    // against the fortnight before, not after: the week after is the one
    // before Oktoberfest (from the 18th), when several city-centre Marriotts
    // were dearer still (the Aloft $908 against $444 for the show).
    city: 'Munich', country: 'Germany', event: 'IAA Mobility', window: ['2027-09-07', '2027-09-10'], baseline: ['2027-08-24', '2027-08-27'],
    note: 'Hotels by the Messe went up most (Four Points Messe $268 against $79). Hotels at the airport and in nearby towns are left out.',
  },
  {
    // The Canadian International AutoShow, 12-21 February 2027 at the Metro
    // Toronto Convention Centre (Tradefest; EventsEye). The February month
    // search (10-13 February) is its media days and opening weekend, so
    // February is 24-27 February, the same weekdays a fortnight later.
    city: 'Toronto', country: 'Canada', event: 'Canadian International AutoShow', window: ['2027-02-10', '2027-02-13'], baseline: ['2027-02-24', '2027-02-27'],
    note: 'Measured on the 4-5★ and Marriott searches: x1.03 across 15 hotels, Marriott\'s x1.04 across 9. The show left prices about where they were (the Westin Harbour Castle x1.20, Hotel X x0.85).',
  },
  {
    // PDAC, the mining industry's convention, 7-10 March 2027 at the Metro
    // Toronto Convention Centre and the Fairmont Royal York (pdac.ca). The
    // window is its Sunday to Tuesday nights; the plain nights are the same
    // weekdays a fortnight later. The March month search (10-13 March)
    // starts the night it ends.
    city: 'Toronto', country: 'Canada', event: 'PDAC', window: ['2027-03-07', '2027-03-10'], baseline: ['2027-03-21', '2027-03-24'],
    note: 'Measured on the 4-5★ and every group\'s searches: x2.43 across 16 hotels. Downtown rose most (the Hilton Toronto x7.28, the Novotel Toronto Centre x4.85, the Hyatt Regency x3.32); North York\'s hotels, half an hour north, x0.97-1.35. Only two Marriotts had a rate for the convention nights (x2.56: the Eaton Centre x2.42, the Ritz-Carlton x2.70); the rest downtown and the Fairmont Royal York, the second venue, had none.',
  },
  {
    // The Canadian National Exhibition, 20 August to 6 September 2027 at
    // Exhibition Place (theex.com dates via Wikipedia). The window is its
    // second Thursday to Saturday nights; the plain nights are the same
    // weekdays a fortnight earlier, a week before it opens.
    city: 'Toronto', country: 'Canada', event: 'CNE', window: ['2027-08-26', '2027-08-29'], baseline: ['2027-08-12', '2027-08-15'],
    note: 'Measured on the 4-5★ and Marriott searches: x1.00 across 13 hotels, Marriott\'s x1.03 across 7. The fair left the city\'s prices as they were; Hotel X, on the exhibition grounds, was x0.84.',
  },
  {
    // The Toronto International Film Festival opens the Thursday after
    // Labour Day (4-14 September 2025, 10-20 September 2026), so 9-19
    // September 2027; tiff.net hadn't published 2027's dates when searched.
    // The window is its first Monday to Wednesday nights; the plain nights
    // are the same weekdays the week after it, as a fortnight later wasn't
    // priced yet. September's month observation is those plain nights.
    city: 'Toronto', country: 'Canada', event: 'TIFF', window: ['2027-09-13', '2027-09-16'], baseline: ['2027-09-20', '2027-09-23'],
    note: 'Measured on the 4-5★ and every group\'s searches: x1.20 across 17 hotels, Marriott\'s x1.28 across 3. The Fairmont Royal York x1.65 and the Novotel Toronto Centre x1.80; the InterContinental and North York\'s hotels held their price. The Ritz-Carlton\'s cheapest room was $7,254 a night (x11.87).',
  },
  {
    // AME Roundup, the mineral exploration conference, Monday 25 to Thursday
    // 28 January 2027 at the Vancouver Convention Centre East (roundup.amebc.ca).
    // The window is its Monday to Wednesday nights; the plain nights are the
    // same weekdays a fortnight earlier, as a fortnight later is BUILDEX.
    city: 'Vancouver', country: 'Canada', event: 'AME Roundup', window: ['2027-01-25', '2027-01-28'], baseline: ['2027-01-11', '2027-01-14'],
    note: 'Measured on the 4-5★ and Marriott searches: x1.21 across 12 hotels, Marriott\'s x1.34 across 8. The hotels nearest the convention centre rose most (the Marriott Pinnacle x1.69, the Westin Bayshore x1.59, the Delta Downtown Suites x1.50); those at the south end of downtown held their price (the Sheraton Wall Centre x0.96, the JW Marriott Parq x1.04).',
  },
  {
    // Web Summit Vancouver, 25-28 May 2027 at the Vancouver Convention Centre
    // (Dealroom; Beri; Web Summit committed to May 2025-2027, City of
    // Vancouver, 12 May 2025). The window is its Tuesday to Thursday nights;
    // the plain nights are the same weekdays a fortnight earlier.
    city: 'Vancouver', country: 'Canada', event: 'Web Summit Vancouver', window: ['2027-05-25', '2027-05-28'], baseline: ['2027-05-11', '2027-05-14'],
    note: 'Measured on the 4-5★ and Marriott searches: x0.97 across 11 hotels, Marriott\'s x0.95 across 7. The summit left prices as they were; the Marriott Pinnacle was dearer the fortnight before ($877 a night against $465).',
  },
  {
    // The Canadian Grand Prix, a sprint weekend, Friday 21 to Sunday 23 May
    // 2027 at Circuit Gilles-Villeneuve (the 2027 F1 calendar, FIA, 16 Sep
    // 2026). The window is its Thursday to Saturday nights; the plain nights
    // are the same weekdays a fortnight earlier.
    city: 'Montreal', country: 'Canada', event: 'Canadian Grand Prix', window: ['2027-05-20', '2027-05-23'], baseline: ['2027-05-06', '2027-05-09'],
    note: 'Measured on the 4-5★ and every group\'s searches: x3.25 across 9 hotels, Hilton\'s x3.46 across 6. Most hotels had no rate left for the race weekend 205 days out (16 of 18 Marriotts, every Accor); those still selling were about three times their price a fortnight before (the AC Hotel Old Montreal x3.25, the Hyatt Centric x2.81, the Spark Midtown x5.65).',
  },
  {
    // IUPAC 2027, the World Chemistry Congress and IUPAC General Assembly, 16-23
    // July 2027 at the Palais des congrès, for up to 3,500 delegates (IUPAC
    // Council, 2021; Quebec government). The window is the congress's Sunday
    // to Tuesday nights; the plain nights are the same weekdays a fortnight
    // earlier.
    city: 'Montreal', country: 'Canada', event: 'IUPAC World Chemistry Congress', window: ['2027-07-18', '2027-07-21'], baseline: ['2027-07-04', '2027-07-07'],
    note: 'Measured on the 4-5★ and Marriott searches: x1.01 across 16 hotels, Marriott\'s x1.01 across 9. The congress left prices as they were.',
  },
  {
    // Lollapalooza Argentina, Friday 12 to Sunday 14 March 2027 at the
    // Hipódromo de San Isidro, just outside the city (El Litoral; Infobae,
    // 1 Jun 2026). The window is its three nights; the plain nights are the
    // same weekdays a fortnight before, as the fortnight after is Easter.
    // Buenos Aires' March search (10-13 March) took in its first night.
    city: 'Buenos Aires', country: 'Argentina', event: 'Lollapalooza Argentina', window: ['2027-03-12', '2027-03-15'], baseline: ['2027-02-26', '2027-03-01'],
    note: 'Measured on the 4-5★ and every group\'s searches: x1.22 across 18 hotels, Marriott\'s x1.30 across 5, Accor\'s x1.04 across 7. The festival is out of town, so most hotels moved little; a few were far dearer (the Marriott Downtown $1,651 a night against $209, the Park Hyatt $1,229 against $703), and the Hilton, InterContinental and Four Seasons had no rate left.',
  },
  {
    // FILBo, Bogotá's international book fair, 20 April to 3 May 2027 at
    // Corferias (Noticias RCN, 25 Sep 2026; PredictHQ). The window is the
    // city's April search, inside the fair; the plain nights are the same
    // weekdays a fortnight before, clear of Easter (28 March).
    city: 'Bogota', country: 'Colombia', event: 'FILBo', window: ['2027-04-21', '2027-04-24'], baseline: ['2027-04-07', '2027-04-10'],
    note: 'Measured on the 4-5★, Marriott, Hilton and Accor searches: x1.00 across 30 hotels, Marriott\'s x1.00 across 10, Hilton\'s x1.00 across 8. The fair left prices as they were; the Hilton by Corferias, next to it, was x1.31 ($199 a night against $152).',
  },
  {
    // Cartagena's Fiestas de Independencia: the main week 6-12 November 2026,
    // the Festival Náutico 13-14 November, closing on the 16th, a national
    // holiday (El Universal, 16 Sep 2026). The window is the city's November
    // search, 11 November itself to the 14th. The plain nights are the same
    // weekdays a week after, clear of the fiestas: a fortnight before is the
    // next day's rates (searched 27 October), a fortnight after US Thanksgiving.
    city: 'Cartagena', country: 'Colombia', event: 'Fiestas de Independencia', window: ['2026-11-11', '2026-11-14'], baseline: ['2026-11-18', '2026-11-21'],
    note: 'Measured on the 4-5★ and the Hilton, Hyatt, IHG and Accor searches (no Marriott came back priced in Cartagena): x1.02 across 13 hotels, IHG\'s x1.14 across 3, Hilton\'s x1.02 across 3. The fiestas left prices much as they were; the Hilton Cartagena was dearer the week after ($377 a night against $206), with no event found to say why.',
  },
  {
    // Cartagena Festival de Música, its 21st edition, 9-17 January 2027 (Rio
    // Times; colombia.travel). The window is the city's January search, inside
    // it. The plain nights are the same weekdays a week after: a fortnight
    // before is New Year, a fortnight after the Hay Festival (28-31 January).
    city: 'Cartagena', country: 'Colombia', event: 'Cartagena Festival de Música', window: ['2027-01-13', '2027-01-16'], baseline: ['2027-01-20', '2027-01-23'],
    note: 'Measured on the 4-5★ and the Hilton, Hyatt, IHG and Accor searches: x0.94 across 15 hotels, IHG\'s x0.88 across 3, Hilton\'s x1.02 across 3. The festival, in the walled city, left prices as they were: the Sofitel Legend there was x1.33 ($855 a night against $641), the beach and Manga hotels a little cheaper than the week after.',
  },
  {
    // 3 Days of Design, 9-11 June 2027, across Copenhagen's showrooms and
    // galleries (Dezeen events guide); Optica's Quantum 2.0 conference is at
    // the Bella Center 7-10 June. The window is the city's June search. The
    // plain nights are the same weekdays a fortnight after, before Roskilde
    // Festival's opening weekend; a fortnight before runs into Euroanaesthesia
    // at the Bella Center (29-31 May).
    city: 'Copenhagen', country: 'Denmark', event: '3 Days of Design', window: ['2027-06-09', '2027-06-12'], baseline: ['2027-06-23', '2027-06-26'],
    note: 'Measured on the 4-5★ and the Marriott and IHG searches (no Hilton, Hyatt or Accor came back priced in Copenhagen): x1.41 across 15 hotels, Marriott\'s x1.34 across 6. The city-centre hotels were dearest: the Radisson Collection Royal x1.89 ($821 a night against $434), the Copenhagen Marriott $865 against $602.',
  },
  {
    // Nobel Week, with the prize ceremony and banquet on 10 December
    // (nobelprize.org: Nobel Week Dialogue 9 December 2026; Nobel Week Lights
    // 5-13 December, visitstockholm.com). The window is the city's December
    // search. The plain nights are a fortnight before: a fortnight after is
    // Christmas. The laureates and their families stay at the Grand Hôtel
    // (grandhotel.se), the one hotel the week moved.
    city: 'Stockholm', country: 'Sweden', event: 'Nobel Week', window: ['2026-12-09', '2026-12-12'], baseline: ['2026-11-25', '2026-11-28'],
    note: 'Measured on the 4-5★ and the Marriott, Hilton, Hyatt and IHG searches (no Accor came back priced in Stockholm): x0.97 across 16 hotels. Only the Grand Hôtel, where the laureates stay, rose: $1,459 a night against $430.',
  },
  {
    // The Nobel Peace Prize is presented at Oslo City Hall on 10 December
    // (nobelpeacecenter.org; visitoslo.com). The window is the city's December
    // search. The plain nights are a fortnight before: a fortnight after is
    // Christmas.
    city: 'Oslo', country: 'Norway', event: 'Nobel Peace Prize', window: ['2026-12-09', '2026-12-12'], baseline: ['2026-11-25', '2026-11-28'],
    note: 'Measured on the 4-5★ searches (no Marriott, Hilton, Hyatt, IHG or Accor came back priced in Oslo): x0.88 across 9 hotels. Prices eased into December rather than rising for the ceremony: the Grand Hotel $296 a night against $368.',
  },
  {
    // Nor-Shipping, 7-11 June 2027: the exhibition at NOVA Spektrum, Lillestrøm,
    // opening at Oslo City Hall on 7 June (nor-shipping.com; Hellenic Shipping
    // News). The window is the city's June search. The plain nights are a week
    // after: a fortnight before is late May, before Oslo's summer prices begin
    // (the same hotels were a quarter dearer on 16-19 June than 26-29 May), and
    // a fortnight after, the week of Sankthans (23 June), several were dearer
    // again.
    city: 'Oslo', country: 'Norway', event: 'Nor-Shipping', window: ['2027-06-09', '2027-06-12'], baseline: ['2027-06-16', '2027-06-19'],
    note: 'Measured on the 4-5★ searches (no Marriott, Hilton, Hyatt, IHG or Accor came back priced in Oslo): x1.54 across 7 hotels. The city-centre hotels were dearest: the Radisson Blu Scandinavia $482 a night against $246, the Grand Hotel $608 against $377.',
  },
  {
    // The EAACI Congress (European Academy of Allergy and Clinical
    // Immunology), 11-14 June 2027 in Helsinki (eaaci.org). The window is the
    // city's June search, taking in its first night and the night before. The
    // plain nights are a week after: a fortnight before, late May, several
    // hotels were dear themselves (the Hilton Strand $214 a night against $142
    // in mid-June), and a fortnight after is Midsummer, 25 June.
    city: 'Helsinki', country: 'Finland', event: 'EAACI Congress', window: ['2027-06-09', '2027-06-12'], baseline: ['2027-06-16', '2027-06-19'],
    note: 'Measured on the 4-5★ and the Marriott, Hilton and IHG searches (no Hyatt or Accor came back priced in Helsinki): x1.49 across 9 hotels, Hilton\'s x1.30 across 3, IHG\'s x1.90 across 2. The Crowne Plaza was $351 a night against $156, the Hilton Strand $315 against $142.',
  },
  {
    // Flow Festival, 13-15 August 2027 at Suvilahti (flowfestival.com press
    // release, 17 August 2026). The city's August search, 11-14 August, takes
    // in its first night, so the festival's own nights were searched. The
    // plain nights are a fortnight after: a fortnight before is the end of
    // July, Finland's holiday month.
    city: 'Helsinki', country: 'Finland', event: 'Flow Festival', window: ['2027-08-13', '2027-08-16'], baseline: ['2027-08-27', '2027-08-30'],
    note: 'Measured on the 4-5★ and the Marriott, Hilton and IHG searches (no Hyatt or Accor came back priced in Helsinki): x0.84 across 9 hotels. The festival nights were no dearer than plain ones a fortnight later: the Hotel Indigo $151 a night against $216, the Waldorf Astoria $367 against $364.',
  },
  {
    // Iceland Airwaves, 5-7 November 2026 in downtown Reykjavík, with its
    // industry conference on 5-6 November (Iceland Airwaves release, 8 April
    // 2026). The window is the festival's three nights, searched a week
    // before (28 October). The plain nights are a fortnight after: a
    // fortnight before had passed.
    city: 'Reykjavik', country: 'Iceland', event: 'Iceland Airwaves', window: ['2026-11-05', '2026-11-08'], baseline: ['2026-11-19', '2026-11-22'],
    note: 'Measured on the 4-5★ and the Hilton and IHG searches (no Hyatt or Accor came back priced in Reykjavík, and Marriott\'s only at Keflavík airport): x1.36 across 9 hotels, Hilton\'s x1.49 across 4. The hotels in the centre went up most: the Canopy $622 a night against $312, the Hotel Reykjavík Saga $428 against $253; the Hilton Reykjavik Nordica, out of the centre, was $190 against $201.',
  },
  {
    // The Winter Lights Festival, 4-7 February 2027 across the capital area's
    // six municipalities: a light trail, Museum Night and Pool Night, all free
    // (reykjavik.is). The city's February search, 10-13 February, is clear of
    // it, so its nights were searched on their own, against the same weekdays
    // a fortnight after.
    city: 'Reykjavik', country: 'Iceland', event: 'Winter Lights Festival', window: ['2027-02-04', '2027-02-07'], baseline: ['2027-02-18', '2027-02-21'],
    note: 'Measured on the 4-5★ and the Hilton searches: x0.94 across 9 hotels, Hilton\'s x0.94 across 4. The festival nights were no dearer than plain ones a fortnight later: the Konsulat $286 a night against $340, the Hotel Reykjavík Grand $188 against $183.',
  },
  {
    // Athens Marathon. The Authentic, Sunday 8 November 2026, from Marathon
    // to the Panathenaic Stadium, with the 5 km on the Saturday (organisers'
    // registration notice, 24 April 2026; sold out). The window is the race
    // weekend's three nights, searched nine days before. The plain nights are
    // a fortnight after: a fortnight before had passed.
    city: 'Athens', country: 'Greece', event: 'Athens Marathon', window: ['2026-11-06', '2026-11-09'], baseline: ['2026-11-20', '2026-11-23'],
    note: 'Measured on the 4-5★ and all five group searches: x1.50 across 16 hotels, Marriott\'s x2.05 across 4, Accor\'s x1.58 across 4, Hilton\'s x1.07 across 3. The hotels by Syntagma, near the finish, went up most: the King George $2,278 a night against $343, the Grande Bretagne $1,194 against $472; the Grand Hyatt on Syngrou was $185 against $411 (dearer itself a fortnight later).',
  },
  {
    // Cisco Live APJC, 9-12 November 2026 at the Melbourne Convention and
    // Exhibition Centre, South Wharf (ciscolive.com). The window is the city's
    // November search, 11-14 November, taking in its last nights. The plain
    // nights are the same weekdays a week after: a fortnight before is Derby
    // Day's eve and the next day's rates (searched 27 October), a fortnight
    // after Harry Styles at Marvel Stadium (27 and 28 November).
    city: 'Melbourne', country: 'Australia', event: 'Cisco Live', window: ['2026-11-11', '2026-11-14'], baseline: ['2026-11-18', '2026-11-21'],
    note: 'Measured on the 4-5★ and the Marriott, Hilton, Hyatt, IHG and Accor searches: x1.27 across 32 hotels, Marriott\'s x1.44 across 8, IHG\'s x1.18 across 8, Hyatt\'s x1.24 across 5, Accor\'s x1.13 across 5. The Crowne Plaza, on the river by the convention centre, was $905 a night against $287.',
  },
  {
    // The Australian Open's Opening Week, Monday 11 to Saturday 16 January 2027:
    // qualifying and practice at Melbourne Park, the main draw from Sunday the
    // 17th (Melbourne Park: three weeks, 11-31 January). The window is the
    // city's January search. The plain nights are the same weekdays a week
    // before, as a fortnight before is New Year.
    city: 'Melbourne', country: 'Australia', event: 'Australian Open (Opening Week)', window: ['2027-01-13', '2027-01-16'], baseline: ['2027-01-06', '2027-01-09'],
    note: 'Measured on the 4-5★ and the Marriott, Hilton, Hyatt, IHG and Accor searches: x1.10 across 41 hotels, Marriott\'s x1.10 across 10, IHG\'s x1.12 across 9, Accor\'s x1.19 across 9. Qualifying moved prices a little, a few hotels a lot: the Crowne Plaza Carlton x1.85, the Westin x1.64.',
  },
  {
    // The Australian Open's main draw, 17-31 January 2027 (Melbourne Park; LTA;
    // Sportsnet Holidays): the window is its first Wednesday to Saturday. The
    // plain nights are 6-9 January, a fortnight before: the week before that
    // is New Year, and the weeks after are the rest of the Open and BTS.
    city: 'Melbourne', country: 'Australia', event: 'Australian Open', window: ['2027-01-20', '2027-01-23'], baseline: ['2027-01-06', '2027-01-09'],
    note: 'Measured on the 4-5★ and the Marriott, Hilton, Hyatt, IHG and Accor searches: x3.00 across 33 hotels, Marriott\'s x2.94 across 10, IHG\'s x2.96 across 9, Hyatt\'s x3.16 across 5, Hilton\'s x3.49 across 4. The Westin was $874 a night against $177, the Ritz-Carlton $1,511 against $530.',
  },
  {
    // BTS at Marvel Stadium, Docklands, on 10, 12 and 13 February 2027, their
    // ARIRANG world tour (Variety Australia; austadiums). The window is the
    // city's February search. The plain nights are the same weekdays a week
    // before: a fortnight before is the Open's last week, a fortnight after
    // Bruno Mars at the same stadium (19, 20, 23 and 24 February).
    city: 'Melbourne', country: 'Australia', event: 'BTS at Marvel Stadium', window: ['2027-02-10', '2027-02-13'], baseline: ['2027-02-03', '2027-02-06'],
    note: 'Measured on the 4-5★ and the Marriott, Hilton, Hyatt, IHG and Accor searches: x2.12 across 36 hotels, Marriott\'s x1.88 across 9, IHG\'s x2.45 across 9, Accor\'s x2.11 across 7, Hilton\'s x2.16 across 4. The Marriott Docklands, next to the stadium, was $643 a night against $198.',
  },
  {
    // The 150th Anniversary Test, Australia v England at the MCG under lights,
    // 11-15 March 2027 (Cricket Australia; ICC; cricket.com.au), 150 years on
    // from the first Test there. The window is the city's March search. The
    // plain nights are the same weekdays a week after: a fortnight before is
    // Bruno Mars's last night, a fortnight after the Comedy Festival's opening
    // and Easter.
    city: 'Melbourne', country: 'Australia', event: 'MCG 150th Anniversary Test', window: ['2027-03-10', '2027-03-13'], baseline: ['2027-03-17', '2027-03-20'],
    note: 'Measured on the 4-5★ and the Marriott, Hilton, Hyatt, IHG and Accor searches: x1.42 across 32 hotels, Marriott\'s x1.32 across 10, IHG\'s x1.42 across 8, Hyatt\'s x1.64 across 5, Hilton\'s x1.42 across 4. The Ritz-Carlton was $982 a night against $547.',
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
  {
    // TIFF's opening weekend (see TIFF above). A fortnight later wasn't
    // priced when searched and a fortnight earlier is the CNE's last
    // weekend, so its own uplift couldn't be measured; its nights are kept
    // out of September's season all the same.
    city: 'Toronto', country: 'Canada', event: 'TIFF opening weekend', window: ['2027-09-09', '2027-09-12'],
    why: 'The same nights a fortnight later had no published rates when searched, eleven months out, and a fortnight earlier is the CNE.',
  },
  {
    // The Melbourne Cup Carnival at Flemington: Derby Day 31 October 2026,
    // Cup Day 3 November (a public holiday in Melbourne), Oaks Day 5
    // November, Stakes Day 7 November (VRC). The window starts the night
    // before Derby Day, which the city's October search, 28-31 October,
    // takes in.
    city: 'Melbourne', country: 'Australia', event: 'Melbourne Cup Carnival', window: ['2026-10-30', '2026-11-08'],
    why: 'Searched the week before, so the plain nights a fortnight earlier had gone; its first night was only priced at the next day\'s rates.',
  },
  {
    // Harry Styles at Marvel Stadium, Docklands, on 27 and 28 November 2026
    // (Marvel Stadium), with two more shows on 2 and 4 December.
    city: 'Melbourne', country: 'Australia', event: 'Harry Styles at Marvel Stadium', window: ['2026-11-27', '2026-11-29'],
    why: 'Only 25-28 November was searched, taking in the first show\'s night; the shows\' own nights weren\'t priced against plain ones.',
  },
  {
    // Bruno Mars at Eden Park on 13, 14 and 16 March 2027, three sold-out
    // nights (1News, 3 Sep 2026; Le Petit Journal). The window starts the night
    // before the first show, which the city's March search, 10-13 March, takes in.
    city: 'Auckland', country: 'New Zealand', event: 'Bruno Mars at Eden Park', window: ['2027-03-12', '2027-03-17'],
    why: 'The March search took in only the night before the first show: x1.16 against the week after across 24 hotels. The shows\' own nights weren\'t priced.',
  },
];

// Marriott's member rate is 2-3% under the booking sites' price for the
// same room: the user's own observation (20 Oct 2026). 2.5%, the middle,
// is taken off cash a Marriott night would cost.
export const MEMBER_RATE_DISCOUNT: Record<string, number> = { 'Marriott Bonvoy': 0.025 };
