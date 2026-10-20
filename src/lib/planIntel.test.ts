import { describe, expect, it } from 'vitest';
import {
  agentContext, airPassengerDuty, apdBand, awardCashLabel, awardOptions, awardPointsLabel, seasonOn, cityCashRates, forYou, nightsFromBalance,
  eventPrices, holidayLine, measuredCash, memberCash, schoolLine, schoolNote, nightPoints, nightsRange, pointsPerNight, seasonalCashUsd, shortDriver, stopPriceLevel, statusLabel, stayInsights, stayLines, stopOutlook, usualAwardCabin, voucherAdvice, voucherCap, voucherLine, type StayInsight,
  type VoucherAdvice,
} from './planIntel';
import { nightsForTier } from './statusProgress';
import { makeFlight, makeHotel } from '../test/fixtures';
import type { LoyaltyProgramme, Promotion, Voucher } from '../types';
import type { CityCashRate, PointsValueProgramme, RealClimateMonth, RealCrowdPriceMonth } from './queries';
import type { HotelPlanOption } from './hotelPlanner';
import type { StatusProgress } from './statusProgress';
import type { PriceSearch } from './hotelPrices';

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
  // Band A is a list, not a distance: Cyprus was put in B for sitting
  // 2,150 miles out, but every EU country is A; Egypt is nearer than some
  // of the list yet was never on it.
  it('puts the EU, EEA and gov.uk’s named places in A, whatever the distance', () => {
    expect(apdBand('Cyprus')).toBe('A');
    expect(apdBand('Iceland')).toBe('A');
    expect(apdBand('Türkiye')).toBe('A');
    expect(apdBand('Morocco')).toBe('A');
    expect(apdBand('Egypt')).toBe('B');
    expect(apdBand('Israel')).toBe('B');
  });
  it('takes the band gov.uk lists over a worked-out distance near 5,500 miles', () => {
    expect(apdBand('South Korea')).toBe('B');
    expect(apdBand('Brazil')).toBe('B');
    expect(apdBand('South Africa')).toBe('C');
    expect(apdBand('Mexico')).toBe('C');
  });
  it('gives no band when it can’t be sure', () => {
    // 5,495 miles: too close to the edge to call.
    expect(apdBand('Botswana')).toBeNull();
    // Only west of the Urals is A.
    expect(apdBand('Russia')).toBeNull();
    expect(apdBand('Atlantis')).toBeNull();
  });
  it('has a band for every country the climate data covers', () => {
    const countries = ['Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Cambodia', 'Canada', 'Chile', 'China', 'Costa Rica',
      'Croatia', 'Cuba', 'Czech Republic', 'Denmark', 'Dominican Republic', 'Egypt', 'Fiji', 'Finland', 'France', 'Germany', 'Greece', 'Hong Kong',
      'Iceland', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Malaysia', 'Maldives', 'Mexico', 'Morocco',
      'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Saudi Arabia',
      'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan', 'Tanzania', 'Thailand', 'Türkiye', 'UAE',
      'United Kingdom', 'United States', 'Vietnam'];
    expect(countries.filter((c) => apdBand(c) == null)).toEqual([]);
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
    // BA sets its own cash part and pays the taxes out of it, so with no
    // sourced figure for economy there's nothing to show. It used to show
    // "£109.46 APD + fees", which BA's cash can come in under.
    expect(econ.apd).toBeNull();
    expect(awardCashLabel(econ)).toBeNull();
    expect(biz).toMatchObject({ points: 110000, covers: false, cash: 299.5, cashEstimated: true, awardClass: 'U' });
    expect(awardCashLabel(biz)).toBe('~£299.50');
    // What they can pay for comes first.
    expect(opts[0].covers).toBe(true);
  });

  it('shows APD as the least the cash can be where the airline passes taxes on', () => {
    const qrEcon = awardOptions('BKK', 'Thailand', '2026-12-01', ['Economy'], { programmes, vouchers: [] }).find((o) => o.airline === 'QR')!;
    expect(awardCashLabel(qrEcon)).toBe('£106 APD + fees');
    // BA's own cash part, sourced: £2.50 to Amsterdam, though APD is £15.
    const baAms = awardOptions('AMS', 'Netherlands', '2026-12-01', ['Economy'], { programmes, vouchers: [] })[0];
    expect(awardCashLabel(baAms)).toBe('£2.50');
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

  // Paris resolved to Le Bourget, so no route matched; the agent's own
  // pick (CDG) is tried as well.
  it('matches a route on any of the airports given for the place', () => {
    const opts = awardOptions(['LBG', 'CDG'], 'France', '2026-12-01', ['Economy'], { programmes, vouchers: [] });
    expect(opts.map((o) => `${o.airline} ${o.points}`)).toEqual(['BA 10000']);
    expect(awardOptions([null, null], 'France', '2026-12-01', ['Economy'], { programmes, vouchers: [] })).toEqual([]);
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

describe('seasonOn', () => {
  it('reads BA’s 2026 calendar, and says nothing where it isn’t sure', () => {
    expect(seasonOn('BA', '2026-08-15')).toBe('peak');
    expect(seasonOn('BA', '2026-11-10')).toBe('off-peak');
    // Sources disagree on 6-9 July and 11 and 13 December.
    expect(seasonOn('BA', '2026-07-07')).toBeNull();
    expect(seasonOn('BA', '2026-12-13')).toBeNull();
    // BA hasn't published 2027.
    expect(seasonOn('BA', '2027-05-01')).toBeNull();
  });
  it('reads Virgin’s windows, which differ for the Caribbean', () => {
    expect(seasonOn('VS', '2026-12-01')).toBe('off-peak');
    expect(seasonOn('VS-Caribbean', '2026-12-01')).toBe('peak');
    expect(seasonOn('VS', '2027-02-01')).toBeNull();
    expect(seasonOn(null, '2026-12-01')).toBeNull();
  });
  it('prices the seat on the day, or as at least the off-peak price when the peak price isn’t known', () => {
    const [vs] = awardOptions('MLE', 'Maldives', '2026-12-20', ['Economy'], { programmes, vouchers: [] });
    expect(vs).toMatchObject({ season: 'peak', atLeast: true, points: 12500 });
    expect(awardPointsLabel(vs)).toBe('12,500+ peak');
    const [ba] = awardOptions('HND', 'Japan', '2027-05-01', ['Economy'], { programmes, vouchers: [] });
    expect(awardPointsLabel(ba)).toBe('38,500–44,000');
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

describe('pricing a night in points, programme by programme', () => {
  const market = {
    usdToEur: 1.17 / 1.27,
    pointsValue: [
      { programme: 'World of Hyatt', avgCentsPerPoint: 1.6 }, { programme: 'Marriott Bonvoy', avgCentsPerPoint: 0.78 },
      { programme: 'IHG One Rewards', avgCentsPerPoint: 0.55 }, { programme: 'Hilton Honors', avgCentsPerPoint: 0.5 },
    ] as PointsValueProgramme[],
  };
  it('Accor: 2,000 points per €40 off, in whole blocks', () => {
    // $250 is €230.31: six blocks of €40.
    expect(nightPoints('Accor ALL', 250, null, market)).toMatchObject({ points: 12000, model: 'fixed-value' });
  });
  it('Hyatt: the chart category whose Moderate price fits, at the season’s level', () => {
    // $250 at 1.6c is ~15,600 points: Category 3 (Moderate 15,000).
    expect(nightPoints('World of Hyatt', 250, null, market)).toEqual({ points: 15000, low: 8000, high: 20000, model: 'chart', category: 3, level: 'Moderate', capped: false });
    expect(nightPoints('World of Hyatt', 250, 'low', market)).toMatchObject({ points: 12000, level: 'Low' });
    // $650 is ~40,600: Category 7, Upper in a busy month.
    expect(nightPoints('World of Hyatt', 650, 'high', market)).toMatchObject({ points: 45000, category: 7, level: 'Upper' });
  });
  it('Marriott and IHG: dynamic, tracking cash, no cap', () => {
    expect(nightPoints('Marriott Bonvoy', 250, null, market)).toMatchObject({ points: 32000, model: 'dynamic', capped: false });
    expect(nightPoints('IHG One Rewards', 250, null, market)?.points).toBe(45500);
  });
  it('Hilton: dynamic, but never over the 250,000 standard-room cap', () => {
    expect(nightPoints('Hilton Honors', 1500, null, market)).toMatchObject({ points: 250000, capped: true });
  });
  it('knows nothing without the programme’s value per point', () => {
    expect(nightPoints('Unknown Rewards', 250, null, market)).toBeNull();
  });
  it('lists a Hyatt night by its category and range', () => {
    const pricing = nightPoints('World of Hyatt', 250, null, market);
    expect(stayLines({ perNight: 15000, pricing, nightsCovered: null } as StayInsight)).toEqual(['~Cat 3 · 15,000 pts (8,000–20,000) a night']);
  });

  // A Golden Week night was priced like one in January: the middle of
  // the city's range in every month.
  it('takes the top of a city’s range in a dear month and the bottom in a cheap one', () => {
    const rate = { country: 'Japan', city: 'Tokyo', tier: 'mid', priceLowUsd: 100, priceHighUsd: 213 } as CityCashRate;
    expect(seasonalCashUsd(rate, 'high')).toBe(213);
    expect(seasonalCashUsd(rate, 'low')).toBe(100);
    expect(seasonalCashUsd(rate, null)).toBe(156.5);
    const crowd = [crowdRow('May', 'high', { driver: 'Golden Week' }), crowdRow('Jan', 'low')];
    expect(stopPriceLevel(crowd, { city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2027-05-01' })).toBe('high');
    expect(stopPriceLevel(crowd, { city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2027-01-10' })).toBe('low');
    expect(stopPriceLevel(crowd, { city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2027-03-10' })).toBeNull();
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

  const usdToGbp = 1 / 1.27;

  it('counts nights toward the tier being worked on, the voucher to use and the promotion bonus', () => {
    const stops = [{ city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2026-11-10' }, { city: 'Kyoto', country: 'Japan', nights: 2, checkIn: '2026-11-14' }];
    const [, marriott] = stayInsights(options, stops, account, (n) => progress[n] ?? null, { rates, crowd: [], pointsValue, usdToGbp, usdToEur: 1.17 / 1.27 }, '2026-10-18');
    expect(marriott.status).toEqual({ target: 'Ambassador', before: 53, after: 59, total: 100, reaches: false, nextYear: false, keep: false });
    expect(marriott.perNight).toBe(32000);
    // 415,343 points at 32,000 a night, every fifth night free: 15 nights
    // cost 12 (384,000), 16 would cost 13 (416,000).
    expect(marriott.nightsCovered).toBe(15);
    // The 40k voucher runs out in March, so a £197 night (under its £200
    // worth) is still worth spending it on; the 50k doesn't expire.
    // £192: the £197 night at Marriott's member rate, 2.5% under.
    expect(marriott.voucher).toMatchObject({ id: 'm40', verdict: 'use-soon', best: { city: 'Tokyo', tier: 'mid', points: 32000, topUp: 0, cashGBP: 192, worthGBP: 192 } });
    expect(marriott.promoPoints).toBe(3000);
  });

  it('starts the count again for a trip next year, and skips a voucher that will have expired', () => {
    const stops = [{ city: 'Tokyo', country: 'Japan', nights: 12, checkIn: '2027-04-02' }];
    const [hilton, marriott] = stayInsights(options, stops, account, (n) => progress[n] ?? null, { rates, crowd: [], pointsValue, usdToGbp, usdToEur: 1.17 / 1.27 }, '2026-10-18');
    // Next year Titanium needs 75 nights again: these are 12 of them.
    expect(marriott.status).toEqual({ target: 'Titanium Elite', before: 0, after: 12, total: 75, reaches: false, nextYear: true, keep: true });
    expect(statusLabel(marriott.status!)).toBe('12 of 75 nights to keep Titanium Elite next year');
    // The 40k has expired by then; the 50k is worth £250 and the best
    // night here saves £197, so keep it.
    expect(marriott.voucher).toMatchObject({ id: 'm50', verdict: 'keep', parGBP: 250 });
    expect(marriott.promoPoints).toBe(0);
    expect(hilton.status).toBeNull();
    expect(hilton.perNight).toBe(50000);
  });
});

describe('voucherAdvice', () => {
  const marriott = programmes.find((p) => p.name === 'Marriott Bonvoy')!; // 0.5p a point
  const value = { programme: 'Marriott Bonvoy', avgCentsPerPoint: 0.78 } as PointsValueProgramme;
  const usdToGbp = 1 / 1.27;
  const rates = [
    { country: 'Japan', city: 'Tokyo', tier: 'budget', priceLowUsd: 100, priceHighUsd: 140 },
    { country: 'Japan', city: 'Tokyo', tier: 'mid', priceLowUsd: 200, priceHighUsd: 300 },
    { country: 'Japan', city: 'Tokyo', tier: 'luxury', priceLowUsd: 500, priceHighUsd: 800 },
    { country: 'Japan', city: 'Kyoto', tier: 'mid', priceLowUsd: 180, priceHighUsd: 260 },
    { country: 'Japan', city: 'Kyoto', tier: 'luxury', priceLowUsd: 450, priceHighUsd: 550 },
  ] as CityCashRate[];
  // After Golden Week, which has measured prices of its own.
  const tokyo = { city: 'Tokyo', country: 'Japan', nights: 4, checkIn: '2027-05-20' };
  const kyoto = { city: 'Kyoto', country: 'Japan', nights: 3, checkIn: '2027-05-24' };
  const forty = voucher({ id: 'v40', name: '40,000pt Marriott voucher', value: 200 });
  const mk = (v: PointsValueProgramme | null, r: CityCashRate[]) => ({ rates: r, crowd: [], pointsValue: v ? [v] : [], usdToGbp, usdToEur: 1.17 / 1.27 });

  // A 40k voucher was once suggested for a 20k night: half of it thrown
  // away. A mid-range Tokyo night (~32,000 pts, ~£197) doesn't use it to
  // its £200 worth, and there's no rush, so keep it.
  it('keeps a voucher when the best night here is worth less than the voucher', () => {
    const a = voucherAdvice(forty, marriott, [tokyo], mk(value, rates))!;
    expect(a).toMatchObject({ verdict: 'keep', parGBP: 200, neededGBP: 200, best: { city: 'Tokyo', tier: 'mid', points: 32000, cashGBP: 192 } });
    expect(voucherLine(a)).toEqual({ title: 'Keep the 40k free night', sub: 'best here mid-range in Tokyo, ~£192 · £200 to you' });
  });

  // Kyoto's luxury night is ~64,000 points: over the 40k cap, but within
  // Marriott's 25,000 top-up. £384 of hotel (member rate) for 24,000
  // points (£120 at 0.5p) beats the voucher's £200 worth.
  it('stretches it with a top-up when that gets the better night', () => {
    const a = voucherAdvice(forty, marriott, [tokyo, kyoto], mk(value, rates))!;
    expect(a).toMatchObject({ verdict: 'top-up', best: { city: 'Kyoto', tier: 'luxury', points: 64000, topUp: 24000, cashGBP: 384, worthGBP: 264 } });
    expect(voucherLine(a).title).toBe('Top up the 40k free night');
    expect(voucherLine(a).sub).toBe('luxury in Kyoto, ~£384 · ~64,000 pts · +24,000 top-up · £200 to you');
  });

  // A 50k voucher was spent on a 27,500-point night seven months before
  // it expired; it now asks its full worth until the last six months.
  it('asks less of a night only in the voucher’s last six months', () => {
    const fifty = voucher({ id: 'v50', name: '50,000pt free night', value: 250, expiryDate: '2027-12-01' });
    // Six and a half months out: still the full £250, so a £192 night doesn't do.
    expect(voucherAdvice(fifty, marriott, [tokyo], mk(value, rates))).toMatchObject({ verdict: 'keep', neededGBP: 250 });
    // Under two and a half months out (73 days): about 40% of its worth will do.
    const a = voucherAdvice({ ...fifty, expiryDate: '2027-08-01' }, marriott, [tokyo], mk(value, rates))!;
    expect(a.neededGBP).toBe(100);
    expect(a).toMatchObject({ verdict: 'use-soon', best: { tier: 'mid', worthGBP: 192 } });
    expect(voucherLine(a).title).toBe('Use the 50k free night before it goes');
  });

  it('only counts stops before it expires', () => {
    const a = voucherAdvice({ ...forty, expiryDate: '2027-05-22' }, marriott, [tokyo, kyoto], mk(value, rates))!;
    expect(a.best?.city).toBe('Tokyo');
  });

  it('says so when no night here fits even topped up', () => {
    const dear = [{ country: 'Japan', city: 'Tokyo', tier: 'luxury', priceLowUsd: 900, priceHighUsd: 1100 }] as CityCashRate[];
    expect(voucherAdvice(forty, marriott, [tokyo], mk(value, dear))).toMatchObject({ verdict: 'too-dear', best: null });
  });

  it('works out its worth from the cap when the user hasn’t valued it', () => {
    expect(voucherAdvice(voucher({ name: '35k free night' }), marriott, [tokyo], mk(value, rates))!.parGBP).toBe(175);
  });

  it('needs a cap it can read and the programme’s point value', () => {
    expect(voucherAdvice(voucher({ name: 'Free night' }), marriott, [tokyo], mk(value, rates))).toBeNull();
    expect(voucherAdvice(forty, marriott, [tokyo], mk(null, rates))).toBeNull();
  });
});

describe('measured event prices', () => {
  const stop = (city: string, country: string, checkIn: string, nights: number) => ({ city, country, checkIn, nights });
  it('takes the programme’s own hotels, its sub-brands included', () => {
    // Dubai over New Year: 5 hotels with "Marriott" in the name, then 7
    // Sheratons and Four Points and 3 Le Méridiens, all Marriott.
    expect(eventPrices(stop('Dubai', 'United Arab Emirates', '2026-12-31', 2), 'Marriott Bonvoy')).toEqual({ event: 'New Year', programme: 'Marriott Bonvoy', ratio: 2.4, hotels: 15, baseline: ['2027-01-13', '2027-01-16'] });
    // New York's Manhattan Marriotts had no rates; its Moxys and Sheratons did.
    expect(eventPrices(stop('New York', 'United States', '2026-12-31', 1), 'Marriott Bonvoy')).toMatchObject({ programme: 'Marriott Bonvoy', ratio: 2.35, hotels: 15 });
    // Tokyo's Marriott, JW, Courtyard and Sheraton were all cheaper in Golden Week.
    expect(eventPrices(stop('Tokyo', 'Japan', '2027-05-02', 3), 'Marriott Bonvoy')).toMatchObject({ ratio: 0.83, hotels: 4 });
  });
  it('finds other programmes’ hotels in the 4-5★ searches', () => {
    // Sydney's Mercure and Novotel at New Year.
    expect(eventPrices(stop('Sydney', 'Australia', '2026-12-31', 1), 'Accor ALL')).toMatchObject({ programme: 'Accor ALL', ratio: 3.9, hotels: 2 });
  });
  it('takes every hotel when the programme has fewer than two', () => {
    // Milan's one Hyatt isn't the brand's pricing in Milan.
    expect(eventPrices(stop('Milan', 'Italy', '2027-04-13', 2), 'World of Hyatt')).toMatchObject({ programme: null, ratio: 3.05, hotels: 7 });
    expect(eventPrices(stop('Tokyo', 'Japan', '2027-05-02', 3), 'World of Hyatt')).toMatchObject({ programme: null, ratio: 0.91, hotels: 9 });
    expect(eventPrices(stop('Barcelona', 'Spain', '2027-03-01', 2), 'World of Hyatt')).toMatchObject({ programme: null, ratio: 2.82, hotels: 11 });
  });
  it('finds Barcelona’s Marriotts once every sub-brand is searched by name', () => {
    // "Marriott Barcelona" found nothing, so MWC was priced from two
    // independents. Searched as W, EDITION, Autograph Collection, Moxy,
    // Tribute Portfolio and Sheraton (a Four Points), six Marriotts were
    // priced for both windows, at 3.85x the plain nights.
    expect(eventPrices(stop('Barcelona', 'Spain', '2027-03-01', 2), 'Marriott Bonvoy')).toMatchObject({ programme: 'Marriott Bonvoy', ratio: 3.85, hotels: 6 });
  });
  it('counts a hotel found by two searches once', () => {
    // Singapore's St. Regis and Four Points came back in both the Marriott and the 4-5★ search.
    expect(eventPrices(stop('Singapore', 'Singapore', '2027-02-06', 2))?.hotels).toBe(9);
  });
  it('knows the big events from the wider sampling', () => {
    expect(eventPrices(stop('Abu Dhabi', 'United Arab Emirates', '2026-12-04', 2), 'Marriott Bonvoy')).toMatchObject({ event: 'Grand Prix', ratio: 4.22, hotels: 6 });
    expect(eventPrices(stop('Edinburgh', 'United Kingdom', '2026-12-31', 1), 'Marriott Bonvoy')).toMatchObject({ ratio: 4.1, hotels: 6 });
    expect(eventPrices(stop('Milan', 'Italy', '2027-04-13', 2), 'Marriott Bonvoy')?.ratio).toBe(2.88);
    expect(eventPrices(stop('Rio de Janeiro', 'Brazil', '2027-02-06', 3))).toMatchObject({ event: 'Carnival', programme: null, ratio: 3.05, hotels: 8 });
    // And the ones that barely move, or go the other way.
    expect(eventPrices(stop('Las Vegas', 'United States', '2026-11-20', 2), 'Marriott Bonvoy')?.ratio).toBe(0.97);
    expect(eventPrices(stop('Bangkok', 'Thailand', '2027-04-13', 2), 'Marriott Bonvoy')).toMatchObject({ ratio: 1.01, hotels: 10 });
    expect(eventPrices(stop('Rome', 'Italy', '2027-03-26', 2), 'Marriott Bonvoy')?.ratio).toBe(0.82);
    expect(eventPrices(stop('Paris', 'France', '2026-12-20', 2), 'Marriott Bonvoy')).toMatchObject({ ratio: 0.85, hotels: 10 });
  });
  it('tells New Year from the week before Christmas in the same city', () => {
    expect(eventPrices(stop('New York', 'United States', '2026-12-31', 1))).toMatchObject({ event: "New Year's Eve", ratio: 2.55, hotels: 18 });
    expect(eventPrices(stop('New York', 'United States', '2026-12-19', 2))?.event).toBe('Week before Christmas');
  });
  it('says nothing where nothing was measured', () => {
    expect(eventPrices(stop('Tokyo', 'Japan', '2027-05-20', 3))).toBeNull();
    expect(eventPrices(stop('Osaka', 'Japan', '2027-05-02', 3))).toBeNull();
    expect(eventPrices(stop('Tokyo', 'Japan', '2027-05-05', 2))).toBeNull(); // checks in the morning it ends
  });
  it('prices Marriott cash at the member rate', () => {
    expect(memberCash('Marriott Bonvoy', 200)).toBe(195);
    expect(memberCash('Hilton Honors', 200)).toBe(200);
  });
  it('shows a measured event and a holiday in For you', () => {
    const items = forYou({
      flights: [], stays: [stay({ programme: 'Marriott Bonvoy' })], stops: [stop('Dubai', 'UAE', '2026-12-30', 3)],
      outlooks: [{ ...stopOutlook([], [], stop('Tokyo', 'Japan', '2027-05-01', 4), [{ date: '2027-05-03', name: 'Constitution Memorial Day', localName: '', global: true, types: [] }])! }].filter((o) => o.guide),
    });
    expect(items.find((i) => i.kind === 'prices')).toEqual({ kind: 'prices', title: 'New Year in Dubai', sub: 'Marriott +140% on 13–15 Jan · 15 hotels' });
    // Every hotel, when the programme had too few: no programme named.
    const rio = forYou({ flights: [], stays: [stay({ programme: 'World of Hyatt' })], stops: [stop('Rio de Janeiro', 'Brazil', '2027-02-06', 3)], outlooks: [] });
    expect(rio.find((i) => i.kind === 'prices')?.sub).toBe('+205% on 19–23 Feb · 8 hotels');
  });
  it('writes holidays and nights short', () => {
    const hol = (date: string, name: string) => ({ date, name, localName: '', global: true, types: [] });
    expect(holidayLine([hol('2027-05-03', 'Constitution Memorial Day'), hol('2027-05-04', 'Greenery Day')])).toBe('Constitution Memorial Day, 3 May (long weekend) · +1 more');
    expect(holidayLine([])).toBeNull();
    expect(nightsRange(['2026-12-30', '2027-01-02'])).toBe('30 Dec–1 Jan');
    expect(nightsRange(['2027-01-13', '2027-01-16'])).toBe('13–15 Jan');
  });
});

describe('school holidays', () => {
  const sch = (start: string, end: string, name: string, regions: string[]) => ({ start, end, name, regions, nationwide: false });
  const mainland = ['FR-ZA', 'FR-ZB', 'FR-ZC', 'FR-IF', 'FR-AR'];
  const france = [
    sch('2026-12-20', '2027-01-03', 'Christmas Holidays', mainland),
    sch('2027-02-07', '2027-02-21', 'Winter Holidays', ['FR-ZC', 'FR-IF']),
  ];
  const climate = () => ['Dec', 'Feb'].map((m) => climateRow(m, { country: 'France', region: 'Paris / Île-de-France', hubStation: 'Paris' }));
  const paris = (checkIn: string) => stopOutlook(climate(), [], { city: 'Paris', country: 'France', nights: 3, checkIn }, [], france)!;

  it('writes a school break on one line', () => {
    expect(schoolLine({ name: 'Christmas Holidays', start: '2026-12-20', end: '2027-01-03', reach: 'all' })).toBe('Christmas Holidays, 20 Dec–3 Jan · nationwide');
    expect(schoolLine({ name: 'Winter Holidays', start: '2027-02-07', end: '2027-02-21', reach: 'some' })).toBe('Winter Holidays, 7–21 Feb · some regions');
    expect(schoolLine(null)).toBeNull();
  });
  it('doesn’t repeat a break the crowd note already names', () => {
    const xmas = { name: 'Christmas Holidays', start: '2026-12-20', end: '2027-01-03', reach: 'all' as const };
    expect(schoolNote(xmas, 'Christmas school holidays, all zones')).toBeNull();
    expect(schoolNote(xmas, 'Christmas markets')).toBe('Christmas Holidays, 20 Dec–3 Jan · nationwide');
  });
  it('puts schools off across the country in For you, not one region’s break', () => {
    const christmas = paris('2026-12-27');
    expect(christmas.school?.reach).toBe('all');
    expect(forYou({ flights: [], stays: [], outlooks: [christmas] }).find((i) => i.kind === 'school'))
      .toEqual({ kind: 'school', title: 'School holidays in Paris', sub: 'Christmas Holidays, 20 Dec–3 Jan · nationwide' });
    const winter = paris('2027-02-08');
    expect(winter.school?.reach).toBe('some');
    expect(forYou({ flights: [], stays: [], outlooks: [winter] }).find((i) => i.kind === 'school')).toBeUndefined();
  });
  it('tells the agent', () => {
    expect(agentContext('France', '2026-12-27', 5, [], [], [], 'London', [], france).school)
      .toEqual([{ name: 'Christmas Holidays', start: '2026-12-20', end: '2027-01-03', reach: 'all' }]);
  });
});

describe('status next year', () => {
  const opt = (programme: string, tier: string): HotelPlanOption => ({
    programme, tier, estimatedNightlyGBP: 150, rateSource: 'fallback', historyCount: 0, pointsEarned: 0, pointsValueGBP: 0, benefits: [], effectiveNightlyGBP: 150,
  });
  const market = { rates: [], crowd: [], pointsValue: [], usdToGbp: 1 / 1.27, usdToEur: 1.17 / 1.27 };
  const stops = [{ city: 'Tokyo', country: 'Japan', nights: 12, checkIn: '2027-05-01' }];
  const account = { programmes: [prog({ name: 'IHG One Rewards', category: 'hotel', tier: 'Member' }), prog({ name: 'Accor ALL', category: 'hotel', tier: 'Gold' })], vouchers: [], flights: [], hotels: [], promotions: [] };
  // IHG Platinum comes with the card: it showed "12 of 40 nights to keep
  // Platinum". Keeping it needs no nights; Diamond is the aim.
  it('aims past a tier a card grants', () => {
    const progress = { targetTier: 'Diamond', total: 70, currentNights: 0, bookedNights: 0, effectiveTier: 'Platinum', cardGrantedTier: 'Platinum', breakdown: { membership: 0 } } as unknown as StatusProgress;
    const [ihg] = stayInsights([opt('IHG One Rewards', 'Platinum')], stops, account, () => progress, market, '2026-10-18');
    expect(statusLabel(ihg.status!)).toBe('12 of 70 nights to Diamond next year');
  });
  // Accor+ Explorer's 30 nights a year keep Gold on their own.
  it('counts a membership’s yearly nights, and aims past a tier they keep', () => {
    const progress = { targetTier: 'Platinum', total: 60, currentNights: 37, bookedNights: 0, effectiveTier: 'Gold', cardGrantedTier: null, breakdown: { membership: 30 } } as unknown as StatusProgress;
    const [accor] = stayInsights([opt('Accor ALL', 'Gold')], stops, account, () => progress, market, '2026-10-18');
    expect(statusLabel(accor.status!)).toBe('42 of 60 nights to Platinum next year');
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

describe('shortDriver', () => {
  it('cuts a crowd driver to its first clause', () => {
    expect(shortDriver('Christmas/New Year surge; heaviest days around 20, 27 and 30 Dec')).toBe('Christmas/New Year surge');
    expect(shortDriver('Dubai Shopping Festival, peak winter weather (20-28C), hotel rates 30-50% above summer')).toBe('Dubai Shopping Festival, peak winter weather');
    expect(shortDriver('Golden Week')).toBe('Golden Week');
  });
});

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
  programme: 'x', tier: null, nightly: 150, benefits: [], status: null, perNight: null, perNightLuxury: null, pricing: null, measured: null, nightsCovered: null, voucher: null, promoPoints: 0, ...o,
});

describe('forYou', () => {
  const marriott = stay({
    programme: 'Marriott Bonvoy', tier: 'Titanium Elite', nightly: 180, benefits: ['Lounge access', 'Free breakfast'],
    status: { target: 'Ambassador', before: 53, after: 59, total: 100, reaches: false, nextYear: false, keep: false },
    perNight: 32000, perNightLuxury: 64000, nightsCovered: 15, promoPoints: 3000,
    voucher: {
      id: 'm40', name: '40,000pt Marriott voucher', programme: 'Marriott Bonvoy', cap: 40000, expiry: '2027-03-01', verdict: 'use-soon',
      best: { city: 'Tokyo', tier: 'mid', points: 32000, topUp: 0, cashGBP: 197, worthGBP: 197 }, parGBP: 200, neededGBP: 62, monthsLeft: 3.7,
    } satisfies VoucherAdvice,
  });
  it('leads with the flight they can pay for, then the best-value stay, a voucher and the crowds', () => {
    const flights = awardOptions('HND', 'Japan', '2026-11-10', ['Business', 'Economy'], { programmes, vouchers: [] });
    const items = forYou({
      flights,
      stays: [marriott, stay({ programme: 'Hilton Honors', tier: 'Gold', benefits: ['Free breakfast'], perNight: 50000 })],
      outlooks: [stopOutlook([], [crowdRow('Nov', 'high', { driver: 'Autumn leaves' })], { city: 'Kyoto', country: 'Japan', nights: 2, checkIn: '2026-11-14' })!],
    });
    expect(items.map((i) => i.kind)).toEqual(['flight', 'stay', 'voucher', 'crowds']);
    expect(items[0]).toEqual({ kind: 'flight', title: 'British Airways economy on Avios', sub: '38,500 off-peak · you have 67,309' });
    expect(items[1]).toEqual({ kind: 'stay', title: 'Stay Marriott Bonvoy', sub: '59 of 100 nights to Ambassador · +3,000 promo pts · lounge access, free breakfast' });
    expect(items[2]).toEqual({ kind: 'voucher', title: 'Use the 40k free night before it goes', sub: 'mid-range in Tokyo, ~£197 · ~32,000 pts · £200 to you · expires 1 March 2027' });
    // An undated driver says why it's busy, where "Busy in Kyoto" said nothing.
    expect(items[3]).toEqual({ kind: 'crowds', title: 'Busy in Kyoto', sub: 'Autumn leaves' });
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
    expect(agentContext('Japan', null, 12, [climateRow('Apr')], [], [], 'London')).toEqual({ month: null, holidays: [], school: [], regions: [], visited: [], home: 'London' });
  });
  it('lists the national holidays in the trip', () => {
    const hols = [
      { date: '2027-04-29', name: 'Shōwa Day', localName: '', global: true, types: [] },
      { date: '2027-05-03', name: 'Constitution Memorial Day', localName: '', global: true, types: [] },
    ];
    expect(agentContext('Japan', '2027-05-01', 6, [], [], [], 'London', hols).holidays).toEqual([{ date: '2027-05-03', name: 'Constitution Memorial Day' }]);
  });
});

describe('measuredCash (the price database)', () => {
  // Barcelona, mid-March (a plain fortnight) and the congress nights: the
  // real prices searched on 20 Oct 2026.
  const plain: PriceSearch = { city: 'Barcelona', country: 'Spain', in: '2027-03-14', out: '2027-03-18', q: 'by name', hotels: [
    ['Renaissance Barcelona Hotel', 363, 5], ['Cotton House Hotel, Autograph Collection', 427, 5], ['Le Méridien Barcelona', 450, 5],
    ['Labtwentytwo Barcelona, a Tribute Portfolio Hotel', 360, 4], ['Moxy Barcelona', 245, 4], ['W Barcelona', 400, 5], ['Hotel del Mar', 129, 3],
  ] };
  const congress: PriceSearch = { city: 'Barcelona', country: 'Spain', in: '2027-02-28', out: '2027-03-04', q: 'by name', hotels: [
    ['Cotton House Hotel, Autograph Collection', 2488, 5], ['Labtwentytwo Barcelona, a Tribute Portfolio Hotel', 779, 4], ['Renaissance Barcelona Hotel', null, 5],
    ['Moxy Barcelona', 999, 4], ['W Barcelona', 1448, 5],
  ] };
  const crowd = (month: string, priceLevel: 'low' | 'medium' | 'high') => ({ country: 'Spain', region: null, month, crowdLevel: priceLevel, priceLevel, driver: '' }) as unknown as RealCrowdPriceMonth;
  const rates = [{ country: 'Spain', city: 'Barcelona', tier: 'mid', priceLowUsd: 150, priceHighUsd: 300 }] as CityCashRate[];
  const market = (prices: PriceSearch[], c: RealCrowdPriceMonth[] = []) => ({ rates, crowd: c, pointsValue: [], usdToGbp: 0.8, usdToEur: 0.92, prices });
  const stop = (checkIn: string, nights = 3) => ({ city: 'Barcelona', country: 'Spain', checkIn, nights });

  it('takes hotels priced for the very nights as they are', () => {
    // Marriott's Premium hotels with a rate for the congress: Cotton House and Labtwentytwo.
    expect(measuredCash(stop('2027-03-01'), 'Marriott Bonvoy', 'mid', market([plain, congress]))).toEqual({ usd: 1634, low: 1206, high: 2061, hotels: 2, basis: 'dates' });
  });
  it('moves plain-night prices to the stay’s season, by the city’s researched range', () => {
    // Four Premium Marriotts in mid-March (medium, the range's middle,
    // $225) moved to August (high, its top, $300): x4/3.
    const m = market([plain], [crowd('Mar', 'medium'), crowd('Aug', 'high')]);
    expect(measuredCash(stop('2027-08-10'), 'Marriott Bonvoy', 'mid', m)).toEqual({ usd: 527, low: 483, high: 577, hotels: 4, basis: 'season' });
    // Same month: as measured.
    expect(measuredCash(stop('2027-03-20'), 'Marriott Bonvoy', 'mid', m)?.usd).toBe(395);
  });
  it('leaves event nights out of a plain price, and needs two hotels', () => {
    // Only the congress was searched for Luxury: no plain price to move.
    expect(measuredCash(stop('2027-03-20'), 'Marriott Bonvoy', 'luxury', market([congress]))).toBeNull();
    // One Luxury hotel (the W) isn't the brand's pricing.
    expect(measuredCash(stop('2027-03-20'), 'Marriott Bonvoy', 'luxury', market([plain]))).toBeNull();
    // Without the database, nothing measured: the researched rates stand.
    expect(measuredCash(stop('2027-03-20'), 'Marriott Bonvoy', 'mid', { ...market([]), prices: undefined })).toBeNull();
  });
  it('prices a programme’s points and its Where to stay line from its own hotels', () => {
    const options = [{ programme: 'Marriott Bonvoy', tier: 'Titanium Elite', estimatedNightlyGBP: 180, rateSource: 'history', historyCount: 9, pointsEarned: 0, pointsValueGBP: 0, benefits: [], effectiveNightlyGBP: 150 }] as HotelPlanOption[];
    const account = { programmes: [], vouchers: [], flights: [], hotels: [], promotions: [] };
    const pv = [{ programme: 'Marriott Bonvoy', avgCentsPerPoint: 0.78, fifthNightFree: true }] as PointsValueProgramme[];
    const [marriott] = stayInsights(options, [stop('2027-03-20')], account, () => null, { ...market([plain]), pointsValue: pv }, '2026-10-20');
    // $395 a night at Marriott's Premium hotels, not the researched $225.
    expect(marriott.perNight).toBe(50500);
    expect(stayLines(marriott)).toContain('~£308 a night in Barcelona · 4 Marriott hotels priced');
  });
});
