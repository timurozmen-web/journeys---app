// Ported directly from the old app's CARDS_STATIC. These are fixed product
// facts (real earning rates, real milestone thresholds), not user data.
export interface Milestone {
  id: string;
  type: 'spend' | 'tick';
  spendRequired?: number;
  rewardPoints: number;
  windowMonths?: number;
  supersedes?: string;
  rewardLabel: string;
  isVoucher?: boolean; // a discrete certificate/choice reward to track and redeem, not just an automatic points credit
}
export interface CardDef {
  id: string;
  programmeBrand: string;
  annualFee: number;
  feeLabel: string;
  rateFor: (ctx: { ownBrand: boolean; isUK: boolean; isUKEurope: boolean; isPremiumCountry: boolean; date: string }) => number;
  eliteNights: { auto: number; perSpendAmount: number | null; perSpendCap: number | null };
  milestones: Milestone[];
  perks: { id: string; label: string }[];
}

const IHG_PROMO_END = '2026-10-31';
const IHG_PREMIUM_COUNTRIES = new Set(['Canada', 'Japan', 'Singapore', 'Thailand', 'United Arab Emirates', 'United States']);
export const EUROPE_COUNTRIES = new Set([
  'United Kingdom', 'Ireland', 'France', 'Germany', 'Spain', 'Italy', 'Portugal', 'Netherlands', 'Belgium',
  'Switzerland', 'Austria', 'Greece', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic',
  'Hungary', 'Croatia', 'Albania', 'Lithuania', 'Latvia', 'Estonia', 'Romania', 'Bulgaria', 'Slovakia',
  'Slovenia', 'Iceland', 'Luxembourg', 'Malta', 'Cyprus', 'Turkey',
]);
export function isEuropeOrUK(country: string) {
  return country === 'United Kingdom' || EUROPE_COUNTRIES.has(country);
}
export function isIHGPremiumCountry(country: string) {
  return IHG_PREMIUM_COUNTRIES.has(country);
}

