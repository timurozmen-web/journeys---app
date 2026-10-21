import { describe, expect, it } from 'vitest';
import { PRICE_EVENTS } from '../data/priceEvents';
import { addDays } from './tripDay';
import { eventPairs, heldOutEventError, heldOutSeasonError, HOTEL_PRICES, marriottSegment, rowProgramme, rowTier, seasonIndex, type PriceRow, type PriceSearch } from './hotelPrices';

// A brand search only returns that brand, so every hotel one priced must
// be put to Marriott: a name the classifier can't place shows up here.
const MARRIOTT_QUERIES = /^(marriott|sheraton|westin|moxy|aloft|element|courtyard|le m[eé]ridien|renaissance|autograph collection|luxury collection|tribute portfolio|edition|st\.? regis|ritz-carlton|citizenm|four points|jw marriott|w hotels|hotel arts|marriott bonvoy hotels)$/i;

describe('the price database', () => {
  it('puts every hotel a Marriott brand search priced to Marriott, with a tier', () => {
    const misplaced = HOTEL_PRICES.filter((s) => MARRIOTT_QUERIES.test(s.q))
      .flatMap((s) => s.hotels.filter((r) => rowProgramme(r) !== 'Marriott Bonvoy' || marriottSegment(r) == null).map((r) => `${s.city}: ${r[0]}`));
    expect(misplaced).toEqual([]);
  });

  it('has every search well formed', () => {
    for (const s of HOTEL_PRICES) {
      expect(s.in < s.out, `${s.city} ${s.in}`).toBe(true);
      // $10, not $20: Bangkok's 4★ 130 Hotel & Residence came back at $18 a
      // night ($55 for three), a real price, not a misread total.
      for (const r of s.hotels) expect(r[1] == null || (r[1] > 10 && r[1] < 20000), `${s.city}: ${r[0]} ${r[1]}`).toBe(true);
    }
  });

  it('has hotels priced for both nights of every event', () => {
    expect(PRICE_EVENTS.filter((e) => eventPairs(e).length === 0).map((e) => `${e.city} ${e.event}`)).toEqual([]);
  });
});

describe('tiers', () => {
  const row = (name: string, stars: number | null = null, brand?: string): PriceRow => (brand ? [name, 100, stars, brand] : [name, 100, stars]);
  it('reads Marriott’s own tiers, the specific brand before the parent name', () => {
    expect(marriottSegment(row('W Barcelona'))).toBe('luxury');
    expect(marriottSegment(row('JW Marriott Hotel Bangkok'))).toBe('luxury');
    expect(marriottSegment(row('Hotel Arts Barcelona', 5, 'The Ritz-Carlton'))).toBe('luxury');
    expect(marriottSegment(row('Cotton House Hotel, Autograph Collection'))).toBe('premium');
    expect(marriottSegment(row('Edinburgh Marriott Hotel Holyrood'))).toBe('premium');
    expect(marriottSegment(row('Courtyard by Marriott Edinburgh West'))).toBe('select');
    expect(marriottSegment(row('Four Points by Sheraton Barcelona Diagonal'))).toBe('select');
    expect(marriottSegment(row('Residence Inn by Marriott Edinburgh'))).toBe('select');
  });
  it('gives the app’s price level: Marriott by tier, anything else by stars', () => {
    expect(rowTier(row('Moxy Barcelona', 4))).toBe('budget');
    expect(rowTier(row('Le Méridien Barcelona', 5))).toBe('mid');
    expect(rowTier(row('The Barcelona EDITION', 5))).toBe('luxury');
    expect(rowTier(row('Hotel Duquesa de Cardona Barcelona', 4))).toBe('mid');
    expect(rowTier(row('SLS Barcelona', 5))).toBe('luxury');
    expect(rowTier(row('Hotel del Mar', 3))).toBe('budget');
    expect(rowTier(row('Outsite Barcelona'))).toBeNull();
  });
});

describe('eventPairs', () => {
  it('pairs each hotel priced on both sides, whichever search found it', () => {
    const mwc = PRICE_EVENTS.find((e) => e.event === 'Mobile World Congress')!;
    const marriott = eventPairs(mwc).filter((q) => q.programme === 'Marriott Bonvoy').map((q) => [q.hotel, q.event, q.base]);
    expect(marriott).toEqual(expect.arrayContaining([
      ['Cotton House Hotel, Autograph Collection', 2488, 427], ['Moxy Barcelona', 999, 245], ['The Barcelona EDITION', 2151, 428], ['W Barcelona', 1448, 400],
    ]));
    // No rate for the congress nights: sold out, so not a pair.
    expect(eventPairs(mwc).some((q) => q.hotel === 'Renaissance Barcelona Hotel')).toBe(false);
  });
});

