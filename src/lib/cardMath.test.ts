import { describe, expect, test } from 'vitest';
import { computeCardResults } from './cardMath';
import { makeFlight, makeHotel } from '../test/fixtures';
import type { LoyaltyProgramme, PaymentCard } from '../types';

const programme = (name: string, ptValue = 1): LoyaltyProgramme => ({
  name, abbr: name.slice(0, 2), points: 0, ptValue, color: '#000', accent: '#fff', font: 'x', shape: 'x', category: 'hotel',
});
const card = (id: string, programmeBrand: string, openDate: string, extra: Partial<PaymentCard> = {}): PaymentCard => ({
  id, programmeBrand, annualFee: 0, feeLabel: '', openDate, manualSpendAdjustment: 0, manualSpendIsUK: true, closedDate: null, ...extra,
});
const result = (id: string, rs: ReturnType<typeof computeCardResults>) => rs.find((r) => r.card.id === id)!;

describe('computeCardResults: spend and points from logged stays (unchanged behaviour)', () => {
  const programmes = [programme('Marriott Bonvoy', 0.5), programme('Hilton Honors', 0.4), programme('IHG One Rewards', 0.45), programme('Virgin Points')];

  test('Marriott Debit: own-brand UK 4x, other abroad 3x, manual UK spend 1x', () => {
    const hotels = [
      makeHotel({ id: 'a', brand: 'Marriott Bonvoy', country: 'United Kingdom', total: 1000, date: '2026-01-10', card: 'Marriott Debit' }),
      makeHotel({ id: 'b', brand: 'Independent', country: 'Japan', total: 500, date: '2026-01-20', card: 'Marriott Debit' }),
    ];
    const cards = [card('Marriott Debit', 'Marriott Bonvoy', '2025-12-01', { manualSpendAdjustment: 200 })];
    const r = result('Marriott Debit', computeCardResults(hotels, [], cards, programmes, '2026-03-10'));
    expect(r.autoSpend).toBe(1700);
    expect(r.autoPts).toBe(4000 + 1500 + 200);
  });

  test('hotels outside the card year, or with no total, are ignored', () => {
    const hotels = [
      makeHotel({ id: 'a', brand: 'Marriott Bonvoy', total: 900, date: '2025-11-01', card: 'Marriott Debit' }), // before opening
      makeHotel({ id: 'b', brand: 'Marriott Bonvoy', total: null, date: '2026-01-10', card: 'Marriott Debit' }),
    ];
    const cards = [card('Marriott Debit', 'Marriott Bonvoy', '2025-12-01')];
    expect(result('Marriott Debit', computeCardResults(hotels, [], cards, programmes, '2026-03-10')).autoSpend).toBe(0);
  });

  test('a stay with no card set defaults to the programme\'s usual card', () => {
    const hotels = [makeHotel({ id: 'a', brand: 'Hilton Honors', country: 'United Kingdom', total: 200, date: '2026-01-10', card: null })];
    const cards = [card('Hilton Debit', 'Hilton Honors', '2025-08-29')];
    const r = result('Hilton Debit', computeCardResults(hotels, [], cards, programmes, '2026-03-10'));
    expect(r.autoSpend).toBe(200);
    expect(r.autoPts).toBe(600); // 3x own-brand UK
  });

  test('Virgin Atlantic flights credit the Virgin card at the own-brand rate', () => {
    const flights = [makeFlight({ airline: 'Virgin Atlantic', cost: 400, date: '2026-01-15' })];
    const cards = [card('Virgin Atlantic Mastercard+', 'Virgin Points', '2025-09-01')];
    const r = result('Virgin Atlantic Mastercard+', computeCardResults([], flights, cards, programmes, '2026-03-10'));
    expect(r.autoSpend).toBe(400);
    expect(r.autoPts).toBe(1200);
  });

  test('IHG promo rates apply by stay date, ending 31 Oct 2026', () => {
    const during = makeHotel({ id: 'a', brand: 'IHG One Rewards', country: 'United Kingdom', total: 100, date: '2026-09-01', card: 'IHG Revolut Elite' });
    const after = makeHotel({ id: 'b', brand: 'IHG One Rewards', country: 'United Kingdom', total: 100, date: '2026-11-15', card: 'IHG Revolut Elite' });
    const cards = [card('IHG Revolut Elite', 'IHG One Rewards', '2026-07-24')];
    expect(result('IHG Revolut Elite', computeCardResults([during], [], cards, programmes, '2026-12-01')).autoPts).toBe(400); // 4x
    expect(result('IHG Revolut Elite', computeCardResults([after], [], cards, programmes, '2026-12-01')).autoPts).toBe(300); // 3x
  });
});

