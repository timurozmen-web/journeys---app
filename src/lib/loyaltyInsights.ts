import type { Hotel, LoyaltyProgramme } from '../types';
import { BASE_POINTS_PER_GBP, TIER_BONUS } from './hotelPlanner';

export interface BrandInsight {
  brand: string;
  totalSpend: number;
  nights: number;
  rateSavings: number; // vs the standard/average rate paid elsewhere -- NOT a loyalty benefit, this is just rate-shopping/timing, shown separately rather than folded into loyalty value
  benefitsByType: { breakfast: number; upgrade: number; lounge: number; lateCheckout: number; other: number };
  totalBenefitsValue: number;
  pointsEarned: number;
  pointsValue: number; // points earned this year, valued at the programme's real £/point rate
  loyaltyValue: number; // benefits + points value -- genuinely attributable to loyalty membership, excludes rate savings
  roiPercent: number | null; // loyaltyValue / totalSpend * 100 -- null if no spend to divide by
}

const BENEFIT_TYPE_LABELS: Record<string, keyof BrandInsight['benefitsByType']> = {
  breakfast: 'breakfast', upgrade: 'upgrade', lounge: 'lounge', 'late-checkout': 'lateCheckout', other: 'other',
};

/**
 * Real per-brand loyalty value breakdown for a given year -- built from
 * genuinely logged stay data (spend, savings vs standard rate, benefit
 * values by real category, and points value estimated from each
 * programme's actual published earning rate and the member's real current
 * tier), not estimates invented for display purposes.
 */
export function computeLoyaltyInsights(
  hotels: Hotel[],
  programmes: LoyaltyProgramme[],
  year: number
): { byBrand: BrandInsight[]; overall: Omit<BrandInsight, 'brand'> } {
  const byBrandMap = new Map<string, BrandInsight>();

  const yearHotels = hotels.filter((h) => h.status === 'Completed' && Number(h.date.slice(0, 4)) === year);

  for (const h of yearHotels) {
    const brand = h.brand || 'Other';
    if (!byBrandMap.has(brand)) {
      byBrandMap.set(brand, {
        brand, totalSpend: 0, nights: 0, rateSavings: 0,
        benefitsByType: { breakfast: 0, upgrade: 0, lounge: 0, lateCheckout: 0, other: 0 },
        totalBenefitsValue: 0, pointsEarned: 0, pointsValue: 0, loyaltyValue: 0, roiPercent: null,
      });
    }
    const b = byBrandMap.get(brand)!;

    if (h.total) b.totalSpend += h.total;
    b.nights += h.nights;
    if (h.avgRate != null && h.nightlyRate != null) b.rateSavings += (h.avgRate - h.nightlyRate) * h.nights;
    if (h.benefitValue) {
      b.totalBenefitsValue += h.benefitValue;
      const key = h.benefitType ? BENEFIT_TYPE_LABELS[h.benefitType] : undefined;
      if (key) b.benefitsByType[key] += h.benefitValue;
      else b.benefitsByType.other += h.benefitValue;
    }

    // Points value: real base rate for the brand times the member's
    // actual current tier bonus, same rates already used in Plan's hotel
    // comparison -- not a separate, invented estimate. Award stays earn
    // no points, matching how they earn no elite night credit either.
    if (!h.award && h.total && BASE_POINTS_PER_GBP[brand] != null) {
      const programme = programmes.find((p) => p.name === brand);
      const tier = programme?.tier ?? null;
      const bonus = (tier && TIER_BONUS[brand]?.[tier]) || 1;
      const pointsEarned = h.total * BASE_POINTS_PER_GBP[brand] * bonus;
      b.pointsEarned += pointsEarned;
      if (programme?.ptValue) b.pointsValue += (pointsEarned * programme.ptValue) / 100;
    }
  }

  const byBrand = [...byBrandMap.values()]
    // Only brands genuinely in the user's loyalty wallet -- a hotel's
    // "brand" field can be a booking channel or something else entirely
    // (e.g. "Expedia"), not necessarily a real loyalty programme, so this
    // list shouldn't include anything the wallet doesn't actually track.
    .filter((b) => programmes.some((p) => p.name === b.brand) && b.brand !== 'Expedia')
    .map((b) => {
      b.loyaltyValue = b.totalBenefitsValue + b.pointsValue;
      b.roiPercent = b.totalSpend > 0 ? (b.loyaltyValue / b.totalSpend) * 100 : null;
      return b;
    })
    // Hide a programme entirely rather than show an empty £0 row when
    // there's genuinely nothing to report for the year.
    .filter((b) => b.loyaltyValue > 0 || b.rateSavings > 0);
  byBrand.sort((a, b) => b.loyaltyValue - a.loyaltyValue);

  const overall: Omit<BrandInsight, 'brand'> = {
    totalSpend: byBrand.reduce((s, b) => s + b.totalSpend, 0),
    nights: byBrand.reduce((s, b) => s + b.nights, 0),
    rateSavings: byBrand.reduce((s, b) => s + b.rateSavings, 0),
    benefitsByType: {
      breakfast: byBrand.reduce((s, b) => s + b.benefitsByType.breakfast, 0),
      upgrade: byBrand.reduce((s, b) => s + b.benefitsByType.upgrade, 0),
      lounge: byBrand.reduce((s, b) => s + b.benefitsByType.lounge, 0),
      lateCheckout: byBrand.reduce((s, b) => s + b.benefitsByType.lateCheckout, 0),
      other: byBrand.reduce((s, b) => s + b.benefitsByType.other, 0),
    },
    totalBenefitsValue: byBrand.reduce((s, b) => s + b.totalBenefitsValue, 0),
    pointsEarned: byBrand.reduce((s, b) => s + b.pointsEarned, 0),
    pointsValue: byBrand.reduce((s, b) => s + b.pointsValue, 0),
    loyaltyValue: byBrand.reduce((s, b) => s + b.loyaltyValue, 0),
    roiPercent: null,
  };
  overall.roiPercent = overall.totalSpend > 0 ? (overall.loyaltyValue / overall.totalSpend) * 100 : null;

  return { byBrand, overall };
}
