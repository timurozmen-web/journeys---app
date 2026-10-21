import DATA from '../data/hotelPrices.json';
import { programmeOfHotel } from '../data/brandMap';
import { UNMEASURED_EVENTS, type PriceEvent } from '../data/priceEvents';
import { sameCountry } from './countryName';

// The hotel price database (src/data/hotelPrices.json): every search kept
// as it came back, so it can answer more than one question. Each is a city,
// its check-in and check-out, what was searched and the hotels priced:
// SlickTrip, which compares the booking sites (Expedia, Booking.com and
// the rest) the way Google Hotels does, 2 adults, cheapest room, USD a
// night, searched 20-21 Oct 2026.
//
// Searching: the brand filter matches the hotel's group, not its name (seen
// in Edinburgh and Lisbon, 20-21 Oct 2026): "Marriott" brings back the
// Moxys, Residence Inns and Sheratons, Design Hotels and Autograph
// Collection hotels whose names say nothing of Marriott (The Ivens in
// Lisbon), and "Accor", "Hilton", "Hyatt" and "IHG" do the same for theirs,
// so one search a group covers a city. Earlier it matched the name, and
// "Marriott Barcelona" found a "Courtyard by Marriott" but never a
// Sheraton, a W or a Cotton House, Autograph Collection; those cities were
// searched brand by brand: Marriott, JW Marriott, Courtyard, Residence Inn,
// Sheraton (catches Four Points), Westin, W <city>, Ritz-Carlton, St.
// Regis, Le Méridien, Renaissance, Autograph Collection, Luxury Collection,
// Tribute Portfolio, EDITION, Delta Hotels, Moxy, Aloft, Element, citizenM.
// Each search only sees the twenty or so hotels nearest the place searched,
// so a city with a dozen Courtyards returns a few at a time, on different
// nights. A hotel whose name says none of these (Hotel Arts is a
// Ritz-Carlton, The Ivens an Autograph Collection) carries its brand as a
// fourth field. AC Hotels came back unpriced in every search by name; the
// group search prices them (Madrid's AC Recoletos, $316 a night). Hotels
// the search brings back from towns nearby (Sintra and Cascais for Lisbon,
// Sharjah for Dubai) are left out.

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

export interface PricePair { hotel: string; event: number; base: number; programme: string | null; tier: Tier | null }

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
    if (b) pairs.push({ hotel: r[0], event: r[1]!, base: b[1]!, programme: rowProgramme(r), tier: rowTier(r) });
  }
  return pairs;
}

/**
 * How well event ratios predict, held out one hotel at a time: each
 * paired hotel's event price is predicted as its own plain-night price
 * times the median ratio of the city's other paired hotels (at its own
 * price level where at least `minLevel` others there were paired, if
 * `byLevel`), and the median error over every hotel is returned, with the
 * error of ignoring events altogether for comparison. Events with fewer
 * than four pairs are skipped. A check on the method, run by the tests.
 */
export function heldOutEventError(events: PriceEvent[], db: PriceSearch[] = HOTEL_PRICES, byLevel = true, minLevel = 4): { error: number; ignoring: number; hotels: number } {
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const errors: number[] = [];
  const flat: number[] = [];
  for (const e of events) {
    const pairs = eventPairs(e, db);
    if (pairs.length < 4) continue;
    pairs.forEach((x, i) => {
      const others = pairs.filter((_, j) => j !== i);
      const same = others.filter((y) => y.tier === x.tier);
      const ratio = median((byLevel && same.length >= minLevel ? same : others).map((y) => y.event / y.base));
      errors.push(Math.abs(x.base * ratio - x.event) / x.event);
      flat.push(Math.abs(x.base - x.event) / x.event);
    });
  }
  return { error: median(errors), ignoring: median(flat), hotels: errors.length };
}

/** How a city's hotel prices move through the year, measured. */
export interface SeasonIndex {
  /** Each month's prices over the year's average (1-12 to a factor), for months with enough hotels priced. */
  months: Map<number, number>;
  /** Hotels priced in two months or more: the ones the index is drawn from. */
  hotels: number;
}

// A month needs this many hotels also priced in another month before it
// gets a factor: fewer and one hotel's odd price moves the whole month.
const MIN_MONTH_HOTELS = 3;
const seasonCache = new WeakMap<PriceSearch[], WeakMap<PriceEvent[], Map<string, SeasonIndex | null>>>();

/**
 * The city's month-by-month price index from the database's plain nights
 * (an event's nights left out): each hotel has its own price level and
 * each month a factor, fitted together to every hotel priced in two
 * months or more (log price = hotel + month, by alternating means). The
 * same hotels, not each month's mix, set the factors, so a month whose
 * search came back with dearer hotels doesn't read as a dear month.
 *
 * It replaces the researched price range for moving a price from one
 * month to another, which was out by more than not moving it at all:
 * held out one hotel-month at a time (Oct 2026-Sep 2027, searched 20 Oct
 * 2026), the index predicts a hotel's price in another month to a median
 * 12% in Dubai, 8% in Tokyo and 10% in New York; the researched ranges
 * 19%, 24% and 30%; no change 24%, 15% and 33%. Null for a city priced in
 * fewer than two months.
 */
type SeasonObs = { hotel: string; month: number; y: number };

