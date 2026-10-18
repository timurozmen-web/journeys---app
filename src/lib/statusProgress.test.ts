import { describe, expect, it } from 'vitest';
import { computeStatusProgress } from './statusProgress';
import { makeHotel } from '../test/fixtures';
import type { LoyaltyProgramme, Promotion } from '../types';

const year = new Date().getFullYear();
const marriott: LoyaltyProgramme = {
  name: 'Marriott Bonvoy', abbr: 'MB', points: 0, ptValue: 0.6, color: '#1C1C1C', accent: '#FF9962', font: 'x', shape: 'crown',
  tier: 'Titanium Elite', nextTier: 'Ambassador', nights: 30, nightsNeeded: 70, nightsBaselineDate: `${year}-01-01`, category: 'hotel',
};
const amex = {
  card: { id: 'Marriott Amex', programmeBrand: 'Marriott Bonvoy', perks: [], eliteNights: { auto: 15, perSpendAmount: null, perSpendCap: null } },
  autoSpend: 0, cardRow: { closedDate: null }, milestoneResults: [],
};

describe('status ring breakdown', () => {
  it('splits nights into stays, card nights and pending, adding up to the total shown', () => {
    const hotels = [
      makeHotel({ id: 'a', brand: 'Marriott Bonvoy', date: `${year}-03-02`, nights: 4, status: 'Completed' }),
      makeHotel({ id: 'b', brand: 'Marriott Bonvoy', date: `${year}-12-20`, nights: 3, status: 'Booked' }),
    ];
    const p = computeStatusProgress(marriott, hotels, [], [amex]);
    expect(p.total).toBe(100);
    expect(p.breakdown).toEqual({ stays: 34, card: 15, membership: 0, promos: 0, pending: 3 });
    expect(p.breakdown.stays + p.breakdown.card + p.breakdown.membership + p.breakdown.promos).toBe(p.currentNights);
  });

  it('counts card nights as pending until the welcome bonus is met', () => {
    const notMet = { ...amex, milestoneResults: [{ m: { id: 'welcome30k' }, hit: false }] };
    const p = computeStatusProgress(marriott, [], [], [notMet]);
    expect(p.breakdown.card).toBe(0);
    expect(p.breakdown.pending).toBe(15);
  });
});

