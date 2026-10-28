import type { Flight, Hotel, LoyaltyProgramme, Promotion, Voucher } from '../types';
import { APD_BAND_A, APD_BAND_DEPENDS, APD_BAND_LISTED, APD_EDGE_MILES, APD_RATES, CAPITALS, type ApdBand } from '../data/airPassengerDuty';
import { AWARD_AIRLINES, AWARD_ROUTES, CURRENCY_PROGRAMME, STATUS_PERKS, type AwardCurrency } from '../data/awardFlights';
import { AWARD_CLASSES, type AwardCabin } from '../data/awardClasses';
import { FREE_NIGHT_TOP_UP } from '../data/freeNights';
import { BA_DISPUTED_2026, BA_KNOWN, BA_PEAK_2026, VS_PEAK, type SeasonCalendar } from '../data/awardSeasons';
import { HOTEL_PRICING, HYATT_LEVELS } from '../data/hotelAwardPricing';
import { MEMBER_RATE_DISCOUNT, PRICE_EVENTS } from '../data/priceEvents';
import { citySearches, eventPairs, rowProgramme, rowTier, seasonIndex, type PriceSearch, type Tier } from './hotelPrices';
import { holidaysDuring, longWeekend, schoolBreakDuring, shortDate, type Holiday, type SchoolBreak, type SchoolHoliday } from './holidays';
import { promoBonusForStay } from './promoBonus';
import { addDays } from './tripDay';
import { blendedGuideForMonth, dominantMonth, findCrowdPriceMonth, MONTH_NAMES, type BlendedMonthGuide } from './destinationGuide';
import type { HotelPlanOption } from './hotelPlanner';
import { nightsForTier, type StatusProgress } from './statusProgress';
import { formatDate } from './format';
import { roundPointsEstimate, shortProgramme } from './planFormat';
import { countryKey, sameCity, sameCountry } from './countryName';
import type { CityCashRate, PointsValueProgramme, RealClimateMonth, RealCrowdPriceMonth } from './queries';

// Everything the planner knows about a trip, in one place: the weather
// and crowds at each stop, what the flight costs in points and tax, and
// what the user's own account makes of it (balances, status, vouchers,
// promotions). The Plan screen shows it and the city-suggestion agent is
// given it, so both work from the same sourced facts. Sources live with
// the data: src/data/airPassengerDuty.ts, src/data/awardFlights.ts,
// src/data/awardClasses.ts, and the climate, crowd, cash-rate and
// points-value tables in Supabase.

// ---------- UK Air Passenger Duty ----------

const LONDON: [number, number] = [51.507, -0.128];

function miles(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * The APD band for a flight from the UK to `country`, or null when it
 * can't be said for sure (not in Band A's list, capital not known, or
 * too near 5,500 miles to trust a worked-out distance).
 */
const BAND_A = new Set([...APD_BAND_A].map(countryKey));
const DEPENDS = new Set([...APD_BAND_DEPENDS].map(countryKey));
const LISTED = new Map(Object.entries(APD_BAND_LISTED).map(([c, b]) => [countryKey(c), b]));
const CAPITAL = new Map(Object.entries(CAPITALS).map(([c, ll]) => [countryKey(c), ll]));

export function apdBand(country: string): ApdBand | null {
  const key = countryKey(country);
  if (key === 'united kingdom') return 'domestic';
  if (BAND_A.has(key)) return 'A';
  if (DEPENDS.has(key)) return null;
  const listed = LISTED.get(key);
  if (listed) return listed;
  const capital = CAPITAL.get(key);
  if (!capital) return null;
  const d = miles(LONDON, capital);
  if (Math.abs(d - 5500) < APD_EDGE_MILES) return null;
  // Not in A's list, so at least B: Cairo is 2,190 miles away, but Egypt
  // was never A; nor is anywhere else off the list, however close.
  return d <= 5500 ? 'B' : 'C';
}

/** APD per passenger on a flight leaving the UK on `date`, by cabin. */
export function airPassengerDuty(country: string, cabin: AwardCabin, date: string): { band: ApdBand; amount: number } | null {
  const band = apdBand(country);
  if (!band) return null;
  const rates = [...APD_RATES].reverse().find((r) => r.from <= date) ?? APD_RATES[0];
  return { band, amount: (cabin === 'Economy' ? rates.reduced : rates.standard)[band] };
}

// ---------- flights on points ----------

export interface AwardOption {
  airline: string; // IATA code
  airlineName: string;
  place: string;
  currency: AwardCurrency;
  cabin: AwardCabin;
  /** The price on the day where its season is known, else off-peak (or the Saver cap). */
  points: number;
  offPeakPoints: number;
  peakPoints: number | null;
  /** Peak or off-peak on the day, from the airline's calendar; null when unknown. */
  season: 'peak' | 'off-peak' | null;
  /** A peak day with no sourced peak price: at least the off-peak figure. */
  atLeast: boolean;
  /** Taxes and charges on the reward ticket, where sourced (APD included). */
  cash: number | null;
  cashEstimated: boolean;
  /** UK APD: the least the cash can be when it isn't known, for airlines that pass taxes on (not BA). */
  apd: number | null;
  programme: string | null;
  balance: number;
  covers: boolean;
  /** Seats the balance pays for at the off-peak price, doubled by a companion voucher on BA. */
  seats: number;
  companion: boolean;
  /** Points at the user's own valuation plus the cash, in GBP: what it really costs them. */
  costGBP: number;
  awardClass: string | null;
  perk: string | null;
  source: string;
}

export interface PlanAccount {
  programmes: LoyaltyProgramme[];
  vouchers: Voucher[];
  flights: Flight[];
  hotels: Hotel[];
  promotions: Promotion[];
}

function holdingOf(programmes: LoyaltyProgramme[], currency: AwardCurrency): LoyaltyProgramme | null {
  // The one actually holding the points (KrisFlyer can appear twice: a
  // status record with none, and the miles balance).
  return programmes
    .filter((p) => p.category === 'airline' && CURRENCY_PROGRAMME[currency].test(p.name))
    .sort((a, b) => b.points - a.points)[0] ?? null;
}

const COMPANION = /companion|2-4-1|2 for 1/i;

const within = (d: string, [a, b]: [string, string]) => d >= a && d <= b;

/** Peak or off-peak on a date, by the airline's calendar, or null where it isn't known. */
export function seasonOn(calendar: SeasonCalendar | null, date: string): 'peak' | 'off-peak' | null {
  if (calendar === 'BA') {
    if (!within(date, BA_KNOWN) || BA_DISPUTED_2026.has(date)) return null;
    return BA_PEAK_2026.some((w) => within(date, w)) ? 'peak' : 'off-peak';
  }
  if (calendar === 'VS' || calendar === 'VS-Caribbean') {
    const c = VS_PEAK[calendar];
    if (!within(date, c.known)) return null;
    return c.peak.some((w) => within(date, w)) ? 'peak' : 'off-peak';
  }
  return null;
}

