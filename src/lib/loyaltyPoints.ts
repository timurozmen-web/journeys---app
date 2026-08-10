import type { Hotel } from '../types';

// Approximate FX rates -- not live, just a reasonable current approximation
// since these programs are priced in USD/EUR, not GBP.
const GBP_TO_USD = 1.27;
const GBP_TO_EUR = 1.17;

export interface BaseProgramDef {
  brand: string;
  currency: 'USD' | 'EUR';
  baseRatePerUnit: number; // points per $1 or €1
  // Elite tier bonus, either a flat percentage (single current tier) or a
  // time-varying lookup for programs where tier changed over the period
  // covered by real stay history.
  tierBonusFor: (date: string) => number;
}

// Marriott's tier changed over real stay history, given explicitly:
// Gold until W Santiago (2025-12-05), Platinum from then until Marriott
// Marble Arch London (2026-07-22), Titanium from that stay onward.
const MARRIOTT_TIER_PCT = { Silver: 0.10, Gold: 0.25, Platinum: 0.50, Titanium: 0.75 };
function marriottTierBonus(date: string): number {
  if (date < '2025-12-05') return MARRIOTT_TIER_PCT.Gold;
  if (date < '2026-07-22') return MARRIOTT_TIER_PCT.Platinum;
  return MARRIOTT_TIER_PCT.Titanium;
}

export const BASE_PROGRAMS: BaseProgramDef[] = [
  {
    brand: 'Marriott Bonvoy',
    currency: 'USD',
    baseRatePerUnit: 10,
    tierBonusFor: marriottTierBonus,
  },
  {
    brand: 'Hilton Honors',
    currency: 'USD',
    baseRatePerUnit: 10,
    tierBonusFor: () => 0.80, // Gold, confirmed current tier -- +80% published rate
  },
  {
    brand: 'IHG One Rewards',
    currency: 'USD',
    baseRatePerUnit: 10,
    tierBonusFor: () => 0.60, // Platinum, confirmed current tier -- +60% published rate
  },
  {
    brand: 'Accor ALL',
    currency: 'EUR',
    baseRatePerUnit: 2.5, // 25 points per €10
    tierBonusFor: () => 0.50, // Gold, confirmed current tier -- +50% published rate
  },
];

export function computeBaseProgramPoints(hotels: Hotel[], brand: string): number {
  const def = BASE_PROGRAMS.find((d) => d.brand === brand);
  if (!def) return 0;
  const fx = def.currency === 'USD' ? GBP_TO_USD : GBP_TO_EUR;

  let total = 0;
  for (const h of hotels) {
    if (h.brand !== brand || !h.total || h.status !== 'Completed') continue;
    const spendInLocalCurrency = h.total * fx;
    const basePoints = spendInLocalCurrency * def.baseRatePerUnit;
    const bonusPct = def.tierBonusFor(h.date);
    total += basePoints * (1 + bonusPct);
  }
  return Math.round(total);
}
