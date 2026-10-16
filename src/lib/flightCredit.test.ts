import { describe, expect, it } from 'vitest';
import { creditPick, flightMiles, tiersFrom } from './flightCredit';
import { makeFlight } from '../test/fixtures';

const places: Record<string, { lat: number; lng: number }> = {
  BUD: { lat: 47.4369, lng: 19.2556 },
  WAW: { lat: 52.1657, lng: 20.9671 },
  LHR: { lat: 51.47, lng: -0.4543 },
};
const locate = (c: string) => places[c] ?? null;

describe('flightMiles', () => {
  it('adds up each leg through the stops', () => {
    const direct = flightMiles({ from: 'BUD', via: [], to: 'LHR' }, locate)!;
    const viaWarsaw = flightMiles({ from: 'BUD', via: ['WAW'], to: 'LHR' }, locate)!;
    expect(viaWarsaw).toBeGreaterThan(direct);
    expect(flightMiles({ from: 'BUD', via: [], to: 'XXX' }, locate)).toBeNull();
  });
});

describe('creditPick', () => {
  const tiers = tiersFrom([{ name: 'KrisFlyer / PPS Club', tier: 'Elite Gold' }, { name: 'Avios', tier: undefined }]);

  it('reads elite tiers from the programmes as they are stored', () => {
    expect(tiers).toEqual({ KF: 'Elite Gold' });
  });

  it('sends a LOT (Star Alliance) flight to KrisFlyer', () => {
    const lot = makeFlight({ from: 'BUD', via: ['WAW'], to: 'LHR', airline: 'LOT Polish Airlines', flightNo: 'LO538/LO285', cost: 118.09 });
    const pick = creditPick(lot, flightMiles(lot, locate), tiers, false);
    expect(pick?.label).toBe('KrisFlyer');
    expect(pick!.amount).toBeGreaterThan(0);
  });

  it("gives no answer for a BA flight with no price: its Avios depend on what was paid", () => {
    const ba = makeFlight({ from: 'LHR', to: 'BUD', airline: 'British Airways', flightNo: 'BA870', cost: null });
    expect(creditPick(ba, 900, tiers, true)).toBeNull();
  });

  it('gives no answer for an award seat', () => {
    const award = makeFlight({ airline: 'Qatar Airways', flightNo: 'QR304', award: true, cabin: 'Business' });
    expect(creditPick(award, 4800, tiers, false)).toBeNull();
  });
});
