import { describe, expect, test } from 'vitest';
import { CARDS_STATIC, REGIONS, type Region } from '../data/cardDefs';
import {
  bankRowsToItems, cardDistinguishesAbroad, categoryFor, categoryRate, isOwnBrandMerchant, rateOf, regionOfCountry, regionOfCurrency, summariseSpend,
} from './earning';

const card = (id: string) => CARDS_STATIC.find((c) => c.id === id)!;
const window = { start: '2026-01-01', end: '2027-01-01' };

// The guard on the whole design: each card's categories are a true
// partition of its rate logic. If someone edits a rate in rateFor and
// forgets the category table (or the reverse), this fails.
describe.each(CARDS_STATIC.map((c) => [c.id, c] as const))('%s earn categories', (_id, c) => {
  const dates = ['2026-01-15', '2026-10-31', '2026-11-01', '2027-03-01']; // straddles the IHG promo end
  const combos: [boolean, Region][] = [true, false].flatMap((own) => REGIONS.map((r) => [own, r] as [boolean, Region]));

  test('every own-brand/region combination lands in exactly one category', () => {
    for (const [own, region] of combos) {
      const matches = c.earnCategories.filter((cat) => (cat.own === undefined || cat.own === own) && cat.regions.includes(region));
      expect(matches, `${c.id} own=${own} region=${region}`).toHaveLength(1);
    }
  });

  test('a category pays one rate for all of its members, on any date', () => {
    for (const date of dates) {
      for (const [own, region] of combos) {
        const cat = categoryFor(c, own, region);
        expect(rateOf(c, own, region, date), `${c.id} ${cat.id} own=${own} ${region} ${date}`).toBe(categoryRate(c, cat, date));
      }
    }
  });

  test('category ids are unique', () => {
    expect(new Set(c.earnCategories.map((x) => x.id)).size).toBe(c.earnCategories.length);
  });
});

describe('regions', () => {
  test('from a country', () => {
    expect(regionOfCountry('United Kingdom')).toBe('uk');
    expect(regionOfCountry('Portugal')).toBe('europe');
    expect(regionOfCountry('Japan')).toBe('premium');
    expect(regionOfCountry('Australia')).toBe('elsewhere');
  });

  test('from a statement currency', () => {
    expect(regionOfCurrency('gbp')).toBe('uk');
    expect(regionOfCurrency('EUR')).toBe('europe');
    expect(regionOfCurrency('TRY')).toBe('europe'); // Türkiye is in the Europe set
    expect(regionOfCurrency('USD')).toBe('premium');
    expect(regionOfCurrency('AUD')).toBe('elsewhere');
    expect(regionOfCurrency('XYZ')).toBe('elsewhere');
  });
});

