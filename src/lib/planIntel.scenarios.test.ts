import { describe, expect, it } from 'vitest';
import {
  agentContext, airPassengerDuty, awardCashLabel, awardOptions, forYou, stayInsights, stopOutlook, usualAwardCabin, type PlannedStop,
} from './planIntel';
import { AWARD_ROUTES } from '../data/awardFlights';
import { APD_RATES, CAPITALS } from '../data/airPassengerDuty';
import { makeFlight, makeHotel } from '../test/fixtures';
import type { LoyaltyProgramme, Voucher } from '../types';
import type { CityCashRate, PointsValueProgramme, RealClimateMonth } from './queries';
import type { HotelPlanOption } from './hotelPlanner';
import type { StatusProgress } from './statusProgress';

// Whole trips planned against the user's account as it stood in October
// 2026, checking what the planner would actually tell them.

const prog = (o: Partial<LoyaltyProgramme>): LoyaltyProgramme => ({
  name: 'x', abbr: 'X', points: 0, ptValue: 1, color: '#000', accent: '#000', font: '', shape: '', category: 'airline', ...o,
});
const programmes = [
  prog({ name: 'Avios', points: 67309, ptValue: 1 }),
  prog({ name: 'Virgin Points', points: 24005, ptValue: 1 }),
  prog({ name: 'Singapore KrisFlyer', points: 7553, ptValue: 1.2 }),
  prog({ name: 'KrisFlyer / PPS Club', points: 0, ptValue: 0, tier: 'Elite Gold' }),
  prog({ name: 'Marriott Bonvoy', category: 'hotel', points: 415343, ptValue: 0.5, tier: 'Titanium Elite', nextTier: 'Ambassador', nights: 47 }),
];
const voucher = (o: Partial<Voucher>): Voucher => ({
  id: 'v', name: '', source: '', value: null, earnedDate: '2026-01-01', expiryDate: null, redeemed: false, redeemedDate: null, sourceKey: null, ...o,
});
const vouchers = [
  voucher({ id: 'm40', name: '40,000pt Marriott voucher', source: 'Marriott Titanium choice', value: 200 }),
  voucher({ id: 'm50', name: '50,000pt free night at renewal (£9.5k spent abroad)', source: 'Marriott Debit', value: 250, expiryDate: '2027-12-01' }),
];
// Their reward flights: business, mostly.
const flights = [
  makeFlight({ award: true, cabin: 'Business' }), makeFlight({ award: true, cabin: 'Business' }), makeFlight({ award: true, cabin: 'Business' }),
  makeFlight({ award: false, cabin: 'Economy' }),
];
const account = { programmes, vouchers, flights, hotels: [makeHotel({ country: 'Japan', city: 'Kyoto' })], promotions: [] };
const marriottOption: HotelPlanOption = {
  programme: 'Marriott Bonvoy', tier: 'Titanium Elite', estimatedNightlyGBP: 180, rateSource: 'history', historyCount: 9,
  pointsEarned: 0, pointsValueGBP: 0, benefits: ['Lounge access', 'Free breakfast'], effectiveNightlyGBP: 150,
};
const pointsValue = [{ programme: 'Marriott Bonvoy', avgCentsPerPoint: 0.78, fifthNightFree: true }] as PointsValueProgramme[];
const rate = (country: string, city: string, tier: CityCashRate['tier'], lo: number, hi: number) => ({ country, city, tier, priceLowUsd: lo, priceHighUsd: hi }) as CityCashRate;
const rates = [
  rate('Japan', 'Tokyo', 'mid', 200, 300), rate('Japan', 'Tokyo', 'luxury', 500, 800), rate('Japan', 'Kyoto', 'luxury', 450, 550),
  rate('United States', 'New York', 'mid', 300, 400), rate('United States', 'New York', 'luxury', 700, 1000),
  rate('France', 'Paris', 'mid', 200, 280),
  rate('UAE', 'Dubai', 'mid', 150, 250), rate('UAE', 'Dubai', 'luxury', 400, 600),
];
const progress = { 'Marriott Bonvoy': { targetTier: 'Ambassador', total: 100, currentNights: 47, bookedNights: 6, effectiveTier: 'Titanium Elite' } } as unknown as Record<string, StatusProgress>;
const today = '2026-10-18';
const usdToGbp = 1 / 1.27;

function plan(stops: PlannedStop[], airport: string) {
  const cabin = usualAwardCabin(flights);
  const options = awardOptions(airport, stops[0].country, stops[0].checkIn!, [cabin, 'Economy'], account);
  const stays = stayInsights([marriottOption], stops, account, (n) => progress[n] ?? null, pointsValue, rates, today, usdToGbp);
  return { options, stays, picks: forYou({ flights: options, stays, outlooks: [], cabin }) };
}

