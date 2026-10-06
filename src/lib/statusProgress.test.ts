import { describe, expect, it } from 'vitest';
import { computeStatusProgress } from './statusProgress';
import { makeHotel } from '../test/fixtures';
import type { LoyaltyProgramme } from '../types';

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
    expect(p.breakdown).toEqual({ stays: 34, card: 15, promos: 0, pending: 3 });
    expect(p.breakdown.stays + p.breakdown.card + p.breakdown.promos).toBe(p.currentNights);
  });

  it('counts card nights as pending until the welcome bonus is met', () => {
    const notMet = { ...amex, milestoneResults: [{ m: { id: 'welcome30k' }, hit: false }] };
    const p = computeStatusProgress(marriott, [], [], [notMet]);
    expect(p.breakdown.card).toBe(0);
    expect(p.breakdown.pending).toBe(15);
  });
});
