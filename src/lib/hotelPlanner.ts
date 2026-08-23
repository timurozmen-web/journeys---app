import type { Hotel, LoyaltyProgramme } from '../types';

// Real base earning rates per programme, per £1 spent on qualifying stays.
// These are the published base rates -- the elite bonus is applied on top
// separately, based on the user's actual current tier.
export const BASE_POINTS_PER_GBP: Record<string, number> = {
  'Marriott Bonvoy': 12.7, // 10 pts per USD, converted at ~1.27
  'Hilton Honors': 12.7, // 10 pts per USD
  'IHG One Rewards': 12.7, // 10 pts per USD
  'World of Hyatt': 6.35, // 5 pts per USD
  'Accor ALL': 2.93, // 25 pts per EUR10 = 2.5/EUR, converted at ~1.17
};

// Real elite earning bonuses by programme and tier, as a multiplier on the
// base rate. Only tiers the user actually holds need to be accurate here.
export const TIER_BONUS: Record<string, Record<string, number>> = {
  'Marriott Bonvoy': { Silver: 1.1, Gold: 1.25, Platinum: 1.5, 'Titanium Elite': 1.75, Titanium: 1.75, Ambassador: 1.75 },
  'Hilton Honors': { Silver: 1.2, Gold: 1.8, Diamond: 2.0 },
  'IHG One Rewards': { Silver: 1.2, Gold: 1.4, Platinum: 1.6, Diamond: 2.0 },
  'World of Hyatt': { Discoverist: 1.1, Explorist: 1.2, Globalist: 1.3 },
  'Accor ALL': { Silver: 1.25, Gold: 1.5, Platinum: 1.75, Diamond: 2.0 },
};

// Genuinely useful, widely-applicable benefits by tier. Deliberately
// conservative -- only benefits that are broadly reliable, not
// property-dependent extras.
const TIER_BENEFITS: Record<string, Record<string, string[]>> = {
  'Marriott Bonvoy': {
    Gold: ['Room upgrade (subject to availability)', 'Late checkout to 2pm'],
    Platinum: ['Lounge access', 'Free breakfast', 'Suite upgrade (subject to availability)', 'Late checkout to 4pm'],
    'Titanium Elite': ['Lounge access', 'Free breakfast', 'Suite upgrade (subject to availability)', 'Late checkout to 4pm'],
    Titanium: ['Lounge access', 'Free breakfast', 'Suite upgrade (subject to availability)', 'Late checkout to 4pm'],
    Ambassador: ['Ambassador service', 'Your24 check-in', 'Lounge access', 'Free breakfast'],
  },
  'Hilton Honors': {
    Silver: ['Fifth night free on award stays'],
    Gold: ['Free breakfast', 'Room upgrade (subject to availability)'],
    Diamond: ['Executive lounge access', 'Free breakfast', 'Space-available upgrades'],
  },
  'IHG One Rewards': {
    Silver: ['Priority check-in'],
    Gold: ['Room upgrade (subject to availability)'],
    Platinum: ['Free breakfast at some brands', 'Room upgrade', 'Guaranteed late checkout'],
    Diamond: ['Free breakfast', 'Suite upgrade (subject to availability)', 'Welcome amenity'],
  },
  'World of Hyatt': {
    Discoverist: ['Late checkout to 2pm', 'Preferred room'],
    Explorist: ['Club lounge access (select)', 'Room upgrade'],
    Globalist: ['Free breakfast', 'Club lounge access', 'Suite upgrades', '4pm checkout'],
  },
  'Accor ALL': {
    Silver: ['Welcome drink', 'Priority check-in'],
    Gold: ['Room upgrade (subject to availability)', 'Welcome amenity', 'Early check-in or late checkout'],
    Platinum: ['Executive lounge access', 'Suite Night Upgrades', 'Breakfast in Asia-Pacific'],
    Diamond: ['Weekend breakfast worldwide', 'Fairmont Gold lounge access', 'Dining & Spa rewards'],
  },
};

export interface WalletValueChange {
  deltaValue: number; // can be negative if redemptions outweighed new points
  hasData: boolean; // false if there's genuinely nothing to compare (no recent activity at all)
}

