// What a reward seat from London costs in points, and the cash that goes
// with it, for the programmes the user holds points in: Avios (on BA, or
// on Qatar Airways at Qatar's own prices), Virgin Points and KrisFlyer.
// One way, per person. Only routes with a sourced price are listed;
// anywhere else gets no points figure rather than an extrapolated one.
//
// `cash` is all the money paid on top of the points, one way, where a
// source gives it. Null means no sourced figure. `cashEstimated` marks a
// figure from before a later rise.
//
// Two kinds of airline here. Qatar, Virgin and Singapore pass the taxes
// and their own charges on, so UK Air Passenger Duty is the least the cash
// can be and stands in for it when it isn't known. British Airways
// doesn't: it sets one cash amount per cabin and destination band and
// pays the taxes out of it, which can come to less than APD alone (£2.50
// to Amsterdam, where APD is £15). So a BA seat with no sourced cash shows
// none, not APD.

import type { AwardCabin } from './awardClasses';
import type { SeasonCalendar } from './awardSeasons';

export type AwardCurrency = 'Avios' | 'Virgin Points' | 'KrisFlyer miles';

export interface AwardPrice {
  offPeak: number;
  peak: number | null;
  cash: number | null; // GBP, one way
  cashEstimated?: boolean;
}

export const AWARD_AIRLINES = { BA: 'British Airways', QR: 'Qatar Airways', VS: 'Virgin Atlantic', SQ: 'Singapore Airlines' } as const;

export interface AwardRoute {
  airline: keyof typeof AWARD_AIRLINES;
  currency: AwardCurrency;
  place: string; // where it flies to, as shown
  airports: string[]; // IATA codes that count as this place
  cabins: Partial<Record<AwardCabin, AwardPrice>>;
  /** Taxes and charges passed on to the passenger, so APD is a floor (not BA). */
  taxesPassedOn: boolean;
  /** Whose peak calendar prices it (src/data/awardSeasons.ts); null where none is published. */
  calendar: SeasonCalendar | null;
  source: string;
}

// British Airways prices each route from London separately, off-peak and
// peak. Points: Head for Points' route prices of 1 Aug 2026, as reproduced
// by Award Travel Finder ("British Airways Avios Prices (2026)"), checked
// 18 Oct 2026. BA put the cash part up by 10-33% on 27 May 2026 (Avios
// unchanged); cash after that date:
//  - Euro Traveller: £5 return, so £2.50 each way (Points Well Made).
//  - Club Europe to Rome: 44,000 Avios + £40 return off-peak (AwardWallet,
//    Points Well Made), so 22,000 + £20 each way.
//  - Gulf, North-East US and Eastern Canada band: £75 economy and £249.50
//    business each way (Points Well Made's band table); New York Club
//    World 176,000 Avios + £499 return agrees (AwardWallet).
//  - Cape Town World Traveller: 66,000 Avios + £190 return off-peak
//    (AwardWallet), so 33,000 + £95 each way.
// Business to Tokyo, Bangkok and Singapore: £299.50, £299.50 and £335
// (Head for Points, Jan 2026), from before the May rise, so estimated. No
// sourced cash for economy there.
const BA_SOURCE = 'Head for Points route prices, 1 Aug 2026; cash after BA’s 27 May 2026 rise: Points Well Made, AwardWallet; Asia business: HFP Jan 2026';
const ba = (place: string, airports: string[], cabins: AwardRoute['cabins']): AwardRoute => ({ airline: 'BA', currency: 'Avios', place, airports, cabins, taxesPassedOn: false, calendar: 'BA', source: BA_SOURCE });

// Qatar Airways doesn't publish a chart for its own flights; these are its
// off-peak prices from the UK. Doha: AwardFares' Privilege Club guide
// (2026). Bangkok, Abu Dhabi, Melbourne and Auckland: Head for Points,
// "How much are Qatar Airways Avios redemptions from the UK?", 2 Jan 2026.
// ba.com books Qatar flights at the same prices. No sourced cash figure.
const QR_SOURCE = 'Head for Points, 2 Jan 2026; AwardFares Privilege Club guide, 2026';
const qr = (place: string, airports: string[], economy: number, business: number): AwardRoute => ({
  airline: 'QR', currency: 'Avios', place, airports, taxesPassedOn: true, calendar: null, source: QR_SOURCE,
  cabins: { Economy: { offPeak: economy, peak: null, cash: null }, Business: { offPeak: business, peak: null, cash: null } },
});

// Virgin Atlantic Saver seats: Virgin's own maximum Saver prices from the
// UK by region, standard season (flywith.virginatlantic.com, "Saver reward
// seats"), checked 18 Oct 2026. Saver prices move with demand up to these
// caps, so they're the most a Saver seat costs. Peak caps for New York and
// the West Coast: Reward Seat Scout (2026); Virgin's page doesn't list them.
// Cash from London on US routes, after Virgin's April 2026 rise: £244
// economy (Head for Points, 3 Apr 2026), £468 premium and £720 Upper Class
// (Upgraded Points; Points Well Made gives the same £720). No sourced cash
// figure for the other regions.
const VS_SOURCE = 'Virgin Atlantic maximum Saver prices (standard season); cash: Head for Points 3 Apr 2026, Upgraded Points';
const VS_US_CASH = { Economy: 244, 'Premium Economy': 468, Business: 720 } as const;
const vs = (place: string, airports: string[], [e, p, u]: [number, number, number], opts: { peak?: [number, number, number]; usCash?: boolean } = {}): AwardRoute => {
  const price = (cabin: keyof typeof VS_US_CASH, off: number, peak: number | undefined): AwardPrice => ({
    offPeak: off, peak: peak ?? null, cash: opts.usCash ? VS_US_CASH[cabin] : null,
  });
  return {
    airline: 'VS', currency: 'Virgin Points', place, airports, taxesPassedOn: true, source: VS_SOURCE,
    calendar: place === 'Caribbean' || place === 'Maldives' ? 'VS-Caribbean' : 'VS',
    // Upper Class is Virgin's business cabin.
    cabins: { Economy: price('Economy', e, opts.peak?.[0]), 'Premium Economy': price('Premium Economy', p, opts.peak?.[1]), Business: price('Business', u, opts.peak?.[2]) },
  };
};

