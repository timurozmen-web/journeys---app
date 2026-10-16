import { CARDS_STATIC, defaultCardFor, isEuropeOrUK, isIHGPremiumCountry } from '../data/cardDefs';
import { stayPoints } from './loyaltyPoints';
import { promoBonusForStay } from './promoBonus';
import type { Trip, Hotel, LoyaltyProgramme, Promotion } from '../types';
// The shared UTC helper: a local copy here added days in local time and
// read the date back in UTC, so a stay running over the clocks going
// forward (28 Mar + 2 nights) ended a day early, on the 29th.
import { addDays } from './tripDay';

export interface TripPointsResult {
  totalPoints: number;
  totalValue: number; // £
  centsPerPoint: number; // pence per point, blended
}

/** One line of a trip's points: a stay, its promotions, or a card's earning on it. */
export interface TripPointsLine {
  key: string;
  label: string;
  points: number;
  value: number; // £
}

// `allStays` is every logged stay, so a bonus like "10,000 on your second
// stay" counts stays outside this trip. `upcoming` estimates a trip not yet
// taken: its booked stays count, where a past trip counts completed ones.
// Lines are each stay's own points, then promotion bonuses together, then
// each card's points on what it paid for, then Virgin Atlantic flights.
export function tripPointsLines(trip: Trip, loyaltyProgrammes: LoyaltyProgramme[], promotions: Promotion[] = [], allStays: Hotel[] = trip.hotels, upcoming = false): TripPointsLine[] {
  const ptValueByBrand = new Map(loyaltyProgrammes.map((p) => [p.name, p.ptValue]));
  const valueOf = (pts: number, programme: string) => (pts * (ptValueByBrand.get(programme) ?? 1)) / 100;
  const lines: TripPointsLine[] = [];
  let promo = 0;
  let promoValue = 0;
  const cards = new Map<string, TripPointsLine>();

  for (const h of [...trip.hotels].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!h.total) continue;

    // Hotel-programme points (rate x elite tier bonus, then promotions) --
    // earned by staying, independent of which card paid.
    const counts = upcoming ? h.status !== 'needs-confirm' : h.status === 'Completed';
    const all = counts ? stayPoints(h, loyaltyProgrammes, promotions, allStays) : 0;
    const bonus = counts ? promoBonusForStay(h, allStays, promotions) : 0;
    if (all - bonus > 0) lines.push({ key: `stay-${h.id}`, label: h.name, points: all - bonus, value: valueOf(all - bonus, h.brand) });
    promo += bonus;
    promoValue += valueOf(bonus, h.brand);

    // Card-issued bonus points -- separate, additive earning stream.
    const cardId = h.card || defaultCardFor(h.brand);
    const card = CARDS_STATIC.find((c) => c.id === cardId);
    if (!card) continue;
    const rate = card.rateFor({
      ownBrand: h.brand === card.programmeBrand,
      isUK: h.country === 'United Kingdom',
      isUKEurope: isEuropeOrUK(h.country),
      isPremiumCountry: isIHGPremiumCountry(h.country),
      date: h.date,
    });
    const pts = h.total * rate;
    const line = cards.get(card.id) ?? { key: `card-${card.id}`, label: card.id, points: 0, value: 0 };
    line.points += pts;
    line.value += valueOf(pts, card.programmeBrand);
    cards.set(card.id, line);
  }
  if (promo > 0) lines.push({ key: 'promos', label: 'Promotions', points: promo, value: promoValue });
  lines.push(...cards.values());

  // Virgin Atlantic flights, same special case as Wallet's card math.
  const virginCard = CARDS_STATIC.find((c) => c.programmeBrand === 'Virgin Points');
  if (virginCard) {
    let pts = 0;
    for (const f of trip.flights) {
      if (f.airline !== 'Virgin Atlantic' || !f.cost) continue;
      pts += f.cost * virginCard.rateFor({ ownBrand: true, isUK: false, isUKEurope: false, isPremiumCountry: false, date: f.date ?? '' });
    }
    if (pts > 0) lines.push({ key: 'virgin', label: 'Virgin Atlantic flights', points: pts, value: valueOf(pts, 'Virgin Points') });
  }
  return lines.map((l) => ({ ...l, points: Math.round(l.points) }));
}

