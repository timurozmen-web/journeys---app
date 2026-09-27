import { describe, expect, test } from 'vitest';
import { basePointsForHotel, computeBaseProgramPoints } from './loyaltyPoints';
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

describe('basePointsForHotel', () => {
  test('Hilton Gold: £100 -> $127 x 10 pts x 1.8 tier bonus', () => {
    expect(basePointsForHotel(makeHotel({ brand: 'Hilton Honors', total: 100 }))).toBe(2286);
  });

  test('Accor Gold is priced in euros: £100 -> €117 x 2.5 pts x 1.5', () => {
    expect(basePointsForHotel(makeHotel({ brand: 'Accor ALL', total: 100 }))).toBe(439);
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
    expect(basePointsForHotel(stay, [multiplierPromo()])).toBe(4572);
    expect(basePointsForHotel({ ...stay, date: '2026-10-10' }, [multiplierPromo()])).toBe(2286);
    expect(basePointsForHotel(stay, [multiplierPromo({ brand: 'IHG One Rewards' })])).toBe(2286);
  });
});

describe('computeBaseProgramPoints', () => {
  test('sums only the requested programme', () => {
    const hotels = [
      makeHotel({ brand: 'Hilton Honors', total: 100 }),
      makeHotel({ brand: 'Hilton Honors', total: 100 }),
      makeHotel({ brand: 'IHG One Rewards', total: 100 }),
    ];
    expect(computeBaseProgramPoints(hotels, 'Hilton Honors')).toBe(4572);
  });
});