describe('computeCardResults: milestones from spend (unchanged behaviour)', () => {
  const programmes = [programme('Marriott Bonvoy', 0.5)];

  test('a spend milestone is hit once spend reaches it; the higher renewal tier supersedes the lower', () => {
    const cards = [card('Marriott Debit', 'Marriott Bonvoy', '2025-12-01', { manualSpendAdjustment: 9500, manualSpendIsUK: false })];
    const r = result('Marriott Debit', computeCardResults([], [], cards, programmes, '2026-03-10'));
    const by = Object.fromEntries(r.milestoneResults.map((m) => [m.m.id, m]));
    expect(by.renew50k.hit).toBe(true);
    expect(by.renew25k.superseded).toBe(true);
    expect(r.milestoneValue).toBe((30000 + 50000) * 0.5 / 100); // welcome30k + renew50k, at 0.5p each
  });

  test('the next milestone is the lowest spend target not yet reached', () => {
    const cards = [card('Marriott Debit', 'Marriott Bonvoy', '2025-12-01', { manualSpendAdjustment: 3500 })];
    const r = result('Marriott Debit', computeCardResults([], [], cards, programmes, '2026-03-10'));
    expect(r.nextMilestone?.m.id).toBe('renew25k');
  });
});

describe('welcome-bonus windows (new: judged on dated spend within the window)', () => {
  const programmes = [programme('Marriott Bonvoy', 0.5)];
  const open = '2025-12-01'; // welcome30k: £3,000 within 3 months, so by 1 Mar 2026
  const cards = [card('Marriott Debit', 'Marriott Bonvoy', open)];
  const welcome = (rs: ReturnType<typeof computeCardResults>) => result('Marriott Debit', rs).milestoneResults.find((m) => m.m.id === 'welcome30k')!;

  test('spend that arrives after the window does not qualify, even though the card-year total passes £3k', () => {
    // Regression: this used to be reported as hit, because the whole
    // card-year was counted and the milestone's windowMonths was ignored.
    const bank = { 'Marriott Debit': [
      { date: '2025-12-20', amount: 500, currency: 'GBP', merchant: 'SHOP' },
      { date: '2026-04-10', amount: 3000, currency: 'GBP', merchant: 'SHOP' },
    ] };
    const r = result('Marriott Debit', computeCardResults([], [], cards, programmes, '2026-05-01', { bankSpend: bank }));
    expect(r.autoSpend).toBe(3500);          // card-year total
    expect(welcome([r] as never)).toMatchObject({ hit: false, missed: true, spend: 500 });
  });

  test('a goal reached inside the window stays reached after it closes', () => {
    const bank = { 'Marriott Debit': [{ date: '2026-01-15', amount: 3200, currency: 'GBP', merchant: 'SHOP' }] };
    const r = result('Marriott Debit', computeCardResults([], [], cards, programmes, '2026-05-01', { bankSpend: bank }));
    expect(welcome([r] as never)).toMatchObject({ hit: true, missed: false });
  });

  test('while the window is open, there is a pace and it is the next goal', () => {
    const bank = { 'Marriott Debit': [{ date: '2025-12-20', amount: 500, currency: 'GBP', merchant: 'SHOP' }] };
    const r = result('Marriott Debit', computeCardResults([], [], cards, programmes, '2026-01-15', { bankSpend: bank }));
    const w = welcome([r] as never);
    expect(w.missed).toBe(false);
    expect(w.pace).toMatchObject({ status: 'open', remaining: 2500 });
    expect(r.nextMilestone?.m.id).toBe('welcome30k');
  });

  test('a missed goal is no longer offered as the next one', () => {
    const r = result('Marriott Debit', computeCardResults([], [], cards, programmes, '2026-05-01', { bankSpend: { 'Marriott Debit': [] } }));
    expect(r.nextMilestone?.m.id).toBe('renew25k');
  });

  test('logged stays are judged by the same window', () => {
    const hotels = [
      makeHotel({ id: 'a', brand: 'Independent', total: 400, date: '2025-12-10', card: 'Marriott Debit' }),
      makeHotel({ id: 'b', brand: 'Independent', total: 3500, date: '2026-04-10', card: 'Marriott Debit' }),
    ];
    const r = result('Marriott Debit', computeCardResults(hotels, [], cards, programmes, '2026-05-01'));
    expect(welcome([r] as never)).toMatchObject({ hit: false, missed: true, spend: 400 });
  });
});

