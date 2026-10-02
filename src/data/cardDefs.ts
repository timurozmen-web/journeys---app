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
  // A welcome bonus that only exists as a limited-time offer. It applies
  // when the card was opened inside an offer's dates, using that offer's
  // spend and reward; opened outside every offer, there is no welcome
  // milestone, because the standard terms aren't a published figure we hold.
  offers?: WelcomeOffer[];
}
export interface WelcomeOffer {
  from: string; // first day (YYYY-MM-DD) an application qualifies
  to: string;   // last day it qualifies
  spendRequired: number;
  rewardPoints: number;
  windowMonths: number;
  label: string;
}
// Where a purchase happened, at the granularity any card's earn rate cares
// about. 'premium' is IHG's list of higher-earning countries; for every
// other card it's simply abroad.
export type Region = 'uk' | 'europe' | 'premium' | 'elsewhere';
export const REGIONS: Region[] = ['uk', 'europe', 'premium', 'elsewhere'];

export interface RateCtx { ownBrand: boolean; isUK: boolean; isUKEurope: boolean; isPremiumCountry: boolean; date: string }

// The earn-rate inputs for a region. Kept consistent (UK implies Europe).
export function regionCtx(region: Region): Omit<RateCtx, 'ownBrand' | 'date'> {
  return {
    isUK: region === 'uk',
    isUKEurope: region === 'uk' || region === 'europe',
    isPremiumCountry: region === 'premium',
  };
}

// One line of a card's earn table: "Marriott stays abroad: 6 points a pound".
// `own` null/undefined means both; `regions` lists every region that earns
// this same rate. The set of a card's categories must cover every
// own-brand/region combination exactly once (enforced by a test), and its
// rate is always read from `rateFor`, never repeated here.
export interface EarnCategory {
  id: string;
  label: string;
  own?: boolean;
  regions: Region[];
}

export interface CardDef {
  id: string;
  programmeBrand: string;
  annualFee: number;
  feeLabel: string;
  rateFor: (ctx: RateCtx) => number;
  earnCategories: EarnCategory[];
  // Merchant text that counts as this card's own brand when the programme
  // isn't a hotel group (e.g. an airline). Hotel groups use the brand map.
  ownBrandKeywords?: string[];
  // Whether a linked bank account/card, by its name, looks like this card.
  // Tried in catalogue order, so a more specific card goes before a general one.
  detect?: (text: string) => boolean;
  // A card added by hand (not in the catalogue): spend is tracked but its
  // earning rate isn't known, so no points are worked out for it.
  custom?: boolean;
  eliteNights: { auto: number; perSpendAmount: number | null; perSpendCap: number | null };
  milestones: Milestone[];
  perks: { id: string; label: string }[];
}

const ALL: Region[] = ['uk', 'europe', 'premium', 'elsewhere'];
const ABROAD: Region[] = ['europe', 'premium', 'elsewhere'];