/** A city's plain-night prices, one per hotel and month (the mean of its log prices). */
function seasonObservations(city: string, country: string, events: PriceEvent[], db: PriceSearch[]): SeasonObs[] {
  // Events not yet measured are skipped too: their nights aren't a season.
  const own = [...events, ...UNMEASURED_EVENTS].filter((e) => sameCountry(e.country, country) && sameCity(e.city, city));
  const logs = new Map<string, number[]>();
  for (const s of citySearches(city, country, db)) {
    if (own.some((e) => s.in < e.window[1] && s.out > e.window[0])) continue;
    const month = Number(s.in.slice(5, 7));
    for (const r of s.hotels) if (r[1] != null && r[1] > 0) {
      const k = `${r[0].toLowerCase()}|${month}`;
      logs.set(k, [...(logs.get(k) ?? []), Math.log(r[1])]);
    }
  }
  return [...logs].map(([k, xs]) => ({ hotel: k.slice(0, k.lastIndexOf('|')), month: Number(k.slice(k.lastIndexOf('|') + 1)), y: xs.reduce((a, b) => a + b, 0) / xs.length }));
}

/** Fits log price = hotel level + month factor to hotels priced in two months or more; null under two months. */
function fitSeason(all: SeasonObs[]): { level: Map<string, number>; factor: Map<number, number> } | null {
  let obs = all;
  // Only hotels seen in two months say anything about the months; a month
  // too thinly linked is dropped, which can unlink a hotel, so repeat.
  for (let changed = true; changed;) {
    const months = new Map<string, number>();
    for (const o of obs) months.set(o.hotel, (months.get(o.hotel) ?? 0) + 1);
    const linked = obs.filter((o) => months.get(o.hotel)! >= 2);
    const perMonth = new Map<number, number>();
    for (const o of linked) perMonth.set(o.month, (perMonth.get(o.month) ?? 0) + 1);
    const kept = linked.filter((o) => perMonth.get(o.month)! >= MIN_MONTH_HOTELS);
    changed = kept.length !== obs.length;
    obs = kept;
  }
  const monthSet = new Set(obs.map((o) => o.month));
  if (monthSet.size < 2) return null;
  const level = new Map<string, number>();
  const factor = new Map<number, number>([...monthSet].map((m) => [m, 0]));
  // Running sums, not arrays copied per observation: the held-out check
  // refits once per hotel-month, and copying made eight cities' check
  // overrun the test timeout.
  const hotelCount = new Map<string, number>();
  for (const o of obs) hotelCount.set(o.hotel, (hotelCount.get(o.hotel) ?? 0) + 1);
  const monthCount = new Map<number, number>();
  for (const o of obs) monthCount.set(o.month, (monthCount.get(o.month) ?? 0) + 1);
  for (let i = 0; i < 100; i++) {
    for (const h of hotelCount.keys()) level.set(h, 0);
    for (const o of obs) level.set(o.hotel, level.get(o.hotel)! + o.y - factor.get(o.month)!);
    for (const [h, n] of hotelCount) level.set(h, level.get(h)! / n);
    for (const m of monthCount.keys()) factor.set(m, 0);
    for (const o of obs) factor.set(o.month, factor.get(o.month)! + o.y - level.get(o.hotel)!);
    let centre = 0;
    for (const [m, n] of monthCount) { factor.set(m, factor.get(m)! / n); centre += factor.get(m)! / monthCount.size; }
    for (const [m, f] of factor) factor.set(m, f - centre);
  }
  return { level, factor };
}

export function seasonIndex(city: string, country: string, events: PriceEvent[], db: PriceSearch[] = HOTEL_PRICES): SeasonIndex | null {
  const key = `${city}|${country}`.toLowerCase();
  // Plan asks for the same city once per programme and price level.
  let byEvents = seasonCache.get(db);
  if (!byEvents) seasonCache.set(db, (byEvents = new WeakMap()));
  let cached = byEvents.get(events);
  if (!cached) byEvents.set(events, (cached = new Map()));
  if (cached.has(key)) return cached.get(key)!;
  const fit = fitSeason(seasonObservations(city, country, events, db));
  const index = fit && { months: new Map([...fit.factor].map(([m, f]) => [m, Math.exp(f)])), hotels: fit.level.size };
  cached.set(key, index);
  return index;
}

/**
 * The index checked against the prices it's drawn from: each hotel's
 * price in a month, held out, predicted from the index fitted without it
 * (the hotel's level times the month's factor), as the median error over
 * every hotel-month; and, for comparison, the error of taking the hotel's
 * average from its other months unchanged. Null where too little to test.
 */
export function heldOutSeasonError(city: string, country: string, events: PriceEvent[], db: PriceSearch[] = HOTEL_PRICES): { error: number; unshifted: number; held: number } | null {
  const obs = seasonObservations(city, country, events, db);
  const errors: number[] = [];
  const flat: number[] = [];
  for (const o of obs) {
    const others = obs.filter((x) => x.hotel === o.hotel && x !== o);
    if (!others.length) continue;
    const fit = fitSeason(obs.filter((x) => x !== o));
    const level = fit?.level.get(o.hotel);
    const factor = fit?.factor.get(o.month);
    if (level == null || factor == null) continue;
    const actual = Math.exp(o.y);
    errors.push(Math.abs(Math.exp(level + factor) - actual) / actual);
    flat.push(Math.abs(Math.exp(others.reduce((a, x) => a + x.y, 0) / others.length) - actual) / actual);
  }
  if (!errors.length) return null;
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  return { error: median(errors), unshifted: median(flat), held: errors.length };
}
