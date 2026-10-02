// How card spend turns into points. Spend is split into each card's own
// earning categories (they differ card to card: "Marriott stays abroad",
// "Everyday in the UK"...) and added up -- never listed transaction by
// transaction. Rates are always read from the card's `rateFor`, so there is
// one place they live.
import { isEuropeOrUK, isIHGPremiumCountry, regionCtx, REGIONS } from '../data/cardDefs';
import type { CardDef, EarnCategory, Region } from '../data/cardDefs';
import { matchProgrammeStrict } from '../data/brandMap';
import { convertCurrency } from './currency';
import type { CurrencyCode } from './currency';

// ---------------------------------------------------------------- where

export function regionOfCountry(country: string): Region {
  const c = country.trim();
  if (c === 'United Kingdom') return 'uk';
  if (isIHGPremiumCountry(c)) return 'premium';
  if (isEuropeOrUK(c)) return 'europe';
  return 'elsewhere';
}

// A bank statement says what currency a purchase was in, not where. These
// are the currencies that map cleanly onto the regions the cards care
// about (USD is used beyond the US, but for a UK traveller it's far more
// often than not the US, so it counts as "premium"; it only matters for IHG).
const CURRENCY_REGION: Record<string, Region> = {
  GBP: 'uk',
  EUR: 'europe', CHF: 'europe', SEK: 'europe', NOK: 'europe', DKK: 'europe', PLN: 'europe', CZK: 'europe',
  HUF: 'europe', RON: 'europe', BGN: 'europe', ISK: 'europe', TRY: 'europe', ALL: 'europe',
  USD: 'premium', CAD: 'premium', JPY: 'premium', SGD: 'premium', THB: 'premium', AED: 'premium',
};

export function regionOfCurrency(currency: string): Region {
  return CURRENCY_REGION[currency.trim().toUpperCase()] ?? 'elsewhere';
}

// ---------------------------------------------------------------- items

export type SpendSource = 'bank' | 'hotel' | 'flight' | 'manual';

// One piece of spend, however we learned about it. How sure we are of its
// region: 'logged' (you entered the country), 'currency' (a foreign
// currency on the statement), 'assumed' (billed in £, so it could have been
// abroad -- counted at the UK rate).
export interface SpendItem {
  date: string | null; // null: undated manual spend
  amount: number;      // pounds; refunds negative
  own: boolean;
  region: Region;
  source: SpendSource;
  basis: 'logged' | 'currency' | 'assumed';
}

export function isOwnBrandMerchant(card: CardDef, merchant: string): boolean {
  const text = merchant.toLowerCase();
  if (card.ownBrandKeywords?.some((k) => text.includes(k))) return true;
  return matchProgrammeStrict(merchant) === card.programmeBrand;
}

export interface BankSpendRow { date: string; amount: number; currency: string; merchant: string | null }

// Turns stored card purchases into spend items. `amount` is in the
// account's currency; anything not in pounds is converted (rates are
// passed in so this stays pure and testable).
export function bankRowsToItems(
  card: CardDef,
  rows: BankSpendRow[],
  rates: Record<string, number> = {},
): SpendItem[] {
  return rows.map((r) => {
    const cur = r.currency.trim().toUpperCase();
    const pounds = cur === 'GBP' ? r.amount : convertCurrency(r.amount, cur as CurrencyCode, 'GBP', rates);
    return {
      date: r.date,
      amount: pounds,
      own: r.merchant ? isOwnBrandMerchant(card, r.merchant) : false,
      region: regionOfCurrency(cur),
      source: 'bank',
      basis: cur === 'GBP' ? 'assumed' : 'currency',
    };
  });
}

// ----------------------------------------------------------- categories

export function categoryFor(card: CardDef, own: boolean, region: Region): EarnCategory {
  const hit = card.earnCategories.find((c) => (c.own === undefined || c.own === own) && c.regions.includes(region));
  // A card's categories cover every combination (see the test), so this
  // fallback only guards against a definition being edited carelessly.
  return hit ?? card.earnCategories[card.earnCategories.length - 1];
}

export function rateOf(card: CardDef, own: boolean, region: Region, date: string): number {
  return card.rateFor({ ownBrand: own, ...regionCtx(region), date });
}

// A category's points per pound on a given date.
export function categoryRate(card: CardDef, category: EarnCategory, date: string): number {
  return rateOf(card, category.own ?? false, category.regions[0], date);
}

// Does this card pay a different rate abroad than at home? If not, "£
// spend abroad can't be told from UK spend" doesn't matter for it.
export function cardDistinguishesAbroad(card: CardDef, date: string): boolean {
  return [true, false].some((own) => REGIONS.some((r) => rateOf(card, own, r, date) !== rateOf(card, own, 'uk', date)));
}

// ------------------------------------------------------------ summarise

export interface CategorySpend {
  category: EarnCategory;
  spend: number;
  points: number;
  rate: number; // points per £ today
}
export interface SpendSummary {
  categories: CategorySpend[];
  totalSpend: number;
  totalPoints: number;
  assumedShare: number; // 0-1: share of spend billed in £ that may have been abroad
}

export function summariseSpend(
  card: CardDef,
  items: SpendItem[],
  window: { start: string; end: string } | null,
  today: string,
): SpendSummary {
  const byId = new Map<string, CategorySpend>(
    card.earnCategories.map((c) => [c.id, { category: c, spend: 0, points: 0, rate: categoryRate(card, c, today) }]),
  );
  let total = 0;
  let assumed = 0;
  for (const it of items) {
    // Undated spend (a manual figure) can't be placed in a window, so it
    // is always included, as before.
    if (it.date && window && (it.date < window.start || it.date >= window.end)) continue;
    const cat = byId.get(categoryFor(card, it.own, it.region).id)!;
    cat.spend += it.amount;
    cat.points += it.amount * rateOf(card, it.own, it.region, it.date ?? today);
    total += it.amount;
    if (it.basis === 'assumed') assumed += it.amount;
  }
  const categories = [...byId.values()].map((c) => ({ ...c, spend: round2(c.spend), points: Math.round(c.points) }));
  return {
    categories,
    totalSpend: round2(total),
    totalPoints: Math.round(categories.reduce((s, c) => s + c.points, 0)),
    assumedShare: total > 0 ? assumed / total : 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