describe('summariseSpend', () => {
  test('splits spend into the card\'s own categories and prices each at its rate', () => {
    const rows = [
      { date: '2026-02-01', amount: 1000, currency: 'GBP', merchant: 'MARRIOTT LONDON GB' }, // own, UK: 4x
      { date: '2026-02-02', amount: 200, currency: 'GBP', merchant: 'WAITROSE 1234' },      // other, UK: 1x
      { date: '2026-02-03', amount: 300, currency: 'EUR', merchant: 'CARREFOUR LISBOA' },   // other, abroad: 3x
      { date: '2026-02-04', amount: 150, currency: 'GBP', merchant: 'MARRIOTT.COM' },       // own, UK: 4x
    ];
    const s = summariseSpend(card('Marriott Debit'), bankRowsToItems(card('Marriott Debit'), rows, { EUR: 1 }), window, '2026-03-01');
    const by = Object.fromEntries(s.categories.map((c) => [c.category.id, c]));
    expect(by['own-uk']).toMatchObject({ spend: 1150, points: 4600, rate: 4 });
    expect(by['other-uk']).toMatchObject({ spend: 200, points: 200 });
    expect(by['other-abroad']).toMatchObject({ spend: 300, points: 900 });
    expect(s.totalSpend).toBe(1650);
    expect(s.totalPoints).toBe(5700);
  });

  test('the free BA Amex earns 1 Avios a pound, British Airways split out as its own category', () => {
    const rows = [{ date: '2026-02-01', amount: 500, currency: 'GBP', merchant: 'BRITISH AIRWAYS' }, { date: '2026-02-02', amount: 100, currency: 'GBP', merchant: 'TESCO' }];
    const s = summariseSpend(card('BA Amex'), bankRowsToItems(card('BA Amex'), rows), window, '2026-03-01');
    const by = Object.fromEntries(s.categories.map((c) => [c.category.id, c]));
    expect(by.own.spend).toBe(500);
    expect(by.other.spend).toBe(100);
    expect(s.totalPoints).toBe(600);
  });

  test('Virgin Atlantic merchants earn the own-brand rate', () => {
    const rows = [{ date: '2026-02-01', amount: 400, currency: 'GBP', merchant: 'VIRGIN ATLANTIC AIRWAYS' }, { date: '2026-02-02', amount: 100, currency: 'GBP', merchant: 'VIRGIN MEDIA' }];
    const s = summariseSpend(card('Virgin Atlantic Mastercard+'), bankRowsToItems(card('Virgin Atlantic Mastercard+'), rows), window, '2026-03-01');
    const by = Object.fromEntries(s.categories.map((c) => [c.category.id, c]));
    expect(by.own.points).toBe(1200);   // 3x
    expect(by.other.points).toBe(150);  // 1.5x -- Virgin Media is not Virgin Atlantic
  });

  test('IHG promo is applied by the date of each purchase', () => {
    const rows = [
      { date: '2026-10-30', amount: 100, currency: 'GBP', merchant: 'HOLIDAY INN LONDON' }, // own UK/Europe, promo: 4x
      { date: '2026-11-02', amount: 100, currency: 'GBP', merchant: 'HOLIDAY INN LONDON' }, // after promo: 3x
    ];
    const ihg = card('IHG Revolut Elite');
    expect(summariseSpend(ihg, bankRowsToItems(ihg, rows), window, '2026-11-10').totalPoints).toBe(700);
  });

  test('refunds reduce spend; purchases outside the window are left out', () => {
    const rows = [
      { date: '2026-02-01', amount: 500, currency: 'GBP', merchant: 'SHOP' },
      { date: '2026-02-05', amount: -100, currency: 'GBP', merchant: 'SHOP' },
      { date: '2025-12-31', amount: 999, currency: 'GBP', merchant: 'SHOP' },
    ];
    const c = card('BA Amex');
    expect(summariseSpend(c, bankRowsToItems(c, rows), window, '2026-03-01').totalSpend).toBe(400);
  });

  test('billed-in-pounds spend is flagged as possibly abroad; foreign currency is not', () => {
    const c = card('Marriott Debit');
    const gbp = summariseSpend(c, bankRowsToItems(c, [{ date: '2026-02-01', amount: 100, currency: 'GBP', merchant: 'X' }]), window, '2026-03-01');
    const eur = summariseSpend(c, bankRowsToItems(c, [{ date: '2026-02-01', amount: 100, currency: 'EUR', merchant: 'X' }], { EUR: 1 }), window, '2026-03-01');
    expect(gbp.assumedShare).toBe(1);
    expect(eur.assumedShare).toBe(0);
  });

  test('only cards that pay differently abroad need the caveat', () => {
    expect(cardDistinguishesAbroad(card('Marriott Debit'), '2026-03-01')).toBe(true);
    expect(cardDistinguishesAbroad(card('Hilton Debit'), '2026-03-01')).toBe(true);
    expect(cardDistinguishesAbroad(card('BA Amex'), '2026-03-01')).toBe(false);
    expect(cardDistinguishesAbroad(card('Marriott Amex'), '2026-03-01')).toBe(false);
    expect(cardDistinguishesAbroad(card('Virgin Atlantic Mastercard+'), '2026-03-01')).toBe(false);
  });
});

describe('bankRowsToItems without a usable rate', () => {
  test('a currency with no known rate is left out, not turned into NaN', () => {
    const card = CARDS_STATIC[0];
    const items = bankRowsToItems(card, [
      { date: '2026-05-01', amount: 100, currency: 'CHF', merchant: null },
      { date: '2026-05-02', amount: 10, currency: 'GBP', merchant: null },
    ], {});
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(10);
  });
});

describe('Marriott Debit merchants as they arrive from Currensea via Monzo (prefix already removed)', () => {
  const debit = CARDS_STATIC.find((c) => c.id === 'Marriott Debit')!;
  test('a Courtyard stay is a Marriott purchase; Zola and Uber are everyday', () => {
    expect(isOwnBrandMerchant(debit, 'Courtyard By Marriott')).toBe(true);
    expect(isOwnBrandMerchant(debit, 'Zola.Comregi')).toBe(false);
    expect(isOwnBrandMerchant(debit, 'Uber Train')).toBe(false);
  });
});