describe('connected cards (spend from the bank)', () => {
  const programmes = [programme('Marriott Bonvoy', 0.5)];
  const cards = [card('Marriott Amex', 'Marriott Bonvoy', '2025-08-15')];

  test('uses bank spend only, so a stay also logged on the card is not counted twice', () => {
    const hotels = [makeHotel({ id: 'a', brand: 'Marriott Bonvoy', country: 'United Kingdom', total: 1000, date: '2026-02-01', card: 'Marriott Amex' })];
    const bank = { 'Marriott Amex': [{ date: '2026-02-01', amount: 1000, currency: 'GBP', merchant: 'MARRIOTT LONDON' }] };
    const connected = result('Marriott Amex', computeCardResults(hotels, [], cards, programmes, '2026-03-01', { bankSpend: bank }));
    const logged = result('Marriott Amex', computeCardResults(hotels, [], cards, programmes, '2026-03-01'));
    expect(connected.connected).toBe(true);
    expect(connected.autoSpend).toBe(1000);
    expect(connected.autoPts).toBe(6000); // own-brand 6x
    expect(logged.connected).toBe(false);
    expect(logged.autoSpend).toBe(1000);
  });

  test('a connected card ignores the manual figure; with no purchases it shows nothing spent', () => {
    const withManual = [card('Marriott Amex', 'Marriott Bonvoy', '2025-08-15', { manualSpendAdjustment: 800 })];
    const r = result('Marriott Amex', computeCardResults([], [], withManual, programmes, '2026-03-01', { bankSpend: { 'Marriott Amex': [] } }));
    expect(r.connected).toBe(true);
    expect(r.autoSpend).toBe(0);
  });

  test('spend in another currency is converted to pounds', () => {
    const bank = { 'Marriott Amex': [{ date: '2026-02-01', amount: 120, currency: 'EUR', merchant: 'SHOP' }] };
    const r = result('Marriott Amex', computeCardResults([], [], cards, programmes, '2026-03-01', { bankSpend: bank, rates: { EUR: 1.2 } }));
    expect(r.autoSpend).toBe(100);
  });

  test('the category split is exposed for the card pane', () => {
    const bank = { 'Marriott Amex': [
      { date: '2026-02-01', amount: 1000, currency: 'GBP', merchant: 'MARRIOTT LONDON' },
      { date: '2026-02-02', amount: 400, currency: 'GBP', merchant: 'TESCO' },
    ] };
    const r = result('Marriott Amex', computeCardResults([], [], cards, programmes, '2026-03-01', { bankSpend: bank }));
    expect(r.summary.categories.map((c) => [c.category.id, c.spend, c.points])).toEqual([['own', 1000, 6000], ['other', 400, 800]]);
  });
});

