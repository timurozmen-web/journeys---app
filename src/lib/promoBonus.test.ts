import { describe, expect, it } from 'vitest';
import { promoBonusForStay, promoTerms } from './promoBonus';
import { makeHotel } from '../test/fixtures';
import type { Promotion } from '../types';

const promo = (o: Partial<Promotion>): Promotion => ({
  id: 'p', title: '', description: null, brand: null, startDate: null, endDate: null, promoType: 'threshold_bonus',
  multiplier: null, thresholdSpend: null, bonusPoints: null, discountValue: null, discountUsed: false,
  statusNightsBonus: null, statusNightsApplied: false, partnerAirline: null, ...o,
});

describe('promoTerms', () => {
  it('reads the terms the way programmes word them', () => {
    expect(promoTerms({ title: 'Earn 2K Bonus Points every 2 nights', description: 'Earn 2,000 Bonus Points for every two eligible nights, beginning on your second stay. Stay between July 1 and September 7, 2026, at all hotels participating in World of Hyatt.' }))
      .toEqual({ perNights: 2, minNights: null, nthStay: null, fromStay: 2, onlyAt: null });
    expect(promoTerms({ title: '10,000 Points Every 2 Nights at Ruby Hotels', description: null }).onlyAt).toBe('ruby');
    expect(promoTerms({ title: '10,000 bonus points on your second stay', description: null }).nthStay).toBe(2);
    expect(promoTerms({ title: 'Fall 2026: 1,500 bonus points on stays of 2+ nights', description: null }).minNights).toBe(2);
  });
});

describe('promoBonusForStay', () => {
  it("credits IHG's targeted 10,000 on the second stay only", () => {
    const greenwich = makeHotel({ id: 'g', brand: 'IHG One Rewards', name: 'Holiday Inn Express London Greenwich', date: '2026-09-16', total: 121.25 });
    const croydon = makeHotel({ id: 'c', brand: 'IHG One Rewards', name: 'Holiday Inn Express London Croydon', date: '2026-10-06', total: 92.45 });
    const p = promo({ title: '10,000 bonus points on your second stay', brand: 'IHG One Rewards', bonusPoints: 10000, startDate: '2026-09-16', endDate: '2026-10-07' });
    const stays = [greenwich, croydon];
    expect(promoBonusForStay(greenwich, stays, [p])).toBe(0);
    expect(promoBonusForStay(croydon, stays, [p])).toBe(10000);
  });

  it('pays a stays-of-2+-nights bonus once per long enough paid stay in the window', () => {
    const p = promo({ title: 'Fall 2026: 1,500 bonus points on stays of 2+ nights', brand: 'Marriott Bonvoy', bonusPoints: 1500, startDate: '2026-09-22', endDate: '2026-11-22' });
    const gb = makeHotel({ id: 'gb', brand: 'Marriott Bonvoy', date: '2026-11-13', nights: 2, total: 294.38 });
    const one = makeHotel({ id: 'o', brand: 'Marriott Bonvoy', date: '2026-10-25', nights: 1, total: 106.76 });
    const award = makeHotel({ id: 'a', brand: 'Marriott Bonvoy', date: '2026-10-01', nights: 3, total: 0, award: true });
    expect(promoBonusForStay(gb, [gb, one, award], [p])).toBe(1500);
    expect(promoBonusForStay(one, [gb, one, award], [p])).toBe(0);
    expect(promoBonusForStay(award, [gb, one, award], [p])).toBe(0);
  });

  it('adds up nights across stays for every-2-nights bonuses, only at the named brand', () => {
    const p = promo({ title: '10,000 Points Every 2 Nights at Ruby Hotels', brand: 'IHG One Rewards', bonusPoints: 10000 });
    const a = makeHotel({ id: 'a', brand: 'IHG One Rewards', name: 'Ruby Lucy London', date: '2026-08-01', nights: 1, total: 100 });
    const b = makeHotel({ id: 'b', brand: 'IHG One Rewards', name: 'Ruby Ella Hotel London', date: '2026-08-10', nights: 3, total: 300 });
    const c = makeHotel({ id: 'c', brand: 'IHG One Rewards', name: 'Holiday Inn Express', date: '2026-08-05', nights: 2, total: 100 });
    const stays = [a, b, c];
    expect(promoBonusForStay(a, stays, [p])).toBe(0);
    expect(promoBonusForStay(b, stays, [p])).toBe(20000);
    expect(promoBonusForStay(c, stays, [p])).toBe(0);
  });

  it('ignores a bonus whose terms it cannot read', () => {
    const p = promo({ title: 'Something special', brand: 'Marriott Bonvoy', bonusPoints: 5000 });
    const h = makeHotel({ brand: 'Marriott Bonvoy', total: 200 });
    expect(promoBonusForStay(h, [h], [p])).toBe(0);
  });
});
