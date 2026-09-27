import { describe, expect, test } from 'vitest';
import { computeBA, computeKF, computeQF, computeQR, runAdvisor, suggestFareLevel, type CreditInput } from './creditingEngine';

// London-New York, BA metal, economy standard fare, £500.
function input(overrides: Partial<CreditInput> = {}): CreditInput {
  return {
    operatingCarrier: 'BA', cabin: 'Economy', fareLevel: 'standard', price: 500,
    distanceMiles: 3451, ukDeparture: true, tiers: {},
    ...overrides,
  };
}

describe('suggestFareLevel', () => {
  test('maps booking letters, case-insensitively', () => {
    expect(suggestFareLevel('Economy', 'y')).toBe('flex');
    expect(suggestFareLevel('Economy', 'Q')).toBe('lowest');
    expect(suggestFareLevel('Business', 'J')).toBe('flex');
  });

  test('unknown or empty letter -> no suggestion', () => {
    expect(suggestFareLevel('First', 'Z')).toBeNull();
    expect(suggestFareLevel('Business', '  ')).toBeNull();
  });
});

describe('British Airways Executive Club', () => {
  test('own metal: spend minus UK long-haul economy taxes (£137), plus extra tier points', () => {
    const r = computeBA(input());
    expect(r.relationship).toBe('own');
    expect(r.status?.amount).toBe(363 + 150);
    expect(r.redeemable?.amount).toBe(363 * 6); // Blue earns 6 Avios per £
  });

  test('higher tier earns more Avios, same tier points', () => {
    const r = computeBA(input({ tiers: { BA: 'Gold' } }));
    expect(r.redeemable?.amount).toBe(363 * 9);
    expect(r.status?.amount).toBe(513);
  });

  test('lowest fares earn no extra tier points', () => {
    expect(computeBA(input({ fareLevel: 'lowest' })).status?.amount).toBe(363);
  });

  test('no price -> only the extra tier points, no Avios', () => {
    const r = computeBA(input({ price: undefined }));
    expect(r.status?.amount).toBe(150);
    expect(r.redeemable?.amount).toBe(0);
  });

  test('American Airlines earns tier points but no Avios into BA Club', () => {
    const r = computeBA(input({ operatingCarrier: 'AA' }));
    expect(r.relationship).toBe('partner');
    expect(r.redeemable).toBeNull();
    expect(r.status?.amount).toBe(363 + 150);
  });

  test('other oneworld partners use distance-based rates and are flagged as estimates', () => {
    const r = computeBA(input({ operatingCarrier: 'CX', cabin: 'Business', fareLevel: 'flex', distanceMiles: 6000 }));
    expect(r.status?.amount).toBe(1500); // 25% of miles
    expect(r.redeemable?.amount).toBe(9000); // 150% of miles
    expect(r.estimated).toBe(true);
  });

  test('Star Alliance carriers earn nothing', () => {
    const r = computeBA(input({ operatingCarrier: 'LH' }));
    expect(r.relationship).toBe('none');
    expect(r.redeemable).toBeNull();
  });
});

describe('Qatar Privilege Club', () => {
  test('own metal: 500-mile floor and tier bonus on Avios', () => {
    const r = computeQR(input({ operatingCarrier: 'QR', distanceMiles: 300, tiers: { QR: 'Silver' } }));
    expect(r.redeemable?.amount).toBe(500); // 500 x (75% + 25%)
    expect(r.status?.amount).toBe(7);
  });

  test('partner metal: real distance, no tier bonus', () => {
    const r = computeQR(input({ fareLevel: 'lowest', tiers: { QR: 'Platinum' } }));
    expect(r.redeemable?.amount).toBe(863); // 3451 x 25%
    expect(r.status?.amount).toBe(10);
  });
});

describe('Qantas Frequent Flyer', () => {
  test('short own-metal flight uses the domestic table with its minimum', () => {
    const r = computeQF(input({ operatingCarrier: 'QF', distanceMiles: 500 }));
    expect(r.redeemable?.amount).toBe(800);
    expect(r.status?.amount).toBe(10);
  });

  test('tier bonus applies to points, never to status credits', () => {
    const r = computeQF(input({ operatingCarrier: 'QF', distanceMiles: 500, tiers: { QF: 'Gold' } }));
    expect(r.redeemable?.amount).toBe(1400);
    expect(r.status?.amount).toBe(10);
  });
});

describe('KrisFlyer', () => {
  test('Singapore Airlines: tier bonus on miles, not on elite miles', () => {
    const r = computeKF(input({ operatingCarrier: 'SQ', cabin: 'Business', fareLevel: 'flex', distanceMiles: 6000, tiers: { KF: 'Elite Gold' } }));
    expect(r.status?.amount).toBe(9000);
    expect(r.redeemable?.amount).toBe(11250);
  });

  test('a gap in a partner chart falls back to the generic ladder', () => {
    const r = computeKF(input({ operatingCarrier: 'VA', cabin: 'Premium Economy', distanceMiles: 1000 }));
    expect(r.redeemable?.amount).toBe(1000);
  });

  test('oneworld carriers earn nothing, including Alaska since its partnership ended in 2025', () => {
    expect(computeKF(input({ operatingCarrier: 'BA' })).relationship).toBe('none');
    expect(computeKF(input({ operatingCarrier: 'AS' })).relationship).toBe('none');
  });
});

describe('runAdvisor', () => {
  test('picks the programme worth the most in £', () => {
    const r = runAdvisor(input({ operatingCarrier: 'SQ', cabin: 'Business', fareLevel: 'flex', distanceMiles: 6000 }));
    expect(r.bestValue?.program).toBe('KF');
    expect(r.bestValueGBP).toBeCloseTo(108); // 9000 miles x 1.2p
  });

  test('nothing earns -> no best value', () => {
    const r = runAdvisor(input({ operatingCarrier: 'OTHER' }));
    expect(r.bestValue).toBeNull();
    expect(r.bestValueGBP).toBe(0);
  });
});