const BA_KEYWORDS = ['british airways', 'ba.com', 'ba holidays'];
const BA_NAME = /british airways|\bba\b|avios/;

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
    detect: (t) => t.includes('marriott') && /debit|currensea/.test(t),
    rateFor: (ctx) => (ctx.ownBrand ? (ctx.isUK ? 4 : 6) : ctx.isUK ? 1 : 3),
    earnCategories: [
      { id: 'own-uk', label: 'Marriott stays in the UK', own: true, regions: ['uk'] },
      { id: 'own-abroad', label: 'Marriott stays abroad', own: true, regions: ABROAD },
      { id: 'other-uk', label: 'Everyday in the UK', own: false, regions: ['uk'] },
      { id: 'other-abroad', label: 'Everyday abroad', own: false, regions: ABROAD },
    ],
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
    detect: (t) => t.includes('marriott') && /amex|american express/.test(t),
    rateFor: (ctx) => (ctx.ownBrand ? 6 : 2),
    earnCategories: [
      { id: 'own', label: 'Marriott stays', own: true, regions: ALL },
      { id: 'other', label: 'Everything else', own: false, regions: ALL },
    ],
    eliteNights: { auto: 15, perSpendAmount: null, perSpendCap: null },
    milestones: [],
    perks: [{ id: 'status', label: 'Marriott Silver status' }],
  },
  {
    id: 'Accor Explorer', programmeBrand: 'Accor ALL', annualFee: 0, feeLabel: 'Free',
    detect: (t) => t.includes('accor'),
    rateFor: () => 1,
    earnCategories: [{ id: 'all', label: 'All spend', regions: ALL }],
    eliteNights: { auto: 30, perSpendAmount: null, perSpendCap: null },
    milestones: [],
    perks: [],
  },
  {
    id: 'Hilton Debit', programmeBrand: 'Hilton Honors', annualFee: 150, feeLabel: '£150/yr',
    detect: (t) => t.includes('hilton'),
    rateFor: (ctx) => (ctx.ownBrand ? (ctx.isUK ? 3 : 4.5) : ctx.isUK ? 1.5 : 3),
    earnCategories: [
      { id: 'own-uk', label: 'Hilton stays in the UK', own: true, regions: ['uk'] },
      { id: 'own-abroad', label: 'Hilton stays abroad', own: true, regions: ABROAD },
      { id: 'other-uk', label: 'Everyday in the UK', own: false, regions: ['uk'] },
      { id: 'other-abroad', label: 'Everyday abroad', own: false, regions: ABROAD },
    ],
    eliteNights: { auto: 0, perSpendAmount: null, perSpendCap: null },
    milestones: [{ id: 'welcome30k', type: 'spend', spendRequired: 2500, rewardPoints: 30000, windowMonths: 6, rewardLabel: '30,000pt welcome bonus (£2.5k foreign-currency spend, first 6mo)' }],
    perks: [{ id: 'status', label: 'Hilton Gold status' }, { id: 'fx', label: '0.5% FX fee' }],
  },
  {
    id: 'IHG Revolut Elite', programmeBrand: 'IHG One Rewards', annualFee: 216, feeLabel: '£18/mo (£216/yr)',
    detect: (t) => /\bihg\b/.test(t),
    rateFor: (ctx) => {
      const promo = ctx.date <= IHG_PROMO_END;
      if (ctx.ownBrand) {
        if (ctx.isPremiumCountry) return promo ? 9 : 6;
        if (ctx.isUKEurope) return promo ? 4 : 3;
        return promo ? 6 : 4.5;
      }
      return ctx.isUKEurope ? 1.5 : 3;
    },
    earnCategories: [
      { id: 'own-premium', label: 'IHG stays: US, Canada, Japan, Singapore, Thailand, UAE', own: true, regions: ['premium'] },
      { id: 'own-uk-europe', label: 'IHG stays in the UK and Europe', own: true, regions: ['uk', 'europe'] },
      { id: 'own-elsewhere', label: 'IHG stays elsewhere', own: true, regions: ['elsewhere'] },
      { id: 'other-uk-europe', label: 'Everyday in the UK and Europe', own: false, regions: ['uk', 'europe'] },
      { id: 'other-elsewhere', label: 'Everyday elsewhere', own: false, regions: ['premium', 'elsewhere'] },
    ],
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
    ownBrandKeywords: ['virgin atlantic'],
    detect: (t) => t.includes('virgin'),
    earnCategories: [
      { id: 'own', label: 'Virgin Atlantic', own: true, regions: ALL },
      { id: 'other', label: 'Everything else', own: false, regions: ALL },
    ],
    eliteNights: { auto: 0, perSpendAmount: null, perSpendCap: null },
    milestones: [
      { id: 'welcome30k', type: 'tick', rewardPoints: 30000, rewardLabel: '30,000pt welcome bonus (on approval)' },
      { id: 'bonus75k', type: 'spend', spendRequired: 10000, rewardPoints: 75000, rewardLabel: '75,000pt bonus voucher (£10k spend in 12mo)', isVoucher: true },
    ],
    perks: [],
  },
  // British Airways American Express cards. Figures as published by Amex and
  // British Airways and reported by Head for Points (Sept 2026), checked on
  // 2 Oct 2026: free card 1 Avios/£1, no fee; Premium Plus £300 fee,
  // 1.5 Avios/£1 (1.25 from 7 Oct 2026) and 3 Avios/£1 on BA and BA Holidays,
  // 2-4-1 voucher at £15,000 spend in a card year (valid 2 years, any cabin).
  // The post-7-Oct rate is only announced for general spend; the BA rate is
  // assumed unchanged because nothing announces otherwise.
  {
    id: 'BA Amex Premium Plus', programmeBrand: 'Avios', annualFee: 300, feeLabel: '£300/yr',
    rateFor: (ctx) => (ctx.ownBrand ? 3 : ctx.date >= BA_PREMIUM_PLUS_RATE_CHANGE ? 1.25 : 1.5),
    ownBrandKeywords: BA_KEYWORDS,
    detect: (t) => BA_NAME.test(t) && /premium plus/.test(t),
    earnCategories: [
      { id: 'own', label: 'British Airways and BA Holidays', own: true, regions: ALL },
      { id: 'other', label: 'Everything else', own: false, regions: ALL },
    ],
    eliteNights: { auto: 0, perSpendAmount: null, perSpendCap: null },
    milestones: [
      {
        id: 'welcome', type: 'spend', rewardPoints: 0, windowMonths: 3, rewardLabel: 'Welcome bonus',
        offers: [{ from: '2026-08-26', to: '2026-10-06', spendRequired: 6000, rewardPoints: 60000, windowMonths: 3, label: '60,000 Avios welcome bonus (£6k spend within 3mo)' }],
      },
      { id: 'companion', type: 'spend', spendRequired: 15000, rewardPoints: 0, rewardLabel: '2-4-1 companion voucher (£15k spend in a card year)' },
    ],
    perks: [],
  },
  {
    id: 'BA Amex', programmeBrand: 'Avios', annualFee: 0, feeLabel: 'Free',
    rateFor: () => 1,
    ownBrandKeywords: BA_KEYWORDS,
    detect: (t) => BA_NAME.test(t) && /amex|american express|credit card/.test(t),
    earnCategories: [
      { id: 'own', label: 'British Airways', own: true, regions: ALL },
      { id: 'other', label: 'Everything else', own: false, regions: ALL },
    ],
    eliteNights: { auto: 0, perSpendAmount: null, perSpendCap: null },
    milestones: [
      {
        id: 'welcome', type: 'spend', rewardPoints: 0, windowMonths: 3, rewardLabel: 'Welcome bonus',
        offers: [{ from: '2026-08-26', to: '2026-10-06', spendRequired: 2000, rewardPoints: 10000, windowMonths: 3, label: '10,000 Avios welcome bonus (£2k spend within 3mo)' }],
      },
      { id: 'companion', type: 'spend', spendRequired: 15000, rewardPoints: 0, rewardLabel: '2-4-1 companion voucher, economy only (£15k spend in a card year)' },
    ],
    perks: [],
  },
];

