import { describe, expect, it } from 'vitest';
import { loyaltyHighlights } from './loyaltyHighlights';
import type { LoyaltyProgramme, Voucher } from '../types';

const TODAY = '2026-10-06';
const voucher = (id: string, expiryDate: string, redeemed = false): Voucher => ({
  id, name: `Free night ${id}`, source: 'Marriott Debit', value: 250, earnedDate: '2026-01-01', expiryDate, redeemed, redeemedDate: null, sourceKey: null,
});

describe('loyaltyHighlights', () => {
  it('flags vouchers expiring within 90 days, soonest first, and skips redeemed ones', () => {
    const h = loyaltyHighlights({
      programmes: [], hotels: [], promotions: [], cardResults: [], today: TODAY,
      vouchers: [voucher('a', '2026-12-20'), voucher('b', '2026-10-20'), voucher('c', '2027-06-01'), voucher('d', '2026-10-10', true)],
    });
    expect(h.map((x) => x.title)).toEqual(['Free night b expires in 14 days', 'Free night a expires in 75 days']);
  });

  it("doesn't repeat status, which the rings already show", () => {
    const marriott = { name: 'Marriott Bonvoy', points: 0, ptValue: 0.6, tier: 'Titanium Elite', nextTier: 'Ambassador', nights: 54, nightsNeeded: 46, nightsBaselineDate: TODAY, category: 'hotel' } as LoyaltyProgramme;
    expect(loyaltyHighlights({ programmes: [marriott], hotels: [], promotions: [], cardResults: [], vouchers: [], today: TODAY })).toEqual([]);
  });
});