export function computeTripPoints(trip: Trip, loyaltyProgrammes: LoyaltyProgramme[], promotions: Promotion[] = [], allStays: Hotel[] = trip.hotels, upcoming = false): TripPointsResult {
  const lines = tripPointsLines(trip, loyaltyProgrammes, promotions, allStays, upcoming);
  const totalPoints = lines.reduce((s, l) => s + l.points, 0);
  const totalValue = lines.reduce((s, l) => s + l.value, 0);
  return { totalPoints, totalValue, centsPerPoint: totalPoints > 0 ? (totalValue / totalPoints) * 100 : 0 };
}

export function computeTripSavings(trip: Trip): number {
  let savings = 0;
  for (const h of trip.hotels) {
    if (h.avgRate != null && h.nightlyRate != null) savings += (h.avgRate - h.nightlyRate) * h.nights;
  }
  return savings;
}

export interface Destination {
  place: string;
  start: string;
  end: string;
  nights: number;
  hotels: Hotel[];
}

// Groups a trip's hotels by country into distinct destinations, in the
// order they were visited. Country is what the data actually tracks --
// there's no separate city field, so this is the honest grain available.
export function groupDestinations(trip: Trip): Destination[] {
  const sorted = [...trip.hotels].sort((a, b) => a.date.localeCompare(b.date));
  const groups: Destination[] = [];
  for (const h of sorted) {
    const place = h.city || h.country;
    const last = groups[groups.length - 1];
    if (last && last.place === place) {
      last.nights += h.nights;
      last.hotels.push(h);
      const hotelEnd = addDays(h.date, h.nights);
      if (hotelEnd > last.end) last.end = hotelEnd;
    } else {
      groups.push({ place, start: h.date, end: addDays(h.date, h.nights), nights: h.nights, hotels: [h] });
    }
  }
  return groups;
}


export interface Gap {
  start: string;
  end: string;
  nights: number;
}

// Every night of a trip should be covered by some hotel. This finds the
// stretches that aren't, so they can be filled in rather than left silent.
export interface SplitSuggestion {
  splitDate: string; // the new second trip would start here
  beforeCountry: string;
  afterCountry: string;
}

/**
 * Detects when a trip's logged stays look like two genuinely separate
 * trips rather than one continuous journey with a gap: a long break (6+
 * nights) between stays where the country also changes. A short gap or a
 * same-country gap is just a missing hotel to log, not a different trip.
 */
export function suggestTripSplit(trip: Trip): SplitSuggestion | null {
  const sorted = [...trip.hotels].filter((h) => h.nights > 0).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const aEnd = addDays(a.date, a.nights);
    const gapNights = nightsBetween(aEnd, b.date);
    if (gapNights >= 6 && a.country.trim().toLowerCase() !== b.country.trim().toLowerCase()) {
      return { splitDate: b.date, beforeCountry: a.country, afterCountry: b.country };
    }
  }
  return null;
}

export function findGaps(trip: Trip): Gap[] {
  const hotelIntervals = trip.hotels
    .filter((h) => h.nights > 0)
    .map((h) => ({ start: h.date, end: addDays(h.date, h.nights) }));
  // A genuinely long overnight flight (e.g. London-Australia) can span two
  // calendar nights once duration and timezone crossing are accounted
  // for, not just the single night of its logged date -- covering only
  // one night left the earlier night still incorrectly flagged as a gap
  // needing a hotel, even though the traveller was genuinely in transit
  // for both.
  const overnightFlightIntervals = trip.flights
    .filter((f) => f.overnight && f.date)
    .map((f) => ({ start: addDays(f.date as string, -1), end: addDays(f.date as string, 1) }));
  const intervals = [...hotelIntervals, ...overnightFlightIntervals].sort((a, b) => a.start.localeCompare(b.start));

  // Merge overlapping/adjacent covered ranges.
  const merged: { start: string; end: string }[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      if (iv.end > last.end) last.end = iv.end;
    } else {
      merged.push({ ...iv });
    }
  }

  const gaps: Gap[] = [];
  let cursor = trip.start;
  for (const iv of merged) {
    if (iv.start > cursor) {
      gaps.push({ start: cursor, end: iv.start, nights: nightsBetween(cursor, iv.start) });
    }
    if (iv.end > cursor) cursor = iv.end;
  }
  if (cursor < trip.end) {
    gaps.push({ start: cursor, end: trip.end, nights: nightsBetween(cursor, trip.end) });
  }
  return gaps;
}

function nightsBetween(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}
