import { describe, expect, it } from 'vitest';
import {
  agentContext, airPassengerDuty, apdBand, awardCashLabel, awardOptions, cityCashRates, forYou, nightsFromBalance,
  pointsPerNight, statusLabel, stayInsights, stayLines, stopOutlook, usualAwardCabin, voucherCap, type StayInsight,
} from './planIntel';
import { nightsForTier } from './statusProgress';
import { makeFlight, makeHotel } from '../test/fixtures';
import type { LoyaltyProgramme, Promotion, Voucher } from '../types';
import type { CityCashRate, PointsValueProgramme, RealClimateMonth, RealCrowdPriceMonth } from './queries';
import type { HotelPlanOption } from './hotelPlanner';
import type { StatusProgress } from './statusProgress';

const prog = (o: Partial<LoyaltyProgramme>): LoyaltyProgramme => ({
  name: 'x', abbr: 'X', points: 0, ptValue: 1, color: '#000', accent: '#000', font: '', shape: '', category: 'airline', ...o,
});

// The user's account as it stood in October 2026.
const programmes = [
  prog({ name: 'Avios', points: 67309, ptValue: 1 }),
  prog({ name: 'Virgin Points', points: 24005, ptValue: 1 }),
  prog({ name: 'Singapore KrisFlyer', points: 7553, ptValue: 1.2 }),
  prog({ name: 'KrisFlyer / PPS Club', points: 0, ptValue: 0, tier: 'Elite Gold' }),
  prog({ name: 'Marriott Bonvoy', category: 'hotel', points: 415343, ptValue: 0.5, tier: 'Titanium Elite', nextTier: 'Ambassador', nights: 47 }),
  prog({ name: 'Hilton Honors', category: 'hotel', points: 63963, ptValue: 0.4, tier: 'Gold', nextTier: 'Diamond', nights: 0 }),
];
const voucher = (o: Partial<Voucher>): Voucher => ({
  id: 'v', name: '', source: '', value: null, earnedDate: '2026-01-01', expiryDate: null, redeemed: false, redeemedDate: null, sourceKey: null, ...o,
});
const vouchers = [
  voucher({ id: 'm40', name: '40,000pt Marriott voucher', source: 'Marriott Titanium choice', expiryDate: '2027-03-01' }),
  voucher({ id: 'm50', name: '50,000pt free night at renewal (£9.5k spent abroad)', source: 'Marriott Debit' }),
];

describe('Air Passenger Duty', () => {
  it('bands by the distance to the capital', () => {
    expect(apdBand('France')).toBe('A');
    expect(apdBand('United States')).toBe('B');
    expect(apdBand('Japan')).toBe('C');
    expect(apdBand('United Kingdom')).toBe('domestic');
  });
  // Nicosia works out at 1,999 miles and Seoul at 5,504, either side of a
  // band edge from where gov.uk puts them: its own list wins.
  it('takes the band gov.uk lists over a worked-out distance near an edge', () => {
    expect(apdBand('Cyprus')).toBe('B');
    expect(apdBand('South Korea')).toBe('B');
  });
  it('gives no band when the distance is too close to an edge to trust', () => {
    expect(apdBand('Mexico')).toBeNull();
    expect(apdBand('Atlantis')).toBeNull();
  });
  it('charges the reduced rate in economy and the standard rate above it, at the rate on the day', () => {
    expect(airPassengerDuty('Japan', 'Economy', '2026-11-01')).toEqual({ band: 'C', amount: 106 });
    expect(airPassengerDuty('Japan', 'Business', '2026-11-01')).toEqual({ band: 'C', amount: 253 });
    expect(airPassengerDuty('United States', 'Economy', '2027-05-01')).toEqual({ band: 'B', amount: 105.33 });
    expect(airPassengerDuty('Spain', 'Premium Economy', '2026-11-01')).toEqual({ band: 'A', amount: 32 });
  });
});