// KrisFlyer Saver on Singapore Airlines, Europe to Singapore, on the chart
// in force since 1 Nov 2025: Mainly Miles (Apr 2026) and SuiteSmile (Mar
// 2026) agree. Singapore Airlines has added no fuel surcharge to its own
// reward tickets since March 2017, so the cash is taxes alone; no sourced
// total from London, so the screen shows APD as the floor.
const SQ_SOURCE = 'KrisFlyer Saver chart from 1 Nov 2025 (Mainly Miles Apr 2026, SuiteSmile Mar 2026)';

export const AWARD_ROUTES: AwardRoute[] = [
  ba('Paris, Amsterdam or Dublin', ['CDG', 'ORY', 'AMS', 'DUB'], { Economy: { offPeak: 10000, peak: 10750, cash: 2.5 } }),
  ba('Rome', ['FCO'], { Business: { offPeak: 22000, peak: null, cash: 20 } }),
  ba('Cape Town', ['CPT'], { Economy: { offPeak: 33000, peak: null, cash: 95 } }),
  // BA's price is for JFK; Newark and LaGuardia are the same city.
  ba('New York', ['JFK', 'EWR', 'LGA'], {
    Economy: { offPeak: 27500, peak: 33000, cash: 75 },
    Business: { offPeak: 88000, peak: 99000, cash: 249.5 },
  }),
  ba('Dubai', ['DXB', 'DWC'], {
    Economy: { offPeak: 27500, peak: 33000, cash: 75 },
    Business: { offPeak: 88000, peak: 99000, cash: 249.5 },
  }),
  ba('Tokyo', ['HND', 'NRT'], {
    Economy: { offPeak: 38500, peak: 44000, cash: null },
    Business: { offPeak: 110000, peak: 121000, cash: 299.5, cashEstimated: true },
  }),
  ba('Bangkok', ['BKK'], {
    Economy: { offPeak: 38500, peak: 44000, cash: null },
    Business: { offPeak: 110000, peak: 121000, cash: 299.5, cashEstimated: true },
  }),
  ba('Singapore', ['SIN'], {
    Economy: { offPeak: 44000, peak: 49500, cash: null },
    Business: { offPeak: 121000, peak: 132000, cash: 335, cashEstimated: true },
  }),

  qr('Doha', ['DOH'], 20000, 42500),
  qr('Abu Dhabi', ['AUH'], 22500, 45000),
  qr('Bangkok', ['BKK'], 37500, 75000),
  qr('Melbourne', ['MEL'], 45000, 90000),
  qr('Auckland', ['AKL'], 45000, 90000),

  vs('New York', ['JFK', 'EWR', 'LGA'], [10000, 17500, 47500], { peak: [20000, 27500, 57500], usCash: true }),
  vs('US East Coast and Orlando', ['BOS', 'IAD', 'ATL', 'MCO', 'MIA', 'TPA'], [12500, 22500, 47500], { usCash: true }),
  vs('US West Coast', ['LAX', 'SFO', 'SEA', 'LAS'], [15000, 27500, 67500], { peak: [25000, 37500, 77500], usCash: true }),
  vs('Caribbean', ['BGI', 'ANU', 'GND', 'TAB', 'MBJ', 'UVF'], [10000, 17500, 57500]),
  vs('Africa', ['JNB', 'CPT', 'LOS'], [12500, 25000, 57500]),
  vs('Maldives', ['MLE'], [12500, 25000, 57500]),
  vs('India', ['DEL', 'BOM', 'BLR'], [10000, 17500, 37500]),
  vs('Dubai and the Middle East', ['DXB', 'RUH'], [10000, 17500, 37500]),

  {
    airline: 'SQ', currency: 'KrisFlyer miles', place: 'Singapore', airports: ['SIN'], taxesPassedOn: true, calendar: null, source: SQ_SOURCE,
    cabins: {
      Economy: { offPeak: 44000, peak: null, cash: null },
      'Premium Economy': { offPeak: 74500, peak: null, cash: null },
      Business: { offPeak: 108500, peak: null, cash: null },
      First: { offPeak: 148000, peak: null, cash: null },
    },
  },
];

// Which of the user's programmes holds each currency, by name.
export const CURRENCY_PROGRAMME: Record<AwardCurrency, RegExp> = {
  Avios: /avios|executive club|privilege club/i,
  'Virgin Points': /virgin/i,
  'KrisFlyer miles': /krisflyer/i,
};

// Perks a status gives on a carrier, from the programme's own pages.
// KrisFlyer Elite Gold is Star Alliance Gold, and Singapore Airlines lists
// lounge access on Singapore Airlines, Star Alliance partners and Virgin
// Atlantic, even in economy (singaporeair.com, "KrisFlyer Elite Gold
// benefits", checked 18 Oct 2026).
export const STATUS_PERKS: { programme: RegExp; tier: RegExp; airlines: string[]; perk: string }[] = [
  { programme: /krisflyer/i, tier: /elite gold/i, airlines: ['SQ', 'VS'], perk: 'Lounge with Elite Gold' },
];
