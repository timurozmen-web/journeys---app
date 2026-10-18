import type { Flight, Hotel, LoyaltyProgramme, Promotion, Voucher } from '../types';
import { APD_BAND_LISTED, APD_EDGE_MILES, APD_RATES, CAPITALS, type ApdBand } from '../data/airPassengerDuty';
import { AWARD_AIRLINES, AWARD_ROUTES, CURRENCY_PROGRAMME, STATUS_PERKS, type AwardCurrency } from '../data/awardFlights';
import { AWARD_CLASSES, type AwardCabin } from '../data/awardClasses';
import { promoBonusForStay } from './promoBonus';
import { addDays } from './tripDay';
import { blendedGuideForMonth, dominantMonth, MONTH_NAMES, type BlendedMonthGuide } from './destinationGuide';
import type { HotelPlanOption } from './hotelPlanner';
import { nightsForTier, type StatusProgress } from './statusProgress';
import { formatDate } from './format';
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
 * can't be said for sure (capital not listed, or too near a band edge to
 * trust a worked-out distance).
 */
export function apdBand(country: string): ApdBand | null {
  if (/^(united kingdom|uk|great britain)$/i.test(country.trim())) return 'domestic';
  const listed = APD_BAND_LISTED[country];
  if (listed) return listed;
  const capital = CAPITALS[country];
  if (!capital) return null;
  const d = miles(LONDON, capital);
  if (Math.abs(d - 2000) < APD_EDGE_MILES || Math.abs(d - 5500) < APD_EDGE_MILES) return null;
  return d <= 2000 ? 'A' : d <= 5500 ? 'B' : 'C';
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
  points: number; // off-peak (or the Saver cap)
  peakPoints: number | null;
  /** Taxes and charges on the reward ticket, where sourced (APD included). */
  cash: number | null;
  cashEstimated: boolean;
  /** UK APD alone: the least the cash can be when `cash` isn't known. */
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

/**
 * Every sourced reward seat from London to `airport` in the given cabins,
 * priced against the user's balances: ones they can pay for first, then
 * by what each really costs them at their own point values.
 */
export function awardOptions(
  airport: string | null, country: string, date: string, cabins: AwardCabin[], account: Pick<PlanAccount, 'programmes' | 'vouchers'>,
): AwardOption[] {
  if (!airport) return [];
  const code = airport.trim().toUpperCase();
  const companion = account.vouchers.some((v) => !v.redeemed && (!v.expiryDate || v.expiryDate >= date) && COMPANION.test(`${v.name} ${v.source}`) && /british airways|\bba\b/i.test(`${v.name} ${v.source}`));
  const out: AwardOption[] = [];
  for (const route of AWARD_ROUTES) {
    if (!route.airports.includes(code)) continue;
    for (const cabin of cabins) {
      const price = route.cabins[cabin];
      if (!price) continue;
      const holder = holdingOf(account.programmes, route.currency);
      const balance = holder?.points ?? 0;
      const apd = airPassengerDuty(country, cabin, date)?.amount ?? null;
      const cash = price.cash ?? apd ?? 0;
      const withCompanion = companion && route.airline === 'BA';
      const seats = Math.floor(balance / price.offPeak) * (withCompanion ? 2 : 1);
      const perk = STATUS_PERKS.find((s) => s.airlines.includes(route.airline) && account.programmes.some((p) => s.programme.test(p.name) && s.tier.test(p.tier ?? '')))?.perk ?? null;
      const letter = Object.entries(AWARD_CLASSES[route.airline] ?? {}).find(([, c]) => c === cabin)?.[0] ?? null;
      out.push({
        airline: route.airline, airlineName: AWARD_AIRLINES[route.airline], place: route.place, currency: route.currency, cabin,
        points: price.offPeak, peakPoints: price.peak, cash: price.cash, cashEstimated: !!price.cashEstimated, apd,
        programme: holder?.name ?? null, balance, covers: balance >= price.offPeak, seats, companion: withCompanion,
        costGBP: Math.round((price.offPeak * (holder?.ptValue ?? 1)) / 100 + cash),
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
  const candidates = rates.filter((r) => r.country.toLowerCase() === country.toLowerCase() && (!cq || r.city.toLowerCase().includes(cq) || cq.includes(r.city.toLowerCase())));
  if (candidates.length === 0) return [];
  const byCity = new Map<string, CityCashRate[]>();
  for (const r of candidates) byCity.set(r.city, [...(byCity.get(r.city) ?? []), r]);
  return [...byCity.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0][1];
}

/** Points a night costs at a programme's average redemption value: an estimate. */
export function pointsPerNight(cashUsd: number, value: PointsValueProgramme): number {
  return Math.round((cashUsd * 100) / value.avgCentsPerPoint / 500) * 500;
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

export interface StayInsight {
  programme: string;
  tier: string | null;
  nightly: number;
  benefits: string[];
  /** Nights toward a tier. For a trip next year, toward keeping the tier held, where it has a night requirement. */
  status: { target: string; before: number; after: number; total: number; reaches: boolean; nextYear: boolean; keep: boolean } | null;
  /** Points a night at the stop's mid-range and luxury cash rates (estimates). */
  perNight: number | null;
  perNightLuxury: number | null;
  nightsCovered: number | null;
  voucher: { name: string; cap: number; fits: boolean; expiry: string | null } | null;
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
  pointsValue: PointsValueProgramme[], rates: CityCashRate[], today: string,
): StayInsight[] {
  const nights = stops.reduce((s, c) => s + c.nights, 0);
  const firstIn = stops[0]?.checkIn ?? null;
  const tripYear = firstIn?.slice(0, 4) ?? today.slice(0, 4);
  const rateUsd = (tier: CityCashRate['tier']) => {
    const r = stops.map((s) => cityCashRates(rates, s.country, s.city).find((x) => x.tier === tier)).find(Boolean);
    return r ? (r.priceLowUsd + r.priceHighUsd) / 2 : null;
  };
  const midUsd = rateUsd('mid');
  const luxuryUsd = rateUsd('luxury');

  return options.map((o) => {
    const p = account.programmes.find((x) => x.name === o.programme);
    const progress = progressOf(o.programme);
    let status: StayInsight['status'] = null;
    const nextYear = tripYear > today.slice(0, 4);
    // Nights only count toward this year's tier in this year. A trip next
    // year counts from nothing, toward keeping the tier held: a Titanium
    // member's 12 nights next year are 12 of the 75 that keep Titanium.
    const held = progress?.effectiveTier ?? p?.tier ?? null;
    const keepNights = nextYear ? nightsForTier(o.programme, held) : null;
    if (keepNights && held) {
      status = { target: held, before: 0, after: nights, total: keepNights, reaches: nights >= keepNights, nextYear, keep: true };
    } else if (progress?.targetTier && progress.total > 0) {
      const before = nextYear ? 0 : progress.currentNights + progress.bookedNights;
      status = { target: progress.targetTier, before, after: before + nights, total: progress.total, reaches: before < progress.total && before + nights >= progress.total, nextYear, keep: false };
    }

    const value = pointsValue.find((v) => v.programme === o.programme) ?? null;
    const perNight = value && midUsd ? pointsPerNight(midUsd, value) : null;
    const perNightLuxury = value && luxuryUsd ? pointsPerNight(luxuryUsd, value) : null;
    const fifthFree = !!value?.fifthNightFree && (o.programme !== 'Hilton Honors' || !!p?.tier && !/^member$/i.test(p.tier));
    const nightsCovered = perNight && p && p.points > 0 ? nightsFromBalance(p.points, perNight, fifthFree) : null;

    // The voucher to use first: the one expiring soonest, then the biggest.
    const word = PROGRAMME_WORD[o.programme];
    const v = word && account.vouchers
      .filter((x) => !x.redeemed && word.test(`${x.name} ${x.source}`) && voucherCap(x.name) != null && (!x.expiryDate || !firstIn || x.expiryDate >= firstIn))
      .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') || voucherCap(b.name)! - voucherCap(a.name)!)[0];
    const cap = v ? voucherCap(v.name)! : null;
    const voucher = v && cap ? { name: v.name, cap, fits: perNight != null && perNight <= cap, expiry: v.expiryDate } : null;

    // Promotions on stays this trip would book, as if booked today.
    const planned: Hotel[] = stops.filter((s) => s.checkIn).map((s, i) => ({
      id: `plan-${i}`, name: `${o.programme} ${s.city}`, country: s.country, city: s.city, brand: o.programme, nights: s.nights,
      date: s.checkIn!, status: 'Booked', total: Math.round(o.estimatedNightlyGBP * s.nights), nightlyRate: o.estimatedNightlyGBP, avgRate: null,
      sqm: null, card: null, category: 'Premium', lat: 0, lng: 0, benefitValue: null, benefitType: null, benefitNote: null,
      bookingChannel: null, roomType: null, rateType: null, award: false, createdAt: today,
    }));
    const pool = [...account.hotels, ...planned];
    const promoPoints = planned.reduce((s, h) => s + promoBonusForStay(h, pool, account.promotions.filter((x) => !x.endDate || x.endDate >= today)), 0);

    return { programme: o.programme, tier: o.tier, nightly: o.estimatedNightlyGBP, benefits: o.benefits, status, perNight, perNightLuxury, nightsCovered, voucher, promoPoints };
  });
}

/** One line on what a stay does for status. */
export function statusLabel(s: NonNullable<StayInsight['status']>): string {
  const when = s.nextYear ? ' next year' : '';
  if (s.reaches) return `${s.keep ? 'Keeps' : 'Reaches'} ${s.target}${when}`;
  return `${s.after} of ${s.total} nights to ${s.keep ? 'keep ' : ''}${s.target}${when}`;
}

/** The status and points lines under a programme in Where to stay. */
export function stayLines(s: StayInsight | undefined): string[] {
  if (!s) return [];
  return [
    s.status ? statusLabel(s.status) : null,
    s.perNight ? `~${pts(s.perNight)} pts a night${s.nightsCovered ? ` · ${s.nightsCovered} nights on points` : ''}` : null,
  ].filter((x): x is string => !!x);
}

// ---------- when to go ----------

export interface StopOutlook {
  city: string;
  guide: BlendedMonthGuide;
  month: number;
  /** A neighbouring month that's quieter without worse weather, when this one is busy. */
  quieter: number | null;
}

const CROWD_RANK = { low: 0, medium: 1, high: 2 } as const;
const WEATHER_RANK = { good: 0, okay: 1, poor: 2 } as const;

/** The weather and crowds for a stay, and a quieter month either side when it's busy. */
export function stopOutlook(climate: RealClimateMonth[], crowd: RealCrowdPriceMonth[], stop: PlannedStop): StopOutlook | null {
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
  return { city: stop.city, guide, month, quieter };
}

// ---------- for you ----------

export interface ForYouItem {
  kind: 'flight' | 'stay' | 'status' | 'voucher' | 'crowds' | 'weather';
  title: string;
  sub: string;
}

const pts = (n: number) => n.toLocaleString('en-GB');
const money = (n: number) => `£${n % 1 === 0 ? pts(n) : n.toFixed(2)}`;

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
  flights: AwardOption[]; stays: StayInsight[]; outlooks: StopOutlook[]; cabin?: AwardCabin;
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
      sub: [`${pts(f.points)}${f.peakPoints && f.peakPoints !== f.points ? `–${pts(f.peakPoints)}` : ''}${cash ? ` + ${cash}` : ''}`,
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

  // A free-night voucher that covers a night here, with what a night
  // costs mid-range and at the top end, as a cap spent on a cheaper night
  // is value lost.
  const v = input.stays.find((s) => s.voucher?.fits);
  if (v?.voucher) {
    out.push({
      kind: 'voucher', title: `${pts(v.voucher.cap)}-pt free night`,
      sub: [`~${pts(v.perNight!)} mid-range`, v.perNightLuxury ? `~${pts(v.perNightLuxury)} luxury` : null, v.voucher.expiry ? `expires ${formatDate(v.voucher.expiry)}` : null].filter(Boolean).join(' · '),
    });
  }

  const busy = input.outlooks.find((o) => o.guide.crowd === 'high');
  if (busy) {
    out.push({
      kind: 'crowds',
      title: busy.guide.crowdDriver ? `${busy.guide.crowdDriver}${busy.guide.crowdDriverDates ? `, ${busy.guide.crowdDriverDates}` : ''}` : `Busy in ${busy.city}`,
      sub: [`Crowds and prices high in ${busy.city}`, busy.quieter != null ? `quieter in ${MONTH_NAMES[busy.quieter]}` : null].filter(Boolean).join(' · '),
    });
  }

  const wet = input.outlooks.find((o) => o.guide.weather === 'poor');
  if (wet) out.push({ kind: 'weather', title: `Poor weather in ${wet.city}`, sub: `${Math.round(wet.guide.tempHigh)}° · ${wet.guide.rainLabel} rain in ${MONTH_NAMES[wet.month]}` });

  return out;
}

// ---------- what the agent is told ----------

export interface AgentContext {
  month: string | null;
  regions: { region: string; highC: number | null; rainMm: number | null; crowd: string | null; price: string | null; event: string | null }[];
  visited: string[];
  home: string;
}

/**
 * The facts sent with a request for city suggestions: each region's
 * weather and crowds in the month of travel, and the cities already
 * stayed in there. The agent is told to rely on these, not its memory.
 */
export function agentContext(country: string, startDate: string | null, nights: number, climate: RealClimateMonth[], crowd: RealCrowdPriceMonth[], hotels: Hotel[], home: string): AgentContext {
  const month = startDate ? dominantMonth(startDate, addDays(startDate, nights)) : null;
  const abbr = month != null ? MONTH_NAMES[month].slice(0, 3) : null;
  const regions = abbr
    ? climate.filter((c) => c.country.toLowerCase() === country.toLowerCase() && c.month === abbr).map((c) => {
        const cp = crowd.find((r) => r.country.toLowerCase() === country.toLowerCase() && r.month === abbr && r.region && (r.region.toLowerCase().includes(c.hubStation.toLowerCase()) || c.region.toLowerCase().includes(r.region.toLowerCase())))
          ?? crowd.find((r) => r.country.toLowerCase() === country.toLowerCase() && r.month === abbr && r.region === null) ?? null;
        return { region: c.region, highC: c.tempHighC, rainMm: c.rainMm, crowd: cp?.crowdLevel ?? null, price: cp?.priceLevel ?? null, event: cp?.driver ?? null };
      })
    : [];
  const visited = [...new Set(hotels.filter((h) => h.country.toLowerCase() === country.toLowerCase() && h.city).map((h) => h.city!))].sort();
  return { month: month != null ? MONTH_NAMES[month] : null, regions, visited, home };
}