describe('BA Amex cards: sourced rates and offer-dependent welcome bonus', () => {
  const programmes = [programme('Avios', 1.2)];
  const spend = (date: string, amount: number, merchant: string | null = 'TESCO') => ({ date, amount, currency: 'GBP', merchant });

  test('Premium Plus earns 1.5 Avios per £1 up to 6 Oct 2026, 3 at British Airways', () => {
    const cards = [card('BA Amex Premium Plus', 'Avios', '2026-09-01')];
    const r = result('BA Amex Premium Plus', computeCardResults([], [], cards, programmes, '2026-10-02', {
      bankSpend: { 'BA Amex Premium Plus': [spend('2026-09-10', 1000), spend('2026-09-12', 1000, 'BRITISH AIRWAYS')] },
    }));
    expect(r.autoPts).toBe(1500 + 3000);
  });

  test('from 7 Oct 2026 Premium Plus general spend earns 1.25', () => {
    const cards = [card('BA Amex Premium Plus', 'Avios', '2026-09-01')];
    const r = result('BA Amex Premium Plus', computeCardResults([], [], cards, programmes, '2026-10-20', {
      bankSpend: { 'BA Amex Premium Plus': [spend('2026-10-10', 1000)] },
    }));
    expect(r.autoPts).toBe(1250);
  });

  test('opened during the promotion: the boosted welcome bonus is tracked over its 3 months', () => {
    const cards = [card('BA Amex', 'Avios', '2026-09-10')];
    const r = result('BA Amex', computeCardResults([], [], cards, programmes, '2026-10-02', { bankSpend: { 'BA Amex': [spend('2026-09-15', 800)] } }));
    const welcome = r.milestoneResults.find((m) => m.m.id === 'welcome')!;
    expect(welcome.m.rewardPoints).toBe(10000);
    expect(welcome.m.spendRequired).toBe(2000);
    expect(welcome.spend).toBe(800);
    expect(welcome.hit).toBe(false);
    expect(welcome.window).toEqual({ start: '2026-09-10', end: '2026-12-10' });
  });

  test('opened outside any known offer: no welcome milestone is invented', () => {
    const cards = [card('BA Amex Premium Plus', 'Avios', '2025-03-01')];
    const r = result('BA Amex Premium Plus', computeCardResults([], [], cards, programmes, '2026-10-02'));
    expect(r.milestoneResults.map((m) => m.m.id)).toEqual(['companion']);
  });

  test('a card added by hand gets a tile that tracks spend but works out no points', () => {
    const cards = [card('Amex Gold', 'Other', '2026-01-01', { annualFee: 195, feeLabel: '£195/yr' })];
    const r = result('Amex Gold', computeCardResults([], [], cards, programmes, '2026-10-02', { bankSpend: { 'Amex Gold': [spend('2026-05-01', 400)] } }));
    expect(r.card.custom).toBe(true);
    expect(r.autoSpend).toBe(400);
    expect(r.autoPts).toBe(0);
  });
});

import { computeCardVoucherCandidates } from './cardMath';

describe('Marriott Debit renewal free night', () => {
  const programmes = [programme('Marriott Bonvoy', 0.5)];

  test('only spend abroad counts toward it', () => {
    const uk = [card('Marriott Debit', 'Marriott Bonvoy', '2025-12-01', { manualSpendAdjustment: 12000, manualSpendIsUK: true })];
    const abroad = [card('Marriott Debit', 'Marriott Bonvoy', '2025-12-01', { manualSpendAdjustment: 6000, manualSpendIsUK: false })];
    const ids = (cards: PaymentCard[]) => result('Marriott Debit', computeCardResults([], [], cards, programmes, '2026-10-06')).milestoneResults.filter((m) => m.hit).map((m) => m.m.id);
    expect(ids(uk)).not.toContain('renew25k');
    expect(ids(abroad)).toContain('renew25k');
  });

  test('the voucher is issued at renewal and valid for 12 months from then', () => {
    // Regression: it was dated from the start of the card year and shown as
    // expiring on the renewal date -- "expires in 56 days" for a voucher not yet issued.
    const cards = [card('Marriott Debit', 'Marriott Bonvoy', '2025-12-01', { manualSpendAdjustment: 12000, manualSpendIsUK: false })];
    const v = computeCardVoucherCandidates(computeCardResults([], [], cards, programmes, '2026-10-06')).find((c) => c.sourceKey.includes('renew50k'))!;
    expect(v).toMatchObject({ earnedDate: '2026-12-01', expiryDate: '2027-12-01' });
  });

  test('a card closed before its renewal gets no renewal voucher', () => {
    const cards = [card('Marriott Debit', 'Marriott Bonvoy', '2025-12-01', { manualSpendAdjustment: 12000, manualSpendIsUK: false, closedDate: '2026-11-01' })];
    expect(computeCardVoucherCandidates(computeCardResults([], [], cards, programmes, '2026-10-06'))).toEqual([]);
  });
});