describe('awardOptions', () => {
  it('prices Tokyo on Avios against the balance, with the award class to look for', () => {
    const opts = awardOptions('HND', 'Japan', '2027-04-02', ['Economy', 'Business'], { programmes, vouchers: [] });
    const econ = opts.find((o) => o.airline === 'BA' && o.cabin === 'Economy')!;
    const biz = opts.find((o) => o.airline === 'BA' && o.cabin === 'Business')!;
    expect(econ).toMatchObject({ points: 38500, peakPoints: 44000, covers: true, seats: 1, awardClass: 'X', programme: 'Avios' });
    // No sourced cash for economy: APD is the floor, at the 2027-28 rate
    // since the flight is after 1 April 2027.
    expect(awardCashLabel(econ)).toBe('£109.46 APD + fees');
    expect(biz).toMatchObject({ points: 110000, covers: false, cash: 299.5, cashEstimated: true, awardClass: 'U' });
    expect(awardCashLabel(biz)).toBe('~£299.50');
    // What they can pay for comes first.
    expect(opts[0].covers).toBe(true);
  });

  it('puts the cheaper seat first at the user’s own point values', () => {
    const opts = awardOptions('JFK', 'United States', '2026-12-01', ['Economy'], { programmes, vouchers: [] });
    // Virgin: 10,000 at 1p + £244 = £344; BA: 27,500 at 1p + £75 = £350.
    expect(opts.map((o) => [o.airline, o.costGBP])).toEqual([['VS', 344], ['BA', 350]]);
    expect(opts[0].perk).toBe('Lounge with Elite Gold');
  });

  it('counts two seats on BA with a companion voucher', () => {
    const opts = awardOptions('JFK', 'United States', '2026-12-01', ['Economy'], { programmes, vouchers: [voucher({ name: '2-4-1 companion voucher', source: 'BA Amex Premium Plus' })] });
    expect(opts.find((o) => o.airline === 'BA')).toMatchObject({ companion: true, seats: 4 });
  });

  it('knows nothing about a route with no sourced price', () => {
    expect(awardOptions('LIM', 'Peru', '2026-12-01', ['Economy', 'Business'], { programmes, vouchers: [] })).toEqual([]);
    expect(awardOptions(null, 'Japan', '2026-12-01', ['Economy'], { programmes, vouchers: [] })).toEqual([]);
  });

  it('flags a KrisFlyer seat the balance falls short of, with the status perk', () => {
    const [sq] = awardOptions('SIN', 'Singapore', '2026-12-01', ['Business'], { programmes, vouchers: [] }).filter((o) => o.airline === 'SQ');
    expect(sq).toMatchObject({ points: 108500, balance: 7553, covers: false, apd: 253, cash: null, perk: 'Lounge with Elite Gold' });
  });
});

describe('usualAwardCabin', () => {
  it('is the cabin most often booked on points', () => {
    expect(usualAwardCabin([
      makeFlight({ award: true, cabin: 'Business' }), makeFlight({ award: true, cabin: 'Business' }),
      makeFlight({ award: true, cabin: 'Economy' }), makeFlight({ award: false, cabin: 'Economy' }), makeFlight({ award: false, cabin: 'Economy' }),
    ])).toBe('Business');
    expect(usualAwardCabin([makeFlight({ award: false })])).toBe('Economy');
  });
});