/**
 * Every sourced reward seat from London to `airport` in the given cabins,
 * priced against the user's balances: ones they can pay for first, then
 * by what each really costs them at their own point values.
 */
export function awardOptions(
  airports: string | null | (string | null)[], country: string, date: string, cabins: AwardCabin[], account: Pick<PlanAccount, 'programmes' | 'vouchers'>,
): AwardOption[] {
  // The verified nearest airport and the agent's own pick: either can be
  // the one a route is listed under (Paris resolved to Le Bourget once).
  const codes = (Array.isArray(airports) ? airports : [airports]).filter((a): a is string => !!a).map((a) => a.trim().toUpperCase());
  if (codes.length === 0) return [];
  const companion = account.vouchers.some((v) => !v.redeemed && (!v.expiryDate || v.expiryDate >= date) && COMPANION.test(`${v.name} ${v.source}`) && /british airways|\bba\b/i.test(`${v.name} ${v.source}`));
  const out: AwardOption[] = [];
  for (const route of AWARD_ROUTES) {
    if (!codes.some((c) => route.airports.includes(c))) continue;
    for (const cabin of cabins) {
      const price = route.cabins[cabin];
      if (!price) continue;
      const holder = holdingOf(account.programmes, route.currency);
      const balance = holder?.points ?? 0;
      // Priced on the day where the calendar says which season it is.
      const season = seasonOn(route.calendar, date);
      const atLeast = season === 'peak' && price.peak == null;
      const points = season === 'peak' ? price.peak ?? price.offPeak : price.offPeak;
      const ukApd = airPassengerDuty(country, cabin, date)?.amount ?? null;
      const apd = route.taxesPassedOn ? ukApd : null;
      // Unknown cash is ranked as APD, BA's too: a guess for ordering only,
      // never shown for BA (see awardFlights.ts).
      const cash = price.cash ?? ukApd ?? 0;
      const withCompanion = companion && route.airline === 'BA';
      const seats = Math.floor(balance / points) * (withCompanion ? 2 : 1);
      const perk = STATUS_PERKS.find((s) => s.airlines.includes(route.airline) && account.programmes.some((p) => s.programme.test(p.name) && s.tier.test(p.tier ?? '')))?.perk ?? null;
      const letter = Object.entries(AWARD_CLASSES[route.airline] ?? {}).find(([, c]) => c === cabin)?.[0] ?? null;
      out.push({
        airline: route.airline, airlineName: AWARD_AIRLINES[route.airline], place: route.place, currency: route.currency, cabin,
        points, offPeakPoints: price.offPeak, peakPoints: price.peak, season, atLeast, cash: price.cash, cashEstimated: !!price.cashEstimated, apd,
        programme: holder?.name ?? null, balance, covers: balance >= points, seats, companion: withCompanion,
        costGBP: Math.round((points * (holder?.ptValue ?? 1)) / 100 + cash),
        awardClass: letter, perk, source: route.source,
      });
    }
  }
  return out.sort((a, b) => Number(b.covers) - Number(a.covers) || a.costGBP - b.costGBP || a.points - b.points);
}

/**
 * The cabin the user books with points, from their own reward flights:
 * the one they've used most. Economy when there are none.
 */