// The Premium Plus general earn rate falls from 1.5 to 1.25 Avios per £1 on
// this date (announced by Amex/BA).
const BA_PREMIUM_PLUS_RATE_CHANGE = '2026-10-07';

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

// The milestones that apply to a card opened on `openDate`: welcome offers
// resolve to the offer in force when the card was opened (or drop out).
export function milestonesFor(card: CardDef, openDate: string | null): Milestone[] {
  return card.milestones.flatMap((m) => {
    if (!m.offers) return [m];
    const offer = openDate ? m.offers.find((o) => openDate >= o.from && openDate <= o.to) : undefined;
    if (!offer) return [];
    return [{ ...m, spendRequired: offer.spendRequired, rewardPoints: offer.rewardPoints, windowMonths: offer.windowMonths, rewardLabel: offer.label, offers: undefined }];
  });
}

// A card that isn't in the catalogue, from the row the user added.
export function customCardDef(row: { id: string; programmeBrand: string; annualFee: number; feeLabel: string }): CardDef {
  return {
    id: row.id, programmeBrand: row.programmeBrand, annualFee: row.annualFee, feeLabel: row.feeLabel,
    custom: true,
    rateFor: () => 0,
    earnCategories: [{ id: 'all', label: 'All spend', regions: ALL }],
    eliteNights: { auto: 0, perSpendAmount: null, perSpendCap: null },
    milestones: [],
    perks: [],
  };
}