describe('hotel points', () => {
  it('reads a voucher’s cap from its name', () => {
    expect(voucherCap('50,000pt free night at renewal (£9.5k spent abroad)')).toBe(50000);
    expect(voucherCap('40,000pt Marriott voucher')).toBe(40000);
    expect(voucherCap('35k free night')).toBe(35000);
    expect(voucherCap('Free night')).toBeNull();
  });
  it('counts a free fifth night only where the programme gives one', () => {
    expect(nightsFromBalance(100000, 20000, false)).toBe(5);
    // Five nights cost four, six cost five.
    expect(nightsFromBalance(100000, 20000, true)).toBe(6);
    expect(nightsFromBalance(79999, 20000, true)).toBe(3);
  });
  it('turns a cash rate into points at the programme’s average value, to the nearest 500', () => {
    expect(pointsPerNight(250, { avgCentsPerPoint: 0.78 } as PointsValueProgramme)).toBe(32000);
  });
  it('takes every tier from one city', () => {
    const rates = [
      { country: 'Italy', city: 'Rome', tier: 'mid', priceLowUsd: 150, priceHighUsd: 250 },
      { country: 'Italy', city: 'Venice', tier: 'luxury', priceLowUsd: 600, priceHighUsd: 900 },
      { country: 'Italy', city: 'Venice', tier: 'mid', priceLowUsd: 200, priceHighUsd: 300 },
    ] as CityCashRate[];
    expect(cityCashRates(rates, 'Italy', null).map((r) => r.city)).toEqual(['Venice', 'Venice']);
    expect(cityCashRates(rates, 'Italy', 'Rome').map((r) => r.tier)).toEqual(['mid']);
  });
});