export function usualAwardCabin(flights: Flight[]): AwardCabin {
  const counts = new Map<AwardCabin, number>();
  for (const f of flights) if (f.award) counts.set(f.cabin as AwardCabin, (counts.get(f.cabin as AwardCabin) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Economy';
}

// ---------- where to stay ----------

/**
 * A city's researched cash rate for one tier, all taken from the same
 * city: tiers were once mixed across cities, so a card headed "Amalfi"
 * showed Rome's mid-range and Venice's luxury price. The city with the
 * most tiers wins, then alphabetical, for a stable choice.
 */
export function cityCashRates(rates: CityCashRate[], country: string, city: string | null): CityCashRate[] {
  const cq = city?.trim().toLowerCase();
  const candidates = rates.filter((r) => sameCountry(r.country, country) && (!cq || r.city.toLowerCase().includes(cq) || cq.includes(r.city.toLowerCase())));
  if (candidates.length === 0) return [];
  const byCity = new Map<string, CityCashRate[]>();
  for (const r of candidates) byCity.set(r.city, [...(byCity.get(r.city) ?? []), r]);
  return [...byCity.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0][1];
}

/** Points a night costs at a programme's average redemption value: an estimate. */
export function pointsPerNight(cashUsd: number, value: PointsValueProgramme): number {
  return roundPointsEstimate((cashUsd * 100) / value.avgCentsPerPoint);
}

/** What the planner prices hotels from: city cash rates, the season, each programme's value per point, and FX. */
export interface Market {
  rates: CityCashRate[];
  /** The hotel price database (src/data/hotelPrices.json), where measured prices should replace the researched rates. */
  prices?: PriceSearch[];
  crowd: RealCrowdPriceMonth[];
  pointsValue: PointsValueProgramme[];
  usdToGbp: number;
  usdToEur: number;
}

type PriceLevel = 'low' | 'medium' | 'high';

/** How dear the month of a stay is, from the crowd and price table. */
export function stopPriceLevel(crowd: RealCrowdPriceMonth[], stop: PlannedStop): PriceLevel | null {
  if (!stop.checkIn) return null;
  const month = dominantMonth(stop.checkIn, addDays(stop.checkIn, stop.nights));
  return findCrowdPriceMonth(crowd, stop.city, stop.country, MONTH_NAMES[month].slice(0, 3))?.priceLevel ?? null;
}

/** The city's measured month factor (seasonIndex) for most of a stay's nights, where it has one. */
function stayMonthFactor(stop: PlannedStop, prices: PriceSearch[] | undefined): number | null {
  if (!stop.checkIn || !prices?.length) return null;
  const month = dominantMonth(stop.checkIn, addDays(stop.checkIn, stop.nights)) + 1;
  return seasonIndex(stop.city, stop.country, PRICE_EVENTS, prices)?.months.get(month) ?? null;
}

/**
 * How dear a stay's month is: measured where the city has a month index
 * (more than a tenth under its year's average is low, over is high), else
 * the crowd and price table. The table's levels are researched, not
 * measured: it has Tokyo's January medium where its hotels were 23% under
 * the year's average.
 */
export function marketPriceLevel(market: Market, stop: PlannedStop): PriceLevel | null {
  const f = stayMonthFactor(stop, market.prices);
  if (f != null) return f < 0.9 ? 'low' : f > 1.1 ? 'high' : 'medium';
  return stopPriceLevel(market.crowd, stop);
}

/**
 * A researched rate in a stay's season: its middle times the city's
 * measured month factor where it has one (the researched ranges are far
 * narrower than the year's real swing: New York's mid-range $338-423,
 * where its hotels cost 2.6x as much in early December as in January),
 * else placed in the range by the month's level (seasonalCashUsd).
 */
export function stayCashUsd(rate: CityCashRate, stop: PlannedStop, market: Market): number {
  const f = stayMonthFactor(stop, market.prices);
  if (f != null) return ((rate.priceLowUsd + rate.priceHighUsd) / 2) * f;
  return seasonalCashUsd(rate, stopPriceLevel(market.crowd, stop));
}

/**
 * A night's cash at one of a city's price levels, placed by season: the
 * researched range runs from its low season to its high (Tokyo's mid-range
 * note: "rises to ~$213 in high season", the top of its range), so a low
 * month takes the bottom, a high one the top, anything else the middle.
 * It used the middle in every month, so a Golden Week night cost the
 * same as one in January.
 */
export function seasonalCashUsd(rate: CityCashRate, level: PriceLevel | null): number {
  if (level === 'low') return rate.priceLowUsd;
  if (level === 'high') return rate.priceHighUsd;
  return (rate.priceLowUsd + rate.priceHighUsd) / 2;
}

export interface EventPrices {
  event: string;
  /** Whose hotels the ratio is from: the stay's programme where enough were sampled, else null for every hotel sampled. */
  programme: string | null;
  /** The price level the ratio is from, where enough hotels at the stay's level were paired; null for every level. */
  tier: Tier | null;
  /** The middle hotel's event price over its plain-week price. */
  ratio: number;
  hotels: number;
  baseline: [string, string];
}

// A programme's own hotels are used when at least this many were sampled;
// one hotel is that hotel's pricing, not the brand's in that city.
const MIN_OWN_HOTELS = 2;
// Pairs needed at one price level before that level's own event ratio is used.
const MIN_LEVEL_PAIRS = 4;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};

/**
 * What a measured event (src/data/priceEvents.ts) does to prices on a
 * stay's nights: the hotels priced in the price database for both its
 * nights and its plain nights, whichever search found them, each put to
 * its programme by name. Given a price level, the hotels at that level
 * are used where at least four were paired (the programme's own first),
 * as an event doesn't move every level alike: over New Year Dubai's
 * Marriott Select hotels went up x1.95 and its Luxury ones x2.81, while
 * New York's went the other way (x2.37 and x1.74). Held out one hotel at
 * a time, that predicted each hotel's event price to a median 12.4%,
 * against 13.0% from the city-wide ratio (240 hotels, 20 Oct 2026).
 * Otherwise the stay's programme's own hotels where at least two were
 * priced, else every hotel. It used to take one sample by the word in
 * its search ("Marriott"), so the Sheratons, Westins and Moxys a
 * Marriott member can book were never counted. Null where nothing was
 * measured: a holiday alone isn't taken to raise prices, as the
 * measurements show it often lowers them.
 */
export function eventPrices(stop: PlannedStop, programme: string | null = null, db?: PriceSearch[], tier: Tier | null = null): EventPrices | null {
  if (!stop.checkIn) return null;
  const checkOut = addDays(stop.checkIn, stop.nights);
  for (const e of PRICE_EVENTS) {
    if (!sameCountry(e.country, stop.country) || !sameCity(e.city, stop.city) || !(stop.checkIn < e.window[1] && checkOut > e.window[0])) continue;
    const all = eventPairs(e, db);
    if (all.length === 0) continue;
    const own = programme ? all.filter((q) => q.programme === programme) : [];
    const level = tier ? all.filter((q) => q.tier === tier) : [];
    const ownLevel = level.filter((q) => programme != null && q.programme === programme);
    const use = ownLevel.length >= MIN_LEVEL_PAIRS ? ownLevel
      : level.length >= MIN_LEVEL_PAIRS ? level
      : own.length >= MIN_OWN_HOTELS ? own
      : all;
    const ratio = Math.round(median(use.map((q) => q.event / q.base)) * 100) / 100;
    return {
      event: e.event,
      programme: use === own || use === ownLevel ? programme : null,
      tier: use === level || use === ownLevel ? tier : null,
      ratio, hotels: use.length, baseline: e.baseline,
    };
  }
  return null;
}

/** A night's cash measured at a programme's hotels of one price level in a city. */
export interface MeasuredCash {
  usd: number;
  /** The middle half of the hotels' prices. */
  low: number;
  high: number;
  hotels: number;
  /** "dates": hotels priced for these very nights; "season": priced on other nights, moved to this stay's season (and any event on it). */
  basis: 'dates' | 'season';
}

/**
 * What a night at a programme's hotels of one price level (Marriott by
 * its own tiers, anything else by stars: src/lib/hotelPrices.ts) costs in
 * a city, from the price database, where at least two such hotels were
 * priced. Hotels priced for nights overlapping the stay are taken as they
 * are. Otherwise plain-night prices (not an event's) are moved to the
 * stay's month by the city's measured month factors (seasonIndex), else
 * by its researched price range (a night measured in a low month and
 * wanted in a high one takes the range's top over its bottom), which
 * backtests far worse. Then any measured event on the stay's nights. Each hotel counts
 * once, at the average of its prices. Null where too few were priced:
 * the researched city rates stand in.
 */
export function measuredCash(stop: PlannedStop, programme: string | null, tier: CityCashRate['tier'], market: Market): MeasuredCash | null {
  if (!stop.checkIn || !market.prices?.length) return null;
  const checkOut = addDays(stop.checkIn, stop.nights);
  const searches = citySearches(stop.city, stop.country, market.prices);
  const events = PRICE_EVENTS.filter((e) => sameCountry(e.country, stop.country) && sameCity(e.city, stop.city));
  const rows = searches.flatMap((s) => s.hotels.filter((r) => r[1] != null && rowTier(r) === tier && (!programme || rowProgramme(r) === programme)).map((r) => ({ s, r })));
  const summarise = (byHotel: Map<string, number[]>, basis: MeasuredCash['basis']): MeasuredCash | null => {
    const each = [...byHotel.values()].map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
    if (each.length < MIN_OWN_HOTELS) return null;
    return { usd: Math.round(median(each)), low: Math.round(quantile(each, 0.25)), high: Math.round(quantile(each, 0.75)), hotels: each.length, basis };
  };
  const collect = (list: typeof rows, price: (x: (typeof rows)[number]) => number) => {
    const byHotel = new Map<string, number[]>();
    for (const x of list) byHotel.set(x.r[0].toLowerCase(), [...(byHotel.get(x.r[0].toLowerCase()) ?? []), price(x)]);
    return byHotel;
  };
  const direct = summarise(collect(rows.filter(({ s }) => s.in < checkOut && s.out > stop.checkIn!), ({ r }) => r[1]!), 'dates');
  if (direct) return direct;
  const plain = rows.filter(({ s }) => !events.some((e) => s.in < e.window[1] && s.out > e.window[0]));
  const rate = cityCashRates(market.rates, stop.country, stop.city).find((r) => r.tier === tier) ?? null;
  const want = stopPriceLevel(market.crowd, stop);
  const index = seasonIndex(stop.city, stop.country, PRICE_EVENTS, market.prices);
  const toSeason = (s: PriceSearch) => {
    // The city's measured month factors where both months have one.
    const measuredWant = stayMonthFactor(stop, market.prices);
    const measuredHad = index?.months.get(Number(s.in.slice(5, 7)));
    if (measuredWant && measuredHad) return measuredWant / measuredHad;
    const had = stopPriceLevel(market.crowd, { city: stop.city, country: stop.country, checkIn: s.in, nights: Math.max(1, (Date.parse(s.out) - Date.parse(s.in)) / 86400000) });
    if (!rate || !want || !had || want === had) return 1;
    return seasonalCashUsd(rate, want) / seasonalCashUsd(rate, had);
  };
  const season = summarise(collect(plain, ({ s, r }) => r[1]! * toSeason(s)), 'season');
  if (!season) return null;
  const surge = eventPrices(stop, programme, market.prices, tier)?.ratio ?? 1;
  return surge === 1 ? season : { ...season, usd: Math.round(season.usd * surge), low: Math.round(season.low * surge), high: Math.round(season.high * surge) };
}

/** Cash for a night at the member rate, where the programme has one cheaper than the booking sites. */
export function memberCash(programme: string, cash: number): number {
  return cash * (1 - (MEMBER_RATE_DISCOUNT[programme] ?? 0));
}

export interface NightPoints {
  /** The likely price. */
  points: number;
  /** Hyatt's range for the category, Lowest to Top. */
  low: number | null;
  high: number | null;
  model: 'fixed-value' | 'chart' | 'dynamic';
  /** Hyatt: the category whose prices fit the cash rate (an estimate), and the level taken for the season. */
  category: number | null;
  level: string | null;
  capped: boolean;
}

/**
 * What a night costs in points, the way the programme prices it
 * (src/data/hotelAwardPricing.ts), where one figure per point used to
 * stand in for all of them:
 *  - Accor: money off, 2,000 points per €40, in whole blocks.
 *  - Hyatt: the chart. The category is the one whose Moderate price is
 *    nearest the cash rate at Hyatt's average value per point; the level
 *    follows the season (Low in a quiet month, Moderate, Upper in a
 *    busy one), as Hyatt doesn't publish its calendar.
 *  - Marriott, IHG, Hilton: dynamic, tracking cash, so the cash rate at
 *    the programme's average value per point; Hilton capped at 250,000.
 */
export function nightPoints(programme: string, cashUsd: number, level: PriceLevel | null, market: Pick<Market, 'pointsValue' | 'usdToEur'>): NightPoints | null {
  const pricing = HOTEL_PRICING[programme];
  if (pricing?.kind === 'fixed-value') {
    const blocks = Math.ceil((cashUsd * market.usdToEur) / pricing.eurPerBlock);
    return { points: blocks * pricing.pointsPerBlock, low: null, high: null, model: 'fixed-value', category: null, level: null, capped: false };
  }
  const value = market.pointsValue.find((v) => v.programme === programme);
  if (!value) return null;
  const est = pointsPerNight(cashUsd, value);
  if (pricing?.kind === 'chart') {
    const [category, row] = Object.entries(pricing.categories)
      .map(([c, r]) => [Number(c), r] as const)
      .sort((a, b) => Math.abs(a[1][2] - est) - Math.abs(b[1][2] - est) || a[0] - b[0])[0];
    const i = level === 'low' ? 1 : level === 'high' ? 3 : 2;
    return { points: row[i], low: row[0], high: row[4], model: 'chart', category, level: HYATT_LEVELS[i], capped: false };
  }
  const cap = pricing?.kind === 'dynamic' ? pricing.cap : null;
  const capped = cap != null && est > cap;
  return { points: capped ? cap : est, low: null, high: null, model: 'dynamic', category: null, level: null, capped };
}

/**
 * Nights a balance pays for, counting a free fifth night on each run of
 * five where the programme gives one (Marriott to every member; Hilton to
 * Silver and above, per Prince of Travel and InsideFlyer, 2026).
 */
export function nightsFromBalance(balance: number, perNight: number, fifthFree: boolean): number {
  if (perNight <= 0) return 0;
  let nights = 0;
  while ((nights + 1 - (fifthFree ? Math.floor((nights + 1) / 5) : 0)) * perNight <= balance) nights++;
  return nights;
}

// The word a voucher uses for its programme ("50,000pt Marriott voucher").
const PROGRAMME_WORD: Record<string, RegExp> = {
  'Marriott Bonvoy': /marriott|bonvoy/i, 'Hilton Honors': /hilton/i, 'IHG One Rewards': /\bihg\b/i, 'World of Hyatt': /hyatt/i, 'Accor ALL': /accor|\ball\b/i,
};

/** A free-night voucher's points cap, read from its name ("50,000pt free night"). */
export function voucherCap(name: string): number | null {
  const m = name.replace(/,/g, '').match(/(\d+)\s*(k|pt|pts|points)\b/i);
  if (!m) return null;
  return Number(m[1]) * (m[2].toLowerCase() === 'k' ? 1000 : 1);
}

export type VoucherVerdict = 'use' | 'top-up' | 'use-soon' | 'keep' | 'too-dear';

export interface VoucherAdvice {
  id: string;
  name: string;
  programme: string;
  cap: number;
  expiry: string | null;
  verdict: VoucherVerdict;
  /** The night it does most for: where, which price level, its points (with any top-up) and what using it saves. */
  best: { city: string; tier: CityCashRate['tier']; points: number; topUp: number; cashGBP: number; worthGBP: number } | null;
  /** What the voucher is worth to the user: their own value for it, else its cap at their point value. */
  parGBP: number;
  /** What a night must save to be worth using it on this trip: less as expiry nears. */
  neededGBP: number;
  monthsLeft: number | null;
}

const TIER_WORD: Record<CityCashRate['tier'], string> = { budget: 'budget', mid: 'mid-range', luxury: 'luxury' };
const TIERS: CityCashRate['tier'][] = ['budget', 'mid', 'luxury'];
const MONTH_MS = 30.44 * 86400000;
const URGENT_MONTHS = 6;

/**
 * Whether to spend a free-night voucher on this trip, and where. A 40k
 * voucher on a 20k night throws 20k away, so it weighs:
 *  - what nights cost here, at each of the city's price levels (the
 *    researched cash rates), and so roughly what they cost in points;
 *  - stretching it with the programme's top-up (Marriott: 25,000), paid
 *    for at the user's own point value;
 *  - what the voucher is worth to the user (their own value for it, or
 *    its cap at their point value);
 *  - how close it is to expiring: a night has to save its full worth
 *    until the last six months, then less in step with the months left,
 *    as a voucher unused is worth nothing.
 * Points prices are estimates (cash rate at the programme's average
 * value per point), so a night near the cap is a "probably".
 */
export function voucherAdvice(v: Voucher, programme: LoyaltyProgramme, stops: PlannedStop[], market: Market): VoucherAdvice | null {
  const cap = voucherCap(v.name);
  if (!cap || !market.pointsValue.some((x) => x.programme === programme.name)) return null;
  const topUpMax = FREE_NIGHT_TOP_UP[programme.name] ?? 0;
  const ptValue = programme.ptValue;
  const usable = stops.filter((s) => s.checkIn && (!v.expiryDate || s.checkIn <= v.expiryDate));
  let best: VoucherAdvice['best'] = null;
  for (const s of usable) {
    const level = marketPriceLevel(market, s);
    const rates = cityCashRates(market.rates, s.country, s.city);
    for (const tier of TIERS) {
      const surge = eventPrices(s, programme.name, market.prices, tier)?.ratio ?? 1;
      // The programme's own hotels where they were priced, else the city's researched rate.
      const m = measuredCash(s, programme.name, tier, market);
      const r = rates.find((x) => x.tier === tier);
      if (!m && !r) continue;
      const cashUsd = m ? m.usd : stayCashUsd(r!, s, market) * surge;
      const points = nightPoints(programme.name, cashUsd, level, market)?.points;
      if (points == null || points > cap + topUpMax) continue;
      const topUp = Math.max(0, points - cap);
      // What the night would cost paid in cash, at the member rate.
      const cashGBP = Math.round(memberCash(programme.name, cashUsd) * market.usdToGbp);
      const worthGBP = Math.round(cashGBP - (topUp * ptValue) / 100);
      if (!best || worthGBP > best.worthGBP) best = { city: s.city, tier, points, topUp, cashGBP, worthGBP };
    }
  }
  const parGBP = Math.round(v.value ?? (cap * ptValue) / 100);
  const from = usable[0]?.checkIn ?? stops[0]?.checkIn ?? null;
  const monthsLeft = v.expiryDate && from ? Math.max(0, (Date.parse(v.expiryDate) - Date.parse(from)) / MONTH_MS) : null;
  // Full worth until the last six months, then less as they run out: a
  // 50k voucher was spent on a 27,500-point night seven months before it
  // expired, when it was asking only 7/12 of its worth.
  const neededGBP = Math.round(monthsLeft == null ? parGBP : parGBP * Math.min(1, monthsLeft / URGENT_MONTHS));
  const verdict: VoucherVerdict = !best ? 'too-dear'
    : best.worthGBP >= parGBP ? (best.topUp > 0 ? 'top-up' : 'use')
    : best.worthGBP >= neededGBP ? 'use-soon'
    : 'keep';
  return { id: v.id, name: v.name, programme: programme.name, cap, expiry: v.expiryDate, verdict, best, parGBP, neededGBP, monthsLeft };
}

// Which voucher to talk about first: one to use now (the most it saves
// over its worth), then one to use before it goes, then one to keep.
const VERDICT_RANK: Record<VoucherVerdict, number> = { 'top-up': 0, use: 0, 'use-soon': 1, keep: 2, 'too-dear': 3 };
function firstVoucher(advice: VoucherAdvice[]): VoucherAdvice | null {
  return [...advice].sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]
    || ((b.best?.worthGBP ?? 0) - b.parGBP) - ((a.best?.worthGBP ?? 0) - a.parGBP)
    || (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'))[0] ?? null;
}

const short = (cap: number) => `${cap % 1000 === 0 ? cap / 1000 : (cap / 1000).toFixed(1)}k`;

/** The voucher's line: what to do with it and why, in figures. */
export function voucherLine(a: VoucherAdvice): { title: string; sub: string } {
  const name = `${short(a.cap)} free night`;
  const where = a.best ? `${TIER_WORD[a.best.tier]} in ${a.best.city}, ~£${pts(a.best.cashGBP)}` : null;
  const expires = a.expiry ? `expires ${formatDate(a.expiry)}` : null;
  if (a.verdict === 'keep') return { title: `Keep the ${name}`, sub: [where ? `best here ${where}` : null, `£${pts(a.parGBP)} to you`, expires].filter(Boolean).join(' · ') };
  if (a.verdict === 'too-dear') return { title: `${name[0].toUpperCase()}${name.slice(1)} won’t stretch here`, sub: [expires].filter(Boolean).join(' · ') };
  const title = a.verdict === 'top-up' ? `Top up the ${name}` : a.verdict === 'use-soon' ? `Use the ${name} before it goes` : `Use the ${name}`;
  return {
    title,
    sub: [where, `~${pts(a.best!.points)} pts`, a.best!.topUp > 0 ? `+${pts(a.best!.topUp)} top-up` : null, `£${pts(a.parGBP)} to you`, expires].filter(Boolean).join(' · '),
  };
}

export interface StayInsight {
  programme: string;
  tier: string | null;
  nightly: number;
  benefits: string[];
  /** Nights toward a tier. For a trip next year, toward keeping the tier held, where it has a night requirement. */
  status: { target: string; before: number; after: number; total: number; reaches: boolean; nextYear: boolean; keep: boolean } | null;
  /** Points a night at the stop's mid-range and luxury cash rates, in season (estimates). */
  perNight: number | null;
  perNightLuxury: number | null;
  /** How the mid-range night is priced: Hyatt's category and range, or a dynamic estimate. */
  pricing: NightPoints | null;
  /** The mid-range night's cash measured at the programme's own hotels, where enough were priced; gbp at the member rate. */
  measured: (MeasuredCash & { city: string; gbp: number }) | null;
  nightsCovered: number | null;
  /** The programme's free-night voucher to talk about, with what to do with it. */
  voucher: VoucherAdvice | null;
  promoPoints: number;
}

export interface PlannedStop { city: string; country: string; nights: number; checkIn: string | null }

/**
 * What staying with each programme means for this user on this trip:
 * nights toward the tier they're working on, what their points would
 * cover, a free-night voucher that fits, and bonus points from their
 * promotions. Programmes come in the planner's own best-value order.
 */
export function stayInsights(
  options: HotelPlanOption[], stops: PlannedStop[], account: PlanAccount, progressOf: (name: string) => StatusProgress | null,
  market: Market, today: string,
): StayInsight[] {
  const nights = stops.reduce((s, c) => s + c.nights, 0);
  const firstIn = stops[0]?.checkIn ?? null;
  const tripYear = firstIn?.slice(0, 4) ?? today.slice(0, 4);
  // A night at one price level for a programme, at the first stop with a
  // price: its own hotels' measured prices where at least two were priced
  // (Marriott's Premium hotels for mid-range), else the city's researched
  // rate in its season, moved by any measured event on those nights.
  const night = (programme: string, tier: CityCashRate['tier']) => {
    for (const s of stops) {
      const level = marketPriceLevel(market, s);
      const measured = measuredCash(s, programme, tier, market);
      if (measured) return { cashUsd: measured.usd, level, stop: s, measured };
      const r = cityCashRates(market.rates, s.country, s.city).find((x) => x.tier === tier);
      if (r) return { cashUsd: stayCashUsd(r, s, market) * (eventPrices(s, programme, market.prices, tier)?.ratio ?? 1), level, stop: s, measured: null };
    }
    return null;
  };

  return options.map((o) => {
    const p = account.programmes.find((x) => x.name === o.programme);
    const progress = progressOf(o.programme);
    let status: StayInsight['status'] = null;
    const nextYear = tripYear > today.slice(0, 4);
    // Nights only count toward this year's tier in this year. A trip next
    // year counts toward keeping the tier held: a Titanium member's 12
    // nights next year are 12 of the 75 that keep Titanium. Not when a
    // card grants the tier (IHG Platinum with the card showed "12 of 40
    // nights to keep Platinum"), nor when a membership's yearly nights
    // keep it on their own (Accor+ Explorer's 30 keep Gold): then it's
    // the tier above, counting those membership nights, taken to renew.
    const held = progress?.effectiveTier ?? p?.tier ?? null;
    const byCard = !!held && progress?.cardGrantedTier === held;
    const membership = nextYear ? progress?.breakdown?.membership ?? 0 : 0;
    const keepNights = nextYear && !byCard ? nightsForTier(o.programme, held) : null;
    if (keepNights && held && membership < keepNights) {
      status = { target: held, before: membership, after: membership + nights, total: keepNights, reaches: membership + nights >= keepNights, nextYear, keep: true };
    } else if (progress?.targetTier && progress.total > 0) {
      const before = nextYear ? membership : progress.currentNights + progress.bookedNights;
      status = { target: progress.targetTier, before, after: before + nights, total: progress.total, reaches: before < progress.total && before + nights >= progress.total, nextYear, keep: false };
    }

    const value = market.pointsValue.find((v) => v.programme === o.programme) ?? null;
    // Points follow the night's cash where the programme prices that way.
    const mid = night(o.programme, 'mid');
    const luxury = night(o.programme, 'luxury');
    const pricing = mid ? nightPoints(o.programme, mid.cashUsd, mid.level, market) : null;
    const perNight = pricing?.points ?? null;
    const perNightLuxury = luxury ? nightPoints(o.programme, luxury.cashUsd, luxury.level, market)?.points ?? null : null;
    const fifthFree = !!value?.fifthNightFree && (o.programme !== 'Hilton Honors' || !!p?.tier && !/^member$/i.test(p.tier));
    const nightsCovered = perNight && p && p.points > 0 ? nightsFromBalance(p.points, perNight, fifthFree) : null;

    const word = PROGRAMME_WORD[o.programme];
    const voucher = word && p ? firstVoucher(account.vouchers
      .filter((x) => !x.redeemed && word.test(`${x.name} ${x.source}`) && (!x.expiryDate || !firstIn || x.expiryDate >= firstIn))
      .map((x) => voucherAdvice(x, p, stops, market))
      .filter((x): x is VoucherAdvice => x != null)) : null;

    // Promotions on stays this trip would book, as if booked today.
    const planned: Hotel[] = stops.filter((s) => s.checkIn).map((s, i) => ({
      id: `plan-${i}`, name: `${o.programme} ${s.city}`, country: s.country, city: s.city, brand: o.programme, nights: s.nights,
      date: s.checkIn!, status: 'Booked', total: Math.round(o.estimatedNightlyGBP * s.nights), nightlyRate: o.estimatedNightlyGBP, avgRate: null,
      sqm: null, card: null, category: 'Premium', lat: 0, lng: 0, benefitValue: null, benefitType: null, benefitNote: null,
      bookingChannel: null, roomType: null, rateType: null, award: false, createdAt: today,
    }));
    const pool = [...account.hotels, ...planned];
    const promoPoints = planned.reduce((s, h) => s + promoBonusForStay(h, pool, account.promotions.filter((x) => !x.endDate || x.endDate >= today)), 0);

    return {
      programme: o.programme, tier: o.tier, nightly: o.estimatedNightlyGBP, benefits: o.benefits, status, perNight, perNightLuxury, pricing,
      nightsCovered, voucher, promoPoints,
      measured: mid?.measured ? { ...mid.measured, city: mid.stop.city, gbp: Math.round(memberCash(o.programme, mid.measured.usd) * market.usdToGbp) } : null,
    };
  });
}

/** One line on what a stay does for status. */
export function statusLabel(s: NonNullable<StayInsight['status']>): string {
  const when = s.nextYear ? ' next year' : '';
  if (s.reaches) return `${s.keep ? 'Keeps' : 'Reaches'} ${s.target}${when}`;
  return `${s.after} of ${s.total} nights to ${s.keep ? 'keep ' : ''}${s.target}${when}`;
}

/** A night's points in a few characters: "Cat 3 · 15,000" for Hyatt, else "32,000". */
export function nightPointsShort(n: NightPoints): string {
  return n.model === 'chart' ? `Cat ${n.category} · ${pts(n.points)}` : pts(n.points);
}

/** A night's points as the programme prices it: Hyatt's category and range, else the estimate. */
function pointsLabel(s: Pick<StayInsight, 'perNight' | 'pricing'>): string {
  const p = s.pricing;
  if (p?.model === 'chart') return `~Cat ${p.category} · ${pts(p.points)} pts (${pts(p.low!)}–${pts(p.high!)})`;
  return `~${pts(s.perNight!)} pts${p?.capped ? ' (cap)' : ''}`;
}

/** The status and points lines under a programme in Where to stay. */
export function stayLines(s: StayInsight | undefined): string[] {
  if (!s) return [];
  return [
    s.status ? statusLabel(s.status) : null,
    s.perNight ? `${pointsLabel(s)} a night${s.nightsCovered ? ` · ${s.nightsCovered} night${s.nightsCovered === 1 ? '' : 's'} on points` : ''}` : null,
    s.measured ? `~£${pts(s.measured.gbp)} a night in ${s.measured.city} · ${s.measured.hotels} ${shortProgramme(s.programme)} hotels priced` : null,
    s.voucher && s.voucher.verdict !== 'too-dear' ? voucherLine(s.voucher).title : null,
  ].filter((x): x is string => !!x);
}

// ---------- when to go ----------

export interface StopOutlook {
  city: string;
  guide: BlendedMonthGuide;
  month: number;
  /** A neighbouring month that's quieter without worse weather, when this one is busy. */
  quieter: number | null;
  /** What makes the month busy or quiet, dated or not ("Dubai Shopping Festival"). */
  driver: string | null;
  /** National public holidays on the stay's nights. */
  holidays: Holiday[];
  /** The country's schools off on the stay's nights, and how widely. */
  school: SchoolBreak | null;
}

const CROWD_RANK = { low: 0, medium: 1, high: 2 } as const;
const WEATHER_RANK = { good: 0, okay: 1, poor: 2 } as const;

/** The weather and crowds for a stay, and a quieter month either side when it's busy. */
export function stopOutlook(climate: RealClimateMonth[], crowd: RealCrowdPriceMonth[], stop: PlannedStop, holidays: Holiday[] = [], school: SchoolHoliday[] = []): StopOutlook | null {
  if (!stop.checkIn) return null;
  const checkOut = addDays(stop.checkIn, stop.nights);
  const month = dominantMonth(stop.checkIn, checkOut);
  const guide = blendedGuideForMonth(climate, crowd, stop.city, stop.country, month, stop.checkIn, checkOut);
  if (!guide) return null;
  let quieter: number | null = null;
  if (guide.crowd === 'high') {
    for (const m of [(month + 11) % 12, (month + 1) % 12]) {
      const rep = `2026-${String(m + 1).padStart(2, '0')}-15`;
      const g = blendedGuideForMonth(climate, crowd, stop.city, stop.country, m, rep, rep);
      if (g?.crowd && CROWD_RANK[g.crowd] < CROWD_RANK.high && WEATHER_RANK[g.weather] <= WEATHER_RANK[guide.weather]) { quieter = m; break; }
    }
  }
  const driver = findCrowdPriceMonth(crowd, stop.city, stop.country, MONTH_NAMES[month].slice(0, 3))?.driver || null;
  return {
    city: stop.city, guide, month, quieter, driver,
    holidays: holidaysDuring(holidays, stop.checkIn, stop.nights), school: schoolBreakDuring(school, stop.checkIn, stop.nights),
  };
}

/** The nights of a check-in/check-out pair: "13–15 Jan", or "30 Dec–1 Jan" across months. */
export function nightsRange([checkIn, checkOut]: [string, string]): string {
  const last = addDays(checkOut, -1);
  if (checkIn.slice(0, 7) === last.slice(0, 7)) return `${Number(checkIn.slice(8))}–${shortDate(last)}`;
  return `${shortDate(checkIn)}–${shortDate(last)}`;
}

/** A stay's holidays on one line: "Constitution Memorial Day, 3 May (long weekend)". */
export function holidayLine(holidays: Holiday[]): string | null {
  if (holidays.length === 0) return null;
  const first = holidays[0];
  const lw = longWeekend(first.date);
  return [`${first.name}, ${shortDate(first.date)}${lw ? ` (${lw})` : ''}`, holidays.length > 1 ? `+${holidays.length - 1} more` : null].filter(Boolean).join(' · ');
}

const REACH_WORDS = { all: 'nationwide', most: 'most regions', some: 'some regions' } as const;

/** A school break on one line: "Christmas Holidays, 20 Dec–3 Jan · nationwide". */
export function schoolLine(b: SchoolBreak | null): string | null {
  if (!b) return null;
  const dates = b.start === b.end ? shortDate(b.start) : nightsRange([b.start, addDays(b.end, 1)]);
  return `${b.name}, ${dates} · ${REACH_WORDS[b.reach]}`;
}

/**
 * A stop's school line, unless its crowd note already names the school
 * holidays: Paris at Christmas showed "Christmas school holidays, all
 * zones" and then "Christmas Holidays · nationwide" under it.
 */
export function schoolNote(b: SchoolBreak | null, crowdDriver: string | null | undefined): string | null {
  return /school/i.test(crowdDriver ?? '') ? null : schoolLine(b);
}

/** A crowd driver short enough for a title: up to its first ";" or "(". */
export function shortDriver(text: string): string {
  return text.split(/;|\s\(/)[0].trim();
}

// ---------- for you ----------

export interface ForYouItem {
  kind: 'flight' | 'stay' | 'status' | 'voucher' | 'prices' | 'crowds' | 'holiday' | 'school' | 'weather';
  title: string;
  sub: string;
}

const pts = (n: number) => n.toLocaleString('en-GB');
const money = (n: number) => `£${n % 1 === 0 ? pts(n) : n.toFixed(2)}`;

/**
 * A seat's points: the price on the day with its season ("33,000 peak"),
 * at least the off-peak price on a peak day with no sourced peak price,
 * or the range where the season isn't known.
 */
export function awardPointsLabel(o: Pick<AwardOption, 'points' | 'offPeakPoints' | 'peakPoints' | 'season' | 'atLeast'>): string {
  if (o.season) return `${pts(o.points)}${o.atLeast ? '+' : ''} ${o.season}`;
  return o.peakPoints && o.peakPoints !== o.offPeakPoints ? `${pts(o.offPeakPoints)}–${pts(o.peakPoints)}` : pts(o.offPeakPoints);
}

/** The cash line on a reward seat: sourced charges, or APD as the floor. */
export function awardCashLabel(o: Pick<AwardOption, 'cash' | 'cashEstimated' | 'apd'>): string | null {
  if (o.cash != null) return `${o.cashEstimated ? '~' : ''}${money(o.cash)}`;
  if (o.apd != null) return `${money(o.apd)} APD + fees`;
  return null;
}

/**
 * The few things worth knowing about this trip for this user, best
 * first: how to fly it on their points, where to stay for their status,
 * a voucher that pays for a night, and a warning when the dates land on
 * crowds or the wet season.
 */
export function forYou(input: {
  flights: AwardOption[]; stays: StayInsight[]; outlooks: StopOutlook[]; cabin?: AwardCabin; stops?: PlannedStop[];
}): ForYouItem[] {
  const out: ForYouItem[] = [];

  // A seat they can pay for in the cabin they usually book, then any they
  // can pay for, then the usual cabin anyway.
  const usual = (o: AwardOption) => !input.cabin || o.cabin === input.cabin;
  const f = input.flights.find((o) => o.covers && usual(o)) ?? input.flights.find((o) => o.covers) ?? input.flights.find(usual) ?? input.flights[0];
  if (f) {
    const cash = awardCashLabel(f);
    out.push({
      kind: 'flight',
      title: `${f.airlineName} ${f.cabin.toLowerCase()} on ${f.currency}`,
      sub: [`${awardPointsLabel(f)}${cash ? ` + ${cash}` : ''}`,
        f.covers ? (f.companion ? `${f.seats} seats with the companion voucher` : `you have ${pts(f.balance)}`) : `${pts(f.points - f.balance)} short`,
        f.perk].filter(Boolean).join(' · '),
    });
  }

  // The best-value stay (the planner's own ranking, which counts the
  // tier's earning bonus and the user's own past rates). A programme that
  // merely reaches its first tier isn't preferred over it: a 12-night trip
  // "reaching" Hyatt Discoverist once outranked Titanium benefits.
  const stay = input.stays[0];
  if (stay) {
    const bits = [
      stay.status ? statusLabel(stay.status) : null,
      stay.promoPoints > 0 ? `+${pts(stay.promoPoints)} promo pts` : null,
      stay.benefits.slice(0, 2).map((b) => b.replace(/ \(.*\)$/, '').toLowerCase()).join(', ') || null,
    ].filter(Boolean);
    out.push({ kind: 'stay', title: `Stay ${stay.programme}`, sub: bits.join(' · ') });
  }
  // Another programme's tier reached this year by these nights.
  const reach = input.stays.slice(1).find((s) => s.status?.reaches && !s.status.nextYear && !s.status.keep);
  if (reach?.status) out.push({ kind: 'status', title: `Reach ${reach.status.target} with ${reach.programme}`, sub: `${reach.status.after} of ${reach.status.total} nights` });

  // A free-night voucher: where to use it, whether to top it up, or to
  // keep it. It once said to spend a 40k voucher on a 20k night.
  const voucher = firstVoucher(input.stays.map((s) => s.voucher).filter((x): x is VoucherAdvice => x != null && x.verdict !== 'too-dear'));
  if (voucher) out.push({ kind: 'voucher', ...voucherLine(voucher) });

  // A measured event on the stay's nights, for the programme recommended:
  // "+148%" is worth knowing, and so is "-17%".
  const programme = input.stays[0]?.programme ?? null;
  for (const st of input.stops ?? []) {
    const e = eventPrices(st, programme);
    if (!e) continue;
    const pct = Math.round((e.ratio - 1) * 100);
    const change = `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}% on ${nightsRange(e.baseline)} · ${e.hotels} hotel${e.hotels === 1 ? '' : 's'}`;
    out.push({ kind: 'prices', title: `${e.event} in ${st.city}`, sub: e.programme ? `${shortProgramme(e.programme)} ${change}` : change });
    break;
  }

  const busy = input.outlooks.find((o) => o.guide.crowd === 'high');
  if (busy) {
    out.push({
      kind: 'crowds',
      // A dated event names itself; an undated one ("Dubai Shopping
      // Festival") says why it's busy, where "Busy in Dubai" said nothing.
      title: busy.guide.crowdDriver ? `${shortDriver(busy.guide.crowdDriver)}${busy.guide.crowdDriverDates ? `, ${busy.guide.crowdDriverDates}` : ''}` : `Busy in ${busy.city}`,
      sub: [
        busy.guide.crowdDriver || !busy.driver ? `Crowds and prices high in ${busy.city}` : shortDriver(busy.driver),
        busy.quieter != null ? `quieter in ${MONTH_NAMES[busy.quieter]}` : null,
      ].filter(Boolean).join(' · '),
    });
  }

  // A public holiday on the trip, unless the crowd line already names one.
  const hol = input.outlooks.find((o) => o.holidays.length > 0);
  if (hol && !(busy?.guide.crowdDriver && busy.city === hol.city)) {
    out.push({ kind: 'holiday', title: `Public holiday in ${hol.city}`, sub: holidayLine(hol.holidays)! });
  }

  // Schools off across most of the country: families travel, so resorts
  // and sights fill. A few regions' break isn't worth a line here; the
  // stop card still shows it.
  const school = input.outlooks.find((o) => o.school && o.school.reach !== 'some');
  if (school && !(busy?.city === school.city && /school/i.test(busy.guide.crowdDriver ?? ''))) {
    out.push({ kind: 'school', title: `School holidays in ${school.city}`, sub: schoolLine(school.school)! });
  }

  const wet = input.outlooks.find((o) => o.guide.weather === 'poor');
  if (wet) out.push({ kind: 'weather', title: `Poor weather in ${wet.city}`, sub: `${Math.round(wet.guide.tempHigh)}° · ${wet.guide.rainLabel} rain in ${MONTH_NAMES[wet.month]}` });

  return out;
}

// ---------- what the agent is told ----------

export interface AgentContext {
  month: string | null;
  holidays: { date: string; name: string }[];
  /** The country's school break during the trip, at its widest. */
  school: { start: string; end: string; name: string; reach: SchoolBreak['reach'] }[];
  regions: { region: string; highC: number | null; rainMm: number | null; crowd: string | null; price: string | null; event: string | null }[];
  visited: string[];
  home: string;
}

/**
 * The facts sent with a request for city suggestions: each region's
 * weather and crowds in the month of travel, and the cities already
 * stayed in there. The agent is told to rely on these, not its memory.
 */
export function agentContext(country: string, startDate: string | null, nights: number, climate: RealClimateMonth[], crowd: RealCrowdPriceMonth[], hotels: Hotel[], home: string, holidays: Holiday[] = [], schoolHolidays: SchoolHoliday[] = []): AgentContext {
  const month = startDate ? dominantMonth(startDate, addDays(startDate, nights)) : null;
  const abbr = month != null ? MONTH_NAMES[month].slice(0, 3) : null;
  const regions = abbr
    ? climate.filter((c) => sameCountry(c.country, country) && c.month === abbr).map((c) => {
        const cp = crowd.find((r) => sameCountry(r.country, country) && r.month === abbr && r.region && (r.region.toLowerCase().includes(c.hubStation.toLowerCase()) || c.region.toLowerCase().includes(r.region.toLowerCase())))
          ?? crowd.find((r) => sameCountry(r.country, country) && r.month === abbr && r.region === null) ?? null;
        return { region: c.region, highC: c.tempHighC, rainMm: c.rainMm, crowd: cp?.crowdLevel ?? null, price: cp?.priceLevel ?? null, event: cp?.driver ?? null };
      })
    : [];
  const visited = [...new Set(hotels.filter((h) => sameCountry(h.country, country) && h.city).map((h) => h.city!))].sort();
  const during = startDate ? holidaysDuring(holidays, startDate, nights).map((x) => ({ date: x.date, name: x.name })) : [];
  const brk = startDate ? schoolBreakDuring(schoolHolidays, startDate, nights) : null;
  return { month: month != null ? MONTH_NAMES[month] : null, holidays: during, school: brk ? [brk] : [], regions, visited, home };
}