/**
 * Real, dated value movement over the last 30 days: points earned from
 * completed stays in that window (valued at each programme's real rate),
 * minus the value of any vouchers actually redeemed in that window.
 * Deliberately excludes manual card spend adjustments, since those are an
 * undated running total, not attributable to a specific month -- faking
 * that would be dishonest rather than just incomplete.
 */
export function computeWalletValueChange(
  hotels: Hotel[],
  programmes: LoyaltyProgramme[],
  vouchers: { value: number | null; redeemed: boolean; redeemedDate: string | null }[],
  today: string
): WalletValueChange {
  const windowStart = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().slice(0, 10);
  let pointsValueEarned = 0;
  let sawActivity = false;

  for (const h of hotels) {
    if (h.status !== 'Completed' || h.award || !h.total) continue;
    if (h.date < windowStart || h.date > today) continue;
    if (BASE_POINTS_PER_GBP[h.brand] == null) continue;
    sawActivity = true;
    const programme = programmes.find((p) => p.name === h.brand);
    const tier = programme?.tier ?? null;
    const bonus = (tier && TIER_BONUS[h.brand]?.[tier]) || 1;
    const pointsEarned = h.total * BASE_POINTS_PER_GBP[h.brand] * bonus;
    if (programme?.ptValue) pointsValueEarned += (pointsEarned * programme.ptValue) / 100;
  }

  let redeemedValue = 0;
  for (const v of vouchers) {
    if (!v.redeemed || !v.redeemedDate || !v.value) continue;
    if (v.redeemedDate < windowStart || v.redeemedDate > today) continue;
    sawActivity = true;
    redeemedValue += v.value;
  }

  return { deltaValue: pointsValueEarned - redeemedValue, hasData: sawActivity };
}

export interface HotelPlanOption {
  programme: string;
  tier: string | null;
  estimatedNightlyGBP: number;
  rateSource: 'history' | 'fallback'; // whether the rate comes from the user's own real stays
  historyCount: number;
  pointsEarned: number;
  pointsValueGBP: number;
  benefits: string[];
  effectiveNightlyGBP: number; // nightly rate less the value of points earned
}

const FALLBACK_NIGHTLY_GBP = 180;

/**
 * Builds a per-programme comparison for a planned stay. Nightly rates come
 * from the user's own real stay history for that brand where any exists --
 * that's far more meaningful than a generic average, since it reflects the
 * kind of properties they actually book.
 */
export function planHotelOptions(
  programmes: LoyaltyProgramme[],
  hotels: Hotel[],
  nights: number
): HotelPlanOption[] {
  return programmes
    .filter((p) => p.category === 'hotel' && BASE_POINTS_PER_GBP[p.name] != null)
    .map((p) => {
      const brandStays = hotels.filter(
        (h) => h.brand === p.name && h.status === 'Completed' && h.nightlyRate != null && h.nightlyRate > 0
      );
      const estimatedNightlyGBP =
        brandStays.length > 0
          ? brandStays.reduce((s, h) => s + (h.nightlyRate ?? 0), 0) / brandStays.length
          : FALLBACK_NIGHTLY_GBP;

      const tier = p.tier ?? null;
      const bonus = (tier && TIER_BONUS[p.name]?.[tier]) || 1;
      const pointsEarned = estimatedNightlyGBP * nights * BASE_POINTS_PER_GBP[p.name] * bonus;
      const pointsValueGBP = (pointsEarned * p.ptValue) / 100;

      return {
        programme: p.name,
        tier,
        estimatedNightlyGBP,
        rateSource: brandStays.length > 0 ? ('history' as const) : ('fallback' as const),
        historyCount: brandStays.length,
        pointsEarned,
        pointsValueGBP,
        benefits: (tier && TIER_BENEFITS[p.name]?.[tier]) || [],
        effectiveNightlyGBP: estimatedNightlyGBP - pointsValueGBP / nights,
      };
    })
    .sort((a, b) => a.effectiveNightlyGBP - b.effectiveNightlyGBP);
}
