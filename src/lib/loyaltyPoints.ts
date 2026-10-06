import type { Hotel, LoyaltyProgramme, Promotion } from '../types';

// The one place hotel-programme earning lives: base points per stay by
// programme and brand, plus the member's elite bonus. Trip totals, wallet
// insights, the planner and live balances all read from here.
//
// Approximate FX rates -- not live, a reasonable current approximation,
// since these programmes earn per USD or EUR, not GBP.
const GBP_TO_USD = 1.27;
const GBP_TO_EUR = 1.17;

interface BaseProgramDef {
  brand: string;
  currency: 'USD' | 'EUR';
  baseRatePerUnit: number; // points per $1 or €1
  // Brands within the programme that earn a lower base rate (published).
  reducedBrands?: { pattern: RegExp; ratePerUnit: number };
}

// Published base rates: Marriott 10/USD (5 at Residence Inn, TownePlace
// Suites, Element and Apartments by Marriott); Hilton 10/USD (5 at Tru and
// Home2 Suites); IHG 10/USD (5 at Staybridge and Candlewood Suites); Hyatt
// 5/USD; Accor 25 per €10 (12.5 per €10 at ibis, ibis Styles, ibis budget and
// greet -- checked against Accor's earn page, 6 Oct 2026).
export const BASE_PROGRAMS: BaseProgramDef[] = [
  { brand: 'Marriott Bonvoy', currency: 'USD', baseRatePerUnit: 10, reducedBrands: { pattern: /residence inn|towneplace|\belement\b|apartments by marriott/i, ratePerUnit: 5 } },
  { brand: 'Hilton Honors', currency: 'USD', baseRatePerUnit: 10, reducedBrands: { pattern: /\btru by hilton\b|\btru\b|home2/i, ratePerUnit: 5 } },
  { brand: 'IHG One Rewards', currency: 'USD', baseRatePerUnit: 10, reducedBrands: { pattern: /staybridge|candlewood/i, ratePerUnit: 5 } },
  { brand: 'World of Hyatt', currency: 'USD', baseRatePerUnit: 5 },
  { brand: 'Accor ALL', currency: 'EUR', baseRatePerUnit: 2.5, reducedBrands: { pattern: /\bibis\b|\bgreet\b/i, ratePerUnit: 1.25 } },
];

// Elite bonus on base points, by programme and tier (published rates).
export const TIER_BONUS: Record<string, Record<string, number>> = {
  'Marriott Bonvoy': { Silver: 1.1, Gold: 1.25, Platinum: 1.5, 'Titanium Elite': 1.75, Titanium: 1.75, Ambassador: 1.75 },
  'Hilton Honors': { Silver: 1.2, Gold: 1.8, Diamond: 2.0 },
  'IHG One Rewards': { Silver: 1.2, Gold: 1.4, Platinum: 1.6, Diamond: 2.0 },
  'World of Hyatt': { Discoverist: 1.1, Explorist: 1.2, Globalist: 1.3 },
  'Accor ALL': { Silver: 1.25, Gold: 1.5, Platinum: 1.75, Diamond: 2.0 },
};

// Marriott's tier changed over the stay history, as given by the member:
// Gold until W Santiago (2025-12-05), Platinum until Marriott Marble Arch
// London (2026-07-22), Titanium from then. Other programmes use the tier held now.
function marriottTierMultiplier(date: string): number {
  if (date < '2025-12-05') return 1.25;
  if (date < '2026-07-22') return 1.5;
  return 1.75;
}

function tierMultiplier(brand: string, tier: string | null | undefined, date: string): number {
  if (brand === 'Marriott Bonvoy') return marriottTierMultiplier(date);
  if (!tier) return 1;
  const table = TIER_BONUS[brand] ?? {};
  const key = Object.keys(table).sort((a, b) => b.length - a.length).find((k) => tier.toLowerCase().includes(k.toLowerCase()));
  return key ? table[key] : 1;
}

// Base points per £1 for a programme's standard brands (for estimates
// before a stay exists, e.g. the planner).
export function basePointsPerGBP(brand: string): number | null {
  const def = BASE_PROGRAMS.find((d) => d.brand === brand);
  if (!def) return null;
  return def.baseRatePerUnit * (def.currency === 'USD' ? GBP_TO_USD : GBP_TO_EUR);
}

function activeMultiplierFor(h: Hotel, promotions: Promotion[]): number {
  const match = promotions.find(
    (p) =>
      p.promoType === 'multiplier' &&
      p.multiplier != null &&
      (!p.brand || p.brand === h.brand) &&
      (!p.startDate || h.date >= p.startDate) &&
      (!p.endDate || h.date <= p.endDate)
  );
  return match?.multiplier ?? 1;
}

// Points a stay earns with its hotel programme, whatever its status (callers
// decide whether it counts yet). Award stays and stays with no price earn none.
export function stayPoints(h: Hotel, programmes: Pick<LoyaltyProgramme, 'name' | 'tier'>[] = [], promotions: Promotion[] = []): number {
  const def = BASE_PROGRAMS.find((d) => d.brand === h.brand);
  if (!def || !h.total || h.award) return 0;
  const fx = def.currency === 'USD' ? GBP_TO_USD : GBP_TO_EUR;
  const rate = def.reducedBrands?.pattern.test(h.name) ? def.reducedBrands.ratePerUnit : def.baseRatePerUnit;
  const tier = programmes.find((p) => p.name === h.brand)?.tier;
  return Math.round(h.total * fx * rate * tierMultiplier(h.brand, tier, h.date) * activeMultiplierFor(h, promotions));
}

// Completed stays only -- what trip totals count as earned.
export function basePointsForHotel(h: Hotel, promotions: Promotion[] = [], programmes: Pick<LoyaltyProgramme, 'name' | 'tier'>[] = []): number {
  return h.status === 'Completed' ? stayPoints(h, programmes, promotions) : 0;
}

export function computeBaseProgramPoints(hotels: Hotel[], brand: string, promotions: Promotion[] = [], programmes: Pick<LoyaltyProgramme, 'name' | 'tier'>[] = []): number {
  return hotels.filter((h) => h.brand === brand).reduce((s, h) => s + basePointsForHotel(h, promotions, programmes), 0);
}

// Points from stays not yet reflected in a programme's stored balance: the
// balance was last recorded on its baseline date, so completed stays after
// it are added (earned), and upcoming stays are shown as pending.
export function pointsFromStays(p: LoyaltyProgramme, hotels: Hotel[], promotions: Promotion[] = []): { earned: number; pending: number } {
  let earned = 0;
  let pending = 0;
  for (const h of hotels) {
    if (h.brand !== p.name) continue;
    const pts = stayPoints(h, [p], promotions);
    if (!pts) continue;
    if (h.status === 'Completed') {
      if (p.nightsBaselineDate && h.date > p.nightsBaselineDate) earned += pts;
    } else if (h.status === 'Booked') {
      pending += pts;
    }
  }
  return { earned, pending };
}
