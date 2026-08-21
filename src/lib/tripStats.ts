import { CARDS_STATIC, defaultCardFor, isEuropeOrUK, isIHGPremiumCountry } from '../data/cardDefs';
import { basePointsForHotel } from './loyaltyPoints';
import type { Trip, Hotel, LoyaltyProgramme, Promotion } from '../types';

export interface TripPointsResult {
  totalPoints: number;
  totalValue: number; // £
  centsPerPoint: number; // pence per point, blended
}

export function computeTripPoints(trip: Trip, loyaltyProgrammes: LoyaltyProgramme[], promotions: Promotion[] = []): TripPointsResult {
  const ptValueByBrand = new Map(loyaltyProgrammes.map((p) => [p.name, p.ptValue]));
  let totalPoints = 0;
  let totalValue = 0;

  for (const h of trip.hotels) {
    if (!h.total) continue;

    // Base hotel-loyalty-program points (rate × elite tier bonus) --
    // earned by staying, independent of which card paid.
    const basePts = basePointsForHotel(h, promotions);
    if (basePts > 0) {
      const basePtVal = ptValueByBrand.get(h.brand) ?? 1;
      totalPoints += basePts;
      totalValue += (basePts * basePtVal) / 100;
    }

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
    const ptVal = ptValueByBrand.get(card.programmeBrand) ?? 1;
    totalPoints += pts;
    totalValue += (pts * ptVal) / 100;
  }

  // Virgin Atlantic flights, same special case as Wallet's card math.
  const virginCard = CARDS_STATIC.find((c) => c.programmeBrand === 'Virgin Points');
  if (virginCard) {
    for (const f of trip.flights) {
      if (f.airline !== 'Virgin Atlantic' || !f.cost) continue;
      const rate = virginCard.rateFor({ ownBrand: true, isUK: false, isUKEurope: false, isPremiumCountry: false, date: f.date ?? '' });
      const pts = f.cost * rate;
      const ptVal = ptValueByBrand.get('Virgin Points') ?? 1;
      totalPoints += pts;
      totalValue += (pts * ptVal) / 100;
    }
  }

  return {
    totalPoints: Math.round(totalPoints),
    totalValue,
    centsPerPoint: totalPoints > 0 ? (totalValue / totalPoints) * 100 : 0,
  };
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

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface Gap {
  start: string;
  end: string;
  nights: number;
}

// Every night of a trip should be covered by some hotel. This finds the
// stretches that aren't, so they can be filled in rather than left silent.
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