export const CARDS_STATIC: CardDef[] = [
  {
    id: 'Marriott Debit', programmeBrand: 'Marriott Bonvoy', annualFee: 165, feeLabel: '£165/yr',
    rateFor: (ctx) => (ctx.ownBrand ? (ctx.isUK ? 4 : 6) : ctx.isUK ? 1 : 3),
    eliteNights: { auto: 15, perSpendAmount: 4000, perSpendCap: 5 },
    milestones: [
      { id: 'welcome30k', type: 'spend', spendRequired: 3000, rewardPoints: 30000, windowMonths: 3, rewardLabel: '30,000pt welcome bonus (£3k spend within 3mo)' },
      { id: 'renew25k', type: 'spend', spendRequired: 4500, rewardPoints: 25000, rewardLabel: '25,000pt renewal voucher (£4.5k–£9k spend)', isVoucher: true },
      { id: 'renew50k', type: 'spend', spendRequired: 9000, rewardPoints: 50000, supersedes: 'renew25k', rewardLabel: '50,000pt renewal voucher (£9k+ spend)', isVoucher: true },
    ],
    perks: [{ id: 'status', label: 'Marriott Gold status' }, { id: 'fx', label: '0.99% FX fee (vs ~2.99% typical)' }],
  },
  {
    id: 'Marriott Amex', programmeBrand: 'Marriott Bonvoy', annualFee: 95, feeLabel: '£95/yr',
    rateFor: (ctx) => (ctx.ownBrand ? 6 : 2),
    eliteNights: { auto: 15, perSpendAmount: null, perSpendCap: null },
    milestones: [],
    perks: [{ id: 'status', label: 'Marriott Silver status' }],
  },
  {
    id: 'Accor Explorer', programmeBrand: 'Accor ALL', annualFee: 0, feeLabel: 'Free',
    rateFor: () => 1,
    eliteNights: { auto: 30, perSpendAmount: null, perSpendCap: null },
    milestones: [],
    perks: [],
  },
  {
    id: 'Hilton Debit', programmeBrand: 'Hilton Honors', annualFee: 150, feeLabel: '£150/yr',
    rateFor: (ctx) => (ctx.ownBrand ? (ctx.isUK ? 3 : 4.5) : ctx.isUK ? 1.5 : 3),
    eliteNights: { auto: 0, perSpendAmount: null, perSpendCap: null },
    milestones: [{ id: 'welcome30k', type: 'spend', spendRequired: 2500, rewardPoints: 30000, windowMonths: 6, rewardLabel: '30,000pt welcome bonus (£2.5k foreign-currency spend, first 6mo)' }],
    perks: [{ id: 'status', label: 'Hilton Gold status' }, { id: 'fx', label: '0.5% FX fee' }],
  },
  {
    id: 'IHG Revolut Elite', programmeBrand: 'IHG One Rewards', annualFee: 216, feeLabel: '£18/mo (£216/yr)',
    rateFor: (ctx) => {
      const promo = ctx.date <= IHG_PROMO_END;
      if (ctx.ownBrand) {
        if (ctx.isPremiumCountry) return promo ? 9 : 6;
        if (ctx.isUKEurope) return promo ? 4 : 3;
        return promo ? 6 : 4.5;
      }
      return ctx.isUKEurope ? 1.5 : 3;
    },
    eliteNights: { auto: 15, perSpendAmount: 4000, perSpendCap: null },
    milestones: [
      { id: 'welcome30k', type: 'spend', spendRequired: 3000, rewardPoints: 30000, windowMonths: 3, rewardLabel: '30,000pt welcome bonus (£3k spend within 3mo)' },
      { id: 'choice1', type: 'spend', spendRequired: 10000, rewardPoints: 5000, rewardLabel: 'Cardmember Choice Reward (5k pts / 2×£15 F&B / Suite Upgrade)', isVoucher: true },
      { id: 'flexnight', type: 'spend', spendRequired: 15000, rewardPoints: 40000, rewardLabel: 'Flex Night Certificate (worth up to 40k pts)', isVoucher: true },
      { id: 'choice2', type: 'spend', spendRequired: 25000, rewardPoints: 5000, rewardLabel: 'Cardmember Choice Reward #2', isVoucher: true },
      { id: 'diamond', type: 'spend', spendRequired: 35000, rewardPoints: 0, rewardLabel: 'Diamond Elite status upgrade (rest of this yr + all next yr)' },
    ],
    perks: [{ id: 'status', label: 'IHG Platinum status' }, { id: 'promo', label: 'Enhanced IHG earn rates until 31 Oct 2026' }],
  },
  {
    id: 'Virgin Atlantic Mastercard+', programmeBrand: 'Virgin Points', annualFee: 160, feeLabel: '£160/yr',
    rateFor: (ctx) => (ctx.ownBrand ? 3 : 1.5),
    eliteNights: { auto: 0, perSpendAmount: null, perSpendCap: null },
    milestones: [
      { id: 'welcome30k', type: 'tick', rewardPoints: 30000, rewardLabel: '30,000pt welcome bonus (on approval)' },
      { id: 'bonus75k', type: 'spend', spendRequired: 10000, rewardPoints: 75000, rewardLabel: '75,000pt bonus voucher (£10k spend in 12mo)', isVoucher: true },
    ],
    perks: [],
  },
];

export function defaultCardFor(brand: string): string | null {
  if (brand === 'Hilton Honors') return 'Hilton Debit';
  if (brand === 'IHG One Rewards') return 'IHG Revolut Elite';
  if (brand === 'Marriott Bonvoy') return 'Marriott Amex';
  return null;
}

// The 12-month window since the card's last anniversary -- spend outside
// this window shouldn't count toward the current year's milestones.
export function cardYearWindow(openDate: string | null, today: string) {
  if (!openDate) return null;
  const [oy, om, od] = openDate.split('-').map(Number);
  const t = new Date(today);
  let yr = t.getFullYear();
  const anniv = new Date(yr, om - 1, od);
  if (anniv > t) yr -= 1;
  let start = new Date(yr, om - 1, od);
  let end = new Date(yr + 1, om - 1, od);
  const opened = new Date(oy, om - 1, od);
  if (start < opened) {
    start = opened;
    end = new Date(oy + 1, om - 1, od);
  }
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: ymd(start), end: ymd(end) };
}
