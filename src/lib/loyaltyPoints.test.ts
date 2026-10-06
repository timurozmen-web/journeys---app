import { describe, expect, test } from 'vitest';
import { basePointsForHotel, computeBaseProgramPoints, pointsFromStays, stayPoints } from './loyaltyPoints';
import type { LoyaltyProgramme } from '../types';
import { makeHotel } from '../test/fixtures';
import type { Promotion } from '../types';

function multiplierPromo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p1', title: 'Double points', description: null, brand: 'Hilton Honors',
    startDate: '2026-09-01', endDate: '2026-09-30', promoType: 'multiplier', multiplier: 2,
    thresholdSpend: null, bonusPoints: null, discountValue: null, discountUsed: false,
    statusNightsBonus: null, statusNightsApplied: false, partnerAirline: null,
    ...overrides,
  };
}

// The tier now comes from the member's programme (it was hard-coded).
const tiers = [{ name: 'Hilton Honors', tier: 'Gold' }, { name: 'Accor ALL', tier: 'Gold' }];

describe('basePointsForHotel', () => {
  test('Hilton Gold: £100 -> $127 x 10 pts x 1.8 tier bonus', () => {
    expect(basePointsForHotel(makeHotel({ brand: 'Hilton Honors', total: 100 }), [], tiers)).toBe(2286);
  });

  test('Accor Gold is priced in euros: £100 -> €117 x 2.5 pts x 1.5', () => {
    expect(basePointsForHotel(makeHotel({ brand: 'Accor ALL', total: 100 }), [], tiers)).toBe(439);
  });

  test('Marriott uses the tier held on the date of the stay', () => {
    const at = (date: string) => basePointsForHotel(makeHotel({ brand: 'Marriott Bonvoy', total: 200, date }));
    expect(at('2025-11-01')).toBe(3175); // Gold +25%
    expect(at('2026-01-10')).toBe(3810); // Platinum +50%
    expect(at('2026-07-22')).toBe(4445); // Titanium +75%, from this stay onward
  });

  test('earns nothing unless completed, priced, and a tracked programme', () => {
    expect(basePointsForHotel(makeHotel({ brand: 'Hilton Honors', total: 100, status: 'Booked' }))).toBe(0);
    expect(basePointsForHotel(makeHotel({ brand: 'Hilton Honors', total: null }))).toBe(0);
    expect(basePointsForHotel(makeHotel({ brand: 'Independent', total: 100 }))).toBe(0);
  });

  test('a multiplier promo applies only inside its dates and to its brand', () => {
    const stay = makeHotel({ brand: 'Hilton Honors', total: 100, date: '2026-09-10' });
    expect(basePointsForHotel(stay, [multiplierPromo()], tiers)).toBe(4572);
    expect(basePointsForHotel({ ...stay, date: '2026-10-10' }, [multiplierPromo()], tiers)).toBe(2286);
    expect(basePointsForHotel(stay, [multiplierPromo({ brand: 'IHG One Rewards' })], tiers)).toBe(2286);
  });
});

describe('computeBaseProgramPoints', () => {
  test('sums only the requested programme', () => {
    const hotels = [
      makeHotel({ brand: 'Hilton Honors', total: 100 }),
      makeHotel({ brand: 'Hilton Honors', total: 100 }),
      makeHotel({ brand: 'IHG One Rewards', total: 100 }),
    ];
    expect(computeBaseProgramPoints(hotels, 'Hilton Honors', [], tiers)).toBe(4572);
  });
});

describe('stayPoints: sub-brands that earn less', () => {
  test('ibis earns half the Accor rate; Residence Inn half the Marriott rate', () => {
    const accor = stayPoints(makeHotel({ brand: 'Accor ALL', name: 'Novotel London', total: 100 }), [{ name: 'Accor ALL' }]);
    const ibis = stayPoints(makeHotel({ brand: 'Accor ALL', name: 'ibis Styles London Gatwick Airport', total: 100 }), [{ name: 'Accor ALL' }]);
    expect(ibis * 2).toBeCloseTo(accor, -1);
    const mar = (name: string) => stayPoints(makeHotel({ brand: 'Marriott Bonvoy', name, total: 100, date: '2026-08-01' }));
    expect(mar('Residence Inn London Tower Bridge') * 2).toBeCloseTo(mar('Courtyard London'), -1);
  });
  test('award stays and unpriced stays earn nothing', () => {
    expect(stayPoints(makeHotel({ brand: 'Hilton Honors', total: 100, award: true }))).toBe(0);
    expect(stayPoints(makeHotel({ brand: 'Hilton Honors', total: null }))).toBe(0);
  });
});

describe('pointsFromStays: live balance top-up', () => {
  const hilton: LoyaltyProgramme = {
    name: 'Hilton Honors', abbr: 'HH', points: 1000, ptValue: 0.4, color: '#000', accent: '#fff', font: 'x', shape: 'x',
    tier: 'Gold', nextTier: 'Diamond', nights: 0, nightsNeeded: 30, nightsBaselineDate: '2026-08-13', statusPointsOverride: null, category: 'hotel',
  };
  test('completed stays after the balance date are earned; booked ones pending; earlier ones already in the balance', () => {
    const r = pointsFromStays(hilton, [
      makeHotel({ id: 'a', brand: 'Hilton Honors', total: 100, date: '2026-09-01', status: 'Completed' }),
      makeHotel({ id: 'b', brand: 'Hilton Honors', total: 100, date: '2026-11-01', status: 'Booked' }),
      makeHotel({ id: 'c', brand: 'Hilton Honors', total: 100, date: '2026-08-01', status: 'Completed' }),
      makeHotel({ id: 'd', brand: 'Marriott Bonvoy', total: 100, date: '2026-09-01', status: 'Completed' }),
    ]);
    expect(r).toEqual({ earned: 2286, pending: 2286 });
  });
});