// The real Accor picture on 11 Oct 2026: 7 nights stayed by the 13 Aug
// baseline, 8 more since, the Gold +15 promotion applied, and ALL Accor+
// Explorer (30 status nights) started on 22 Aug. The Explorer had been
// filed as a closed card, so its nights were missing and the ring read
// 30 of 60 instead of 60.
describe('bonus nights from cards, memberships and promotions', () => {
  const today = '2026-10-11';
  const accor: LoyaltyProgramme = {
    name: 'Accor ALL', abbr: 'AC', points: 0, ptValue: 0.2, color: '#1C1C1C', accent: '#fff', font: 'x', shape: 'crown',
    tier: 'Gold', nextTier: 'Platinum', nights: 7, nightsNeeded: 29, nightsBaselineDate: '2026-08-13', category: 'hotel',
  };
  const stays = [
    makeHotel({ id: 'a', brand: 'Accor ALL', date: '2026-08-25', nights: 1 }),
    makeHotel({ id: 'b', brand: 'Accor ALL', date: '2026-09-01', nights: 3 }),
    makeHotel({ id: 'c', brand: 'Accor ALL', date: '2026-09-09', nights: 4 }),
  ];
  const goldBonus: Promotion = {
    id: 'p', title: 'Gold Status Bonus: +15 Status nights', description: null, brand: 'Accor ALL', startDate: null, endDate: '2026-09-30',
    promoType: 'status_boost', multiplier: null, thresholdSpend: null, bonusPoints: null, discountValue: null, discountUsed: false,
    statusNightsBonus: 15, statusNightsApplied: true, partnerAirline: null, registered: false,
  };
  const explorer = (openDate: string, closedDate: string | null = null) => ({
    card: { id: 'Accor Explorer', programmeBrand: 'Accor ALL', kind: 'subscription' as const, perks: [], eliteNights: { auto: 30, perSpendAmount: null, perSpendCap: null } },
    autoSpend: 0, cardRow: { openDate, closedDate }, milestoneResults: [],
  });

  it('adds a membership started this year, with stays and the applied promotion, each once', () => {
    const p = computeStatusProgress(accor, stays, [goldBonus], [explorer('2026-08-22')], today);
    expect(p.total).toBe(60);
    expect(p.breakdown).toEqual({ stays: 15, card: 0, membership: 30, promos: 15, pending: 0 });
    expect(p.currentNights).toBe(60);
    expect(p.bonusNights.map((b) => [b.source, b.nights, b.earned])).toEqual([['membership', 30, true], ['promo', 15, true]]);
  });

  it('counts a renewal later this year as still to come, not credited', () => {
    const p = computeStatusProgress(accor, stays, [], [explorer('2025-11-20')], today);
    expect(p.breakdown.membership).toBe(0);
    expect(p.breakdown.pending).toBe(30);
    expect(p.bonusNights[0]).toMatchObject({ source: 'membership', earned: false, note: 'Accor Explorer renews 20 Nov' });
  });

  it('counts a renewal earlier this year', () => {
    const p = computeStatusProgress(accor, stays, [], [explorer('2025-03-02')], today);
    expect(p.breakdown.membership).toBe(30);
  });

  it('drops an ended membership', () => {
    const p = computeStatusProgress(accor, stays, [], [explorer('2026-08-22', '2026-09-30')], today);
    expect(p.breakdown.membership).toBe(0);
    expect(p.bonusNights).toEqual([]);
  });

  it('keeps stays apart from bonus nights, so rolling the baseline forward stores stays only', () => {
    const p = computeStatusProgress(accor, stays, [goldBonus], [explorer('2026-08-22')], today);
    // What a balance edit saves as the new stored nights.
    const rolled = { ...accor, nights: p.breakdown.stays, nightsBaselineDate: today };
    const again = computeStatusProgress(rolled, stays, [goldBonus], [explorer('2026-08-22')], today);
    expect(again.currentNights).toBe(p.currentNights);
  });

  it('starts again from this year\'s stays once the year turns', () => {
    const lastYear = { ...accor, nights: 40, nightsBaselineDate: '2025-08-13' };
    const hotels = [
      makeHotel({ id: 'old', brand: 'Accor ALL', date: '2025-12-10', nights: 5 }),
      makeHotel({ id: 'new', brand: 'Accor ALL', date: '2026-02-03', nights: 2 }),
    ];
    const p = computeStatusProgress(lastYear, hotels, [{ ...goldBonus, endDate: '2025-09-30' }], [], today);
    expect(p.breakdown.stays).toBe(2);
    expect(p.breakdown.promos).toBe(0);
  });

  it('shows card nights pending a welcome bonus, then credited, alongside spend nights', () => {
    const debit = {
      card: { id: 'Marriott Debit', programmeBrand: 'Marriott Bonvoy', perks: [], eliteNights: { auto: 15, perSpendAmount: 4000, perSpendCap: 5 } },
      autoSpend: 12500, cardRow: { openDate: '2025-12-01', closedDate: null }, milestoneResults: [{ m: { id: 'welcome30k' }, hit: true }],
    };
    const m = { ...marriott, nights: 47, nightsBaselineDate: '2026-08-13' };
    const p = computeStatusProgress(m, [], [], [amex, debit], today);
    expect(p.breakdown).toEqual({ stays: 47, card: 33, membership: 0, promos: 0, pending: 1 });
    expect(p.bonusNights.map((b) => b.note)).toEqual(['Marriott Amex', 'Marriott Debit', 'Marriott Debit, £12,500 spent', 'Marriott Debit, £3,500 more spend']);
  });
});
