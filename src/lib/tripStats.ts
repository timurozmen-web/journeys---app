import { CARDS_STATIC, defaultCardFor, isEuropeOrUK, isIHGPremiumCountry } from '../data/cardDefs';
import type { Trip, Hotel, LoyaltyProgramme } from '../types';

export interface TripPointsResult {
  totalPoints: number;
  totalValue: number; // £
  centsPerPoint: number; // pence per point, blended
}

export function computeTripPoints(trip: Trip, loyaltyProgrammes: LoyaltyProgramme[]): TripPointsResult {
  const ptValueByBrand = new Map(loyaltyProgrammes.map((p) => [p.name, p.ptValue]));
  let totalPoints = 0;
  let totalValue = 0;

  for (const h of trip.hotels) {
    if (!h.total) continue;
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