describe('planning trips for this account', () => {
  // Both vouchers reach Kyoto's luxury night with a top-up and save the
  // same £74 over their worth (40k + 24,000: £274 against £200; 50k +
  // 14,000: £324 against £250), so it spends the one that expires.
  it('Tokyo and Kyoto in May: Avios cover economy, business is short; keep Titanium; top up the expiring voucher for Kyoto', () => {
    const { picks } = plan([
      { city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2027-05-01' },
      { city: 'Kyoto', country: 'Japan', nights: 8, checkIn: '2027-05-05' },
    ], 'HND');
    expect(picks.map((p) => [p.title, p.sub])).toEqual([
      ['British Airways economy on Avios', '38,500–44,000 · you have 67,309'],
      ['Stay Marriott Bonvoy', '12 of 75 nights to keep Titanium Elite next year · lounge access, free breakfast'],
      ['Top up the 50k free night', 'luxury in Kyoto, ~£394 · ~64,000 pts · +14,000 top-up · £250 to you · expires 1 December 2027'],
    ]);
  });

  it('New York at Christmas: Virgin economy is cheapest at their values, with the Elite Gold lounge', () => {
    const { options, picks } = plan([{ city: 'New York', country: 'United States', nights: 4, checkIn: '2026-12-18' }], 'JFK');
    expect(options.filter((o) => o.covers).map((o) => `${o.airline} ${o.cabin} £${o.costGBP}`)).toEqual(['VS Economy £344', 'BA Economy £350']);
    expect(picks[0]).toEqual({ kind: 'flight', title: 'Virgin Atlantic economy on Virgin Points', sub: '10,000–20,000 + £244 · you have 24,005 · Lounge with Elite Gold' });
    // This year's nights: 53 so far and booked, these 4 more.
    expect(picks[1].sub).toMatch(/^57 of 100 nights to Ambassador/);
  });

  it('A Paris weekend: BA’s own £2.50, never APD on top', () => {
    const { options } = plan([{ city: 'Paris', country: 'France', nights: 2, checkIn: '2026-11-20' }], 'CDG');
    expect(options.map((o) => `${o.airline} ${o.cabin} ${awardCashLabel(o)}`)).toEqual(['BA Economy £2.50']);
    expect(airPassengerDuty('France', 'Economy', '2026-11-20')).toEqual({ band: 'A', amount: 15 });
  });

  // The planner's list says "United Arab Emirates"; the price and climate
  // tables say "UAE". Dubai used to get nothing from either.
  it('Dubai from the full country list still finds the city’s prices and weather', () => {
    const stops = [{ city: 'Dubai', country: 'United Arab Emirates', nights: 3, checkIn: '2027-01-10' }];
    const { stays, options } = plan(stops, 'DXB');
    expect(stays[0].perNight).not.toBeNull();
    expect(options.find((o) => o.airline === 'BA' && o.cabin === 'Business')).toMatchObject({ points: 88000, cash: 249.5 });
    const climate: RealClimateMonth[] = [{
      country: 'UAE', region: 'Dubai', hubStation: 'Dubai', month: 'Jan', tempHighC: 24, tempLowC: 15, tempMeanC: 19, humidityPct: 65, feelsLikeC: 24,
      rainMm: 11, rainyDays: null, sunshineHours: null, seaTempC: null, source: 'test', confidence: 'High',
    }];
    expect(stopOutlook(climate, [], stops[0])?.guide.tempHigh).toBe(24);
    expect(agentContext('United Arab Emirates', '2027-01-10', 3, climate, [], [], 'London').regions).toHaveLength(1);
    expect(airPassengerDuty('United Arab Emirates', 'Economy', '2027-01-10')).toEqual({ band: 'B', amount: 102 });
  });

  it('Singapore: KrisFlyer business is far off; BA economy is covered', () => {
    const { options } = plan([{ city: 'Singapore', country: 'Singapore', nights: 3, checkIn: '2027-02-01' }], 'SIN');
    expect(options.find((o) => o.airline === 'SQ')).toMatchObject({ covers: false, perk: 'Lounge with Elite Gold' });
    expect(options.find((o) => o.airline === 'BA' && o.cabin === 'Economy')).toMatchObject({ covers: true, points: 44000 });
  });

  it('Somewhere with no sourced reward price says nothing about points', () => {
    expect(plan([{ city: 'Lima', country: 'Peru', nights: 5, checkIn: '2027-03-01' }], 'LIM').options).toEqual([]);
    expect(airPassengerDuty('Peru', 'Economy', '2027-03-01')?.band).toBe('C');
  });
});

describe('the sourced tables hold together', () => {
  it('every reward price is positive, peak never below off-peak, cash never negative', () => {
    for (const r of AWARD_ROUTES) {
      for (const [cabin, p] of Object.entries(r.cabins)) {
        const where = `${r.airline} ${r.place} ${cabin}`;
        expect(p!.offPeak, where).toBeGreaterThan(0);
        if (p!.peak != null) expect(p!.peak, where).toBeGreaterThanOrEqual(p!.offPeak);
        if (p!.cash != null) expect(p!.cash, where).toBeGreaterThan(0);
      }
      for (const a of r.airports) expect(a).toMatch(/^[A-Z]{3}$/);
    }
  });
  it('no airline lists an airport twice', () => {
    for (const airline of ['BA', 'QR', 'VS', 'SQ']) {
      const all = AWARD_ROUTES.filter((r) => r.airline === airline).flatMap((r) => r.airports);
      expect(all.length, airline).toBe(new Set(all).size);
    }
  });
  // Airlines that pass taxes on can't charge less than the APD in them.
  it('sourced cash from airlines that pass taxes on is at least the APD', () => {
    const us = AWARD_ROUTES.filter((r) => r.airline === 'VS' && r.airports.includes('JFK'));
    for (const r of us) {
      for (const [cabin, p] of Object.entries(r.cabins)) {
        if (p!.cash == null) continue;
        expect(p!.cash).toBeGreaterThanOrEqual(airPassengerDuty('United States', cabin as 'Economy', '2026-12-01')!.amount);
      }
    }
  });
  it('APD rates only go up, and premium is dearer than economy', () => {
    const [a, b] = APD_RATES;
    for (const band of ['domestic', 'A', 'B', 'C'] as const) {
      expect(b.reduced[band]).toBeGreaterThanOrEqual(a.reduced[band]);
      expect(a.standard[band]).toBeGreaterThan(a.reduced[band]);
    }
  });
  it('every capital is a real coordinate', () => {
    for (const [c, [lat, lng]] of Object.entries(CAPITALS)) {
      expect(Math.abs(lat), c).toBeLessThanOrEqual(90);
      expect(Math.abs(lng), c).toBeLessThanOrEqual(180);
    }
  });
});
