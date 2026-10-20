import DATA from '../data/hotelPrices.json';
import { programmeOfHotel } from '../data/brandMap';
import type { PriceEvent } from '../data/priceEvents';
import { sameCountry } from './countryName';

// The hotel price database (src/data/hotelPrices.json): every search kept
// as it came back, so it can answer more than one question. Each is a city,
// its check-in and check-out, what was searched and the hotels priced:
// SlickTrip, which compares the booking sites (Expedia, Booking.com and
// the rest) the way Google Hotels does, 2 adults, cheapest room, USD a
// night, searched 20 Oct 2026 unless the search says otherwise.
//
// Searching: the brand filter is matched against the hotel's name, and
// the search itself is "<brand> <city>", so "Marriott Barcelona" finds a
// "Courtyard by Marriott" but never a Sheraton, a W or a Cotton House,
// Autograph Collection, and found nothing at all in Barcelona. Search every
// brand by name: Marriott, Sheraton (catches Four Points), Westin, W
// <city> (the city's W, with whatever else is nearby), Ritz-Carlton, St.
// Regis, Le Méridien, Renaissance, Autograph Collection, Luxury
// Collection, Tribute Portfolio, EDITION, Moxy, Aloft, Element, citizenM.
// A hotel whose name says none of these (Hotel Arts is a Ritz-Carlton)
// carries its brand as a fourth field. AC Hotels don't come back priced
// in any search; that's a gap in the source, not a sold-out hotel.

/** A hotel's name, its price a night in USD (null: listed with no rate, usually sold out), its stars, and its brand where the name doesn't say. */
export type PriceRow = [name: string, usd: number | null, stars: number | null, brand?: string];

export interface PriceSearch {
  city: string;
  country: string;
  in: string;
  out: string;
  /** What was searched: a brand, or "4-5★" for the top-rated hotels of that class. */
  q: string;
  hotels: PriceRow[];
}

export const HOTEL_PRICES = (DATA as unknown as { searches: PriceSearch[] }).searches;

/** The programme a priced hotel belongs to: its brand where given, else its name. */
export function rowProgramme(row: PriceRow): string | null {
  return programmeOfHotel(row[3] ?? row[0]);
}

export type Segment = 'luxury' | 'premium' | 'select';

// Marriott's own tiers (The Points Guy and UpgradedPoints' brand guides,
// 2026): Luxury, Premium and Select, with its midscale and longer-stay
// brands priced alongside Select. Most specific first: a "Courtyard by
// Marriott" is a Courtyard and a "Four Points by Sheraton" a Four Points.
const MARRIOTT_SEGMENTS: [RegExp, Segment][] = [
  [/ritz-carlton|st\.? regis|\bedition\b|^w\s|\bw hotels?\b|\bjw marriott\b|luxury collection/, 'luxury'],
  [/four points|courtyard|\bac hotel|\baloft\b|\bmoxy\b|fairfield|springhill|protea|citizenm|city express|city centro|residence inn|towneplace|\belement\b|executive apartments|apartments by marriott/, 'select'],
  [/sheraton|westin|le m[eé]ridien|renaissance|autograph collection|tribute portfolio|delta hotels|gaylord|design hotels|marriott/, 'premium'],
];

/** A Marriott hotel's tier, from its brand or name; null for anything it can't place. */
export function marriottSegment(row: PriceRow): Segment | null {
  const text = (row[3] ?? row[0]).toLowerCase();
  return MARRIOTT_SEGMENTS.find(([re]) => re.test(text))?.[1] ?? null;
}

export type Tier = 'budget' | 'mid' | 'luxury';

/**
 * The app's price level for a hotel. A Marriott goes by Marriott's own
 * tier (Select is the entry level, Premium the middle, Luxury the top), as
 * Bonvoy prices nights by the hotel's cash rate; anything else by its
 * stars (5 luxury, 4 mid, 3 and under budget). Null when neither is known.
 */
export function rowTier(row: PriceRow): Tier | null {
  if (rowProgramme(row) === 'Marriott Bonvoy') {
    const s = marriottSegment(row);
    if (s) return s === 'luxury' ? 'luxury' : s === 'premium' ? 'mid' : 'budget';
  }
  const stars = row[2];
  return stars == null ? null : stars >= 5 ? 'luxury' : stars === 4 ? 'mid' : 'budget';
}

const sameCity = (a: string, b: string) => {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x.includes(y) || y.includes(x);
};

/** Searches made in a city, matched loosely ("New York City" is New York). */
export function citySearches(city: string, country: string, db: PriceSearch[] = HOTEL_PRICES): PriceSearch[] {
  return db.filter((s) => sameCountry(s.country, country) && sameCity(s.city, city));
}

export interface PricePair { hotel: string; event: number; base: number; programme: string | null }

/**
 * The hotels priced both for an event's nights and for its plain nights,
 * whichever search found them (a Sheraton found by a "4-5★" search counts
 * once). A hotel with no rate on either side isn't a pair.
 */
export function eventPairs(e: PriceEvent, db: PriceSearch[] = HOTEL_PRICES): PricePair[] {
  const searches = citySearches(e.city, e.country, db);
  const priced = (window: [string, string]) => {
    const byHotel = new Map<string, PriceRow>();
    for (const s of searches.filter((x) => x.in === window[0] && x.out === window[1])) {
      for (const r of s.hotels) if (r[1] != null && !byHotel.has(r[0].toLowerCase())) byHotel.set(r[0].toLowerCase(), r);
    }
    return byHotel;
  };
  const during = priced(e.window);
  const before = priced(e.baseline);
  const pairs: PricePair[] = [];
  for (const [k, r] of during) {
    const b = before.get(k);
    if (b) pairs.push({ hotel: r[0], event: r[1]!, base: b[1]!, programme: rowProgramme(r) });
  }
  return pairs;
}