describe('event ratios held out one hotel at a time', () => {
  // Each hotel's event price predicted from its own plain-night price and
  // the other hotels' ratio. 20 Oct 2026: 12.4% by level, 13.0% city-wide,
  // 48% ignoring events (240 hotels). If new searches push the error up a
  // lot, the method needs another look, not a looser bound.
  it('predicts a hotel’s event price far better than ignoring the event', () => {
    const level = heldOutEventError(PRICE_EVENTS);
    const city = heldOutEventError(PRICE_EVENTS, undefined, false);
    expect(level.hotels).toBeGreaterThanOrEqual(200);
    expect(level.error).toBeLessThan(0.2);
    expect(level.error).toBeLessThan(level.ignoring / 2);
    expect(level.error).toBeLessThanOrEqual(city.error + 0.01);
  });
});

describe('the month-by-month index', () => {
  const search = (when: string, hotels: PriceRow[]): PriceSearch => ({ city: 'Lisbon', country: 'Portugal', in: when, out: addDays(when, 3), q: '4-5★', hotels });
  it('reads the months from the same hotels, not each month’s mix', () => {
    // July came back with a dearer hotel (D) as well; A, B and C are each
    // 1.25x their January price, so July is 1.25x January, not 1.5x.
    const db = [
      search('2027-01-13', [['A', 100, 4], ['B', 200, 4], ['C', 300, 5]]),
      search('2027-07-14', [['A', 125, 4], ['B', 250, 4], ['C', 375, 5], ['D', 900, 5]]),
    ];
    const index = seasonIndex('Lisbon', 'Portugal', [], db)!;
    expect(index.months.get(7)! / index.months.get(1)!).toBeCloseTo(1.25, 5);
    expect(index.hotels).toBe(3);
  });
  it('leaves out a month too few hotels link, and an event’s nights', () => {
    const db = [
      search('2027-01-13', [['A', 100, 4], ['B', 200, 4], ['C', 300, 5]]),
      search('2027-07-14', [['A', 125, 4], ['B', 250, 4], ['C', 375, 5]]),
      search('2027-03-10', [['A', 500, 4], ['B', 900, 4]]),
    ];
    expect([...seasonIndex('Lisbon', 'Portugal', [], db)!.months.keys()].sort()).toEqual([1, 7]);
    const fair = { city: 'Lisbon', country: 'Portugal', event: 'Fair', window: ['2027-07-14', '2027-07-17'] as [string, string], baseline: ['2027-07-28', '2027-07-31'] as [string, string] };
    expect(seasonIndex('Lisbon', 'Portugal', [fair], db)).toBeNull();
  });
  it('predicts a hotel’s price in another month far better than leaving it as it was', () => {
    // 20-21 Oct 2026, held out one hotel-month at a time: Dubai 12%, Tokyo
    // 9%, New York 10%, London 8%, Paris 7%, Las Vegas 11%, Edinburgh 10%,
    // Sydney 8%, Hong Kong 6%, Barcelona 9%, Rome 8%, Amsterdam 7%, against
    // 24%, 15%, 26%, 14%, 10%, 15%, 34%, 13%, 10%, 19%, 19% and 19%
    // unchanged. Paris moves least through the year, so gains least;
    // Edinburgh most (January under half the year's average, June over one
    // and a half).
    for (const [city, country] of [['Dubai', 'UAE'], ['Tokyo', 'Japan'], ['New York', 'United States'], ['London', 'United Kingdom'], ['Paris', 'France'], ['Las Vegas', 'United States'], ['Edinburgh', 'United Kingdom'], ['Sydney', 'Australia'], ['Hong Kong', 'Hong Kong'], ['Barcelona', 'Spain'], ['Rome', 'Italy'], ['Amsterdam', 'Netherlands']]) {
      const r = heldOutSeasonError(city, country, PRICE_EVENTS)!;
      expect(r.held).toBeGreaterThanOrEqual(70);
      expect(r.error).toBeLessThan(0.15);
      expect(r.error).toBeLessThan(r.unshifted * 0.75);
    }
    // Abu Dhabi's and Rio's hotels hold their price better, so the index
    // gains less: 12.5% against 16%, and 9% against 10%.
    for (const [city, country] of [['Abu Dhabi', 'UAE'], ['Rio de Janeiro', 'Brazil']]) {
      const r = heldOutSeasonError(city, country, PRICE_EVENTS)!;
      expect(r.error).toBeLessThan(0.15);
      expect(r.error).toBeLessThan(r.unshifted * 0.95);
    }
    // One refit per held-out hotel-month across fourteen cities: about 5s
    // alone, more with the other files running beside it.
  }, 30_000);
  it('stays close where prices hardly move through the year', () => {
    // Mexico City's 4-5★ hotels mostly hold one price all year (the JW
    // Marriott Santa Fe $183 every time from March to September), so no
    // change is out by 5% and the index, pulled by the few that move, by 6%.
    // Singapore's and Bangkok's barely move either: 5.5% and 5.0%
    // unchanged, 5.2% and 4.3% with the index.
    for (const [city, country] of [['Mexico City', 'Mexico'], ['Singapore', 'Singapore'], ['Bangkok', 'Thailand']]) {
      const r = heldOutSeasonError(city, country, PRICE_EVENTS)!;
      expect(r.held).toBeGreaterThanOrEqual(100);
      expect(r.error).toBeLessThan(0.08);
    }
  });
});