describe('stayInsights', () => {
  const options: HotelPlanOption[] = [
    { programme: 'Hilton Honors', tier: 'Gold', estimatedNightlyGBP: 150, rateSource: 'fallback', historyCount: 0, pointsEarned: 0, pointsValueGBP: 0, benefits: ['Free breakfast'], effectiveNightlyGBP: 140 },
    { programme: 'Marriott Bonvoy', tier: 'Titanium Elite', estimatedNightlyGBP: 180, rateSource: 'history', historyCount: 9, pointsEarned: 0, pointsValueGBP: 0, benefits: ['Lounge access', 'Free breakfast'], effectiveNightlyGBP: 150 },
  ];
  const pointsValue = [
    { programme: 'Marriott Bonvoy', avgCentsPerPoint: 0.78, fifthNightFree: true },
    { programme: 'Hilton Honors', avgCentsPerPoint: 0.5, fifthNightFree: true },
  ] as PointsValueProgramme[];
  const rates = [{ country: 'Japan', city: 'Tokyo', tier: 'mid', priceLowUsd: 200, priceHighUsd: 300 }] as CityCashRate[];
  const progress = { 'Marriott Bonvoy': { targetTier: 'Ambassador', total: 100, currentNights: 47, bookedNights: 6 } } as unknown as Record<string, StatusProgress>;
  const fall: Promotion = {
    id: 'fall', title: 'Fall 2026: 1,500 bonus points on stays of 2+ nights', brand: 'Marriott Bonvoy',
    description: 'Paid stays of two or more nights between 22 Sep and 22 Nov 2026. Register by 13 Nov 2026.',
    startDate: '2026-09-22', endDate: '2026-11-22', promoType: 'threshold_bonus', bonusPoints: 1500, multiplier: null, thresholdSpend: null,
    discountValue: null, discountUsed: false, statusNightsBonus: null, statusNightsApplied: false, partnerAirline: null, registered: false,
  };
  const account = { programmes, vouchers, flights: [], hotels: [], promotions: [fall] };

  it('counts nights toward the tier being worked on, the voucher that fits and the promotion bonus', () => {
    const stops = [{ city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2026-11-10' }, { city: 'Kyoto', country: 'Japan', nights: 2, checkIn: '2026-11-14' }];
    const [, marriott] = stayInsights(options, stops, account, (n) => progress[n] ?? null, pointsValue, rates, '2026-10-18');
    expect(marriott.status).toEqual({ target: 'Ambassador', before: 53, after: 59, total: 100, reaches: false, nextYear: false, keep: false });
    expect(marriott.perNight).toBe(32000);
    // 415,343 points at 32,000 a night, every fifth night free: 15 nights
    // cost 12 (384,000), 16 would cost 13 (416,000).
    expect(marriott.nightsCovered).toBe(15);
    expect(marriott.voucher).toEqual({ name: '40,000pt Marriott voucher', cap: 40000, fits: true, expiry: '2027-03-01' });
    expect(marriott.promoPoints).toBe(3000);
  });

  it('starts the count again for a trip next year, and skips a voucher that will have expired', () => {
    const stops = [{ city: 'Tokyo', country: 'Japan', nights: 12, checkIn: '2027-04-02' }];
    const [hilton, marriott] = stayInsights(options, stops, account, (n) => progress[n] ?? null, pointsValue, rates, '2026-10-18');
    // Next year Titanium needs 75 nights again: these are 12 of them.
    expect(marriott.status).toEqual({ target: 'Titanium Elite', before: 0, after: 12, total: 75, reaches: false, nextYear: true, keep: true });
    expect(statusLabel(marriott.status!)).toBe('12 of 75 nights to keep Titanium Elite next year');
    expect(marriott.voucher?.name).toBe('50,000pt free night at renewal (£9.5k spent abroad)');
    expect(marriott.promoPoints).toBe(0);
    expect(hilton.status).toBeNull();
    expect(hilton.perNight).toBe(50000);
  });
});

const climateRow = (month: string, o: Partial<RealClimateMonth> = {}): RealClimateMonth => ({
  country: 'Japan', region: 'Tokyo / Kanto', hubStation: 'Tokyo', month, tempHighC: 22, tempLowC: 14, tempMeanC: 18, humidityPct: 60,
  feelsLikeC: 22, rainMm: 120, rainyDays: null, sunshineHours: null, seaTempC: null, source: 'JMA', confidence: 'High', ...o,
});
const crowdRow = (month: string, crowdLevel: 'low' | 'medium' | 'high', o: Partial<RealCrowdPriceMonth> = {}): RealCrowdPriceMonth => ({
  country: 'Japan', region: null, month, crowdLevel, priceLevel: crowdLevel, driver: '', driverDates: null, driverStartDate: null, driverEndDate: null,
  lunarCalendar: false, source: '', confidence: '', ...o,
} as RealCrowdPriceMonth);

describe('stopOutlook', () => {
  const lisbon = (month: string, o: Partial<RealClimateMonth> = {}) => climateRow(month, { country: 'Portugal', region: 'Lisbon', hubStation: 'Lisbon', tempHighC: 27, rainMm: 10, humidityPct: 60, ...o });
  const climate = [lisbon('Jul'), lisbon('Aug', { tempHighC: 28 }), lisbon('Sep', { tempHighC: 26, rainMm: 30 })];
  const crowd = [
    crowdRow('Jul', 'high', { country: 'Portugal', driver: 'Summer holidays' }),
    crowdRow('Aug', 'high', { country: 'Portugal', driver: 'Summer holidays' }),
    crowdRow('Sep', 'medium', { country: 'Portugal' }),
  ];
  it('finds a quieter month either side of a busy one', () => {
    const o = stopOutlook(climate, crowd, { city: 'Lisbon', country: 'Portugal', nights: 4, checkIn: '2027-08-10' })!;
    expect(o.guide.crowd).toBe('high');
    expect(o.month).toBe(7);
    // July is just as busy, so September.
    expect(o.quieter).toBe(8);
  });
  it('names the holiday a stay lands on', () => {
    const japan = [crowdRow('May', 'high', { driver: 'Golden Week', driverDates: '29 Apr - 5 May', driverStartDate: '2026-04-29', driverEndDate: '2026-05-05' })];
    const o = stopOutlook([], japan, { city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2027-05-01' })!;
    expect(o.guide.crowdDriver).toBe('Golden Week');
    expect(o.guide.crowdDriverDates).toBe('29 Apr - 5 May');
  });
  // June in Tokyo is quieter than Golden Week but it's the rainy season:
  // a quieter month is only offered when the weather is no worse.
  it('never trades crowds for worse weather', () => {
    const japan = [crowdRow('Apr', 'high'), crowdRow('May', 'high'), crowdRow('Jun', 'medium')];
    expect(stopOutlook([], japan, { city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2027-05-08' })!.quieter).toBeNull();
  });
  it('suggests nothing when the stay is not busy', () => {
    expect(stopOutlook(climate, crowd, { city: 'Lisbon', country: 'Portugal', nights: 4, checkIn: '2027-09-10' })!.quieter).toBeNull();
  });
  it('needs a date', () => {
    expect(stopOutlook(climate, crowd, { city: 'Lisbon', country: 'Portugal', nights: 4, checkIn: null })).toBeNull();
  });
});

describe('status lines', () => {
  const st = { target: 'Ambassador', before: 53, after: 59, total: 100, reaches: false, nextYear: false, keep: false };
  it('reads the nights toward a tier, or that it is reached or kept', () => {
    expect(statusLabel(st)).toBe('59 of 100 nights to Ambassador');
    expect(statusLabel({ ...st, after: 100, reaches: true })).toBe('Reaches Ambassador');
    expect(statusLabel({ ...st, target: 'Titanium Elite', before: 0, after: 80, total: 75, reaches: true, nextYear: true, keep: true })).toBe('Keeps Titanium Elite next year');
  });
  it('knows the nights each tier asks for, whatever the tier is called', () => {
    expect(nightsForTier('Marriott Bonvoy', 'Titanium Elite')).toBe(75);
    expect(nightsForTier('IHG One Rewards', 'Silver Elite')).toBe(10);
    expect(nightsForTier('Hilton Honors', 'Gold')).toBeNull();
    expect(nightsForTier('Marriott Bonvoy', null)).toBeNull();
  });
  it('lists status and points under a programme', () => {
    expect(stayLines({ status: st, perNight: 32000, nightsCovered: 15 } as StayInsight)).toEqual(['59 of 100 nights to Ambassador', '~32,000 pts a night · 15 nights on points']);
    expect(stayLines(undefined)).toEqual([]);
  });
});

const stay = (o: Partial<StayInsight>): StayInsight => ({
  programme: 'x', tier: null, nightly: 150, benefits: [], status: null, perNight: null, perNightLuxury: null, nightsCovered: null, voucher: null, promoPoints: 0, ...o,
});

describe('forYou', () => {
  const marriott = stay({
    programme: 'Marriott Bonvoy', tier: 'Titanium Elite', nightly: 180, benefits: ['Lounge access', 'Free breakfast'],
    status: { target: 'Ambassador', before: 53, after: 59, total: 100, reaches: false, nextYear: false, keep: false },
    perNight: 32000, perNightLuxury: 64000, nightsCovered: 15, voucher: { name: '40,000pt Marriott voucher', cap: 40000, fits: true, expiry: '2027-03-01' }, promoPoints: 3000,
  });
  it('leads with the flight they can pay for, then the best-value stay, a voucher and the crowds', () => {
    const flights = awardOptions('HND', 'Japan', '2026-11-10', ['Business', 'Economy'], { programmes, vouchers: [] });
    const items = forYou({
      flights,
      stays: [marriott, stay({ programme: 'Hilton Honors', tier: 'Gold', benefits: ['Free breakfast'], perNight: 50000 })],
      outlooks: [stopOutlook([], [crowdRow('Nov', 'high', { driver: 'Autumn leaves' })], { city: 'Kyoto', country: 'Japan', nights: 2, checkIn: '2026-11-14' })!],
    });
    expect(items.map((i) => i.kind)).toEqual(['flight', 'stay', 'voucher', 'crowds']);
    expect(items[0]).toEqual({ kind: 'flight', title: 'British Airways economy on Avios', sub: '38,500–44,000 + £106 APD + fees · you have 67,309' });
    expect(items[1]).toEqual({ kind: 'stay', title: 'Stay Marriott Bonvoy', sub: '59 of 100 nights to Ambassador · +3,000 promo pts · lounge access, free breakfast' });
    expect(items[2]).toEqual({ kind: 'voucher', title: '40,000-pt free night', sub: '~32,000 mid-range · ~64,000 luxury · expires 1 March 2027' });
    expect(items[3].sub).toBe('Crowds and prices high in Kyoto');
  });
  // A 12-night trip next year "reached" Hyatt Discoverist (10 nights) and
  // was put ahead of Marriott, where the user holds Titanium.
  it('never puts a first tier reached next year ahead of the best-value stay', () => {
    const hyatt = stay({ programme: 'World of Hyatt', status: { target: 'Discoverist', before: 0, after: 12, total: 10, reaches: true, nextYear: true, keep: false } });
    const items = forYou({ flights: [], stays: [{ ...marriott, voucher: null }, hyatt], outlooks: [] });
    expect(items.map((i) => i.title)).toEqual(['Stay Marriott Bonvoy']);
  });
  it('adds another programme’s tier when these nights reach it this year', () => {
    const accor = stay({ programme: 'Accor ALL', status: { target: 'Platinum', before: 55, after: 61, total: 60, reaches: true, nextYear: false, keep: false } });
    const items = forYou({ flights: [], stays: [{ ...marriott, voucher: null }, accor], outlooks: [] });
    expect(items[1]).toEqual({ kind: 'status', title: 'Reach Platinum with Accor ALL', sub: '61 of 60 nights' });
  });
  it('prefers the cabin they usually book when the points cover it', () => {
    const flights = awardOptions('JFK', 'United States', '2026-12-01', ['Economy', 'Business'], { programmes: [...programmes, prog({ name: 'Avios', points: 200000 })], vouchers: [] });
    expect(forYou({ flights, stays: [], outlooks: [], cabin: 'Business' })[0].title).toBe('British Airways business on Avios');
    expect(forYou({ flights, stays: [], outlooks: [] })[0].title).toBe('Virgin Atlantic economy on Virgin Points');
  });
  it('says how far short the balance is', () => {
    const [sq] = awardOptions('SIN', 'Singapore', '2026-12-01', ['Business'], { programmes, vouchers: [] }).filter((o) => o.airline === 'SQ');
    expect(forYou({ flights: [sq], stays: [], outlooks: [] })[0].sub).toBe('108,500 + £253 APD + fees · 100,947 short · Lounge with Elite Gold');
  });
});

describe('agentContext', () => {
  it('gives each region’s weather and crowds in the month of travel, and where they have stayed', () => {
    const climate = [climateRow('Apr'), climateRow('Apr', { region: 'Sapporo / Hokkaido', hubStation: 'Sapporo', tempHighC: 11, rainMm: 54 }), climateRow('May')];
    const crowd = [crowdRow('Apr', 'high', { driver: 'Cherry blossom' })];
    const ctx = agentContext('Japan', '2027-04-02', 12, climate, crowd, [
      makeHotel({ country: 'Japan', city: 'Kyoto' }), makeHotel({ country: 'Japan', city: 'Tokyo' }), makeHotel({ country: 'Japan', city: 'Kyoto' }), makeHotel({ country: 'France', city: 'Paris' }),
    ], 'London');
    expect(ctx.month).toBe('April');
    expect(ctx.regions).toEqual([
      { region: 'Tokyo / Kanto', highC: 22, rainMm: 120, crowd: 'high', price: 'high', event: 'Cherry blossom' },
      { region: 'Sapporo / Hokkaido', highC: 11, rainMm: 54, crowd: 'high', price: 'high', event: 'Cherry blossom' },
    ]);
    expect(ctx.visited).toEqual(['Kyoto', 'Tokyo']);
  });
  it('has no month or regions before a date is picked', () => {
    expect(agentContext('Japan', null, 12, [climateRow('Apr')], [], [], 'London')).toEqual({ month: null, regions: [], visited: [], home: 'London' });
  });
});
