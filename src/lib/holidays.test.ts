import { describe, expect, it } from 'vitest';
import { countryCode, holidaysDuring, longWeekend, schoolBreakDuring, shortDate, type Holiday, type SchoolHoliday } from './holidays';

describe('countryCode', () => {
  it('finds the code for every country the climate data covers', () => {
    const countries = ['Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Cambodia', 'Canada', 'Chile', 'China', 'Costa Rica',
      'Croatia', 'Cuba', 'Czech Republic', 'Denmark', 'Dominican Republic', 'Egypt', 'Fiji', 'Finland', 'France', 'Germany', 'Greece', 'Hong Kong',
      'Iceland', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Malaysia', 'Maldives', 'Mexico', 'Morocco',
      'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Russia', 'Saudi Arabia',
      'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan', 'Tanzania', 'Thailand', 'Türkiye', 'UAE',
      'United Kingdom', 'United States', 'Vietnam'];
    expect(countries.filter((c) => countryCode(c) == null)).toEqual([]);
  });
  it('reads the planner’s spellings too', () => {
    expect(countryCode('United Arab Emirates')).toBe('AE');
    expect(countryCode('Turkey')).toBe('TR');
    expect(countryCode('Saint Lucia')).toBe('LC');
    expect(countryCode('Bosnia and Herzegovina')).toBe('BA');
    expect(countryCode('Democratic Republic of the Congo')).toBe('CD');
    expect(countryCode('Macau')).toBe('MO');
    expect(countryCode('Atlantis')).toBeNull();
  });
});

const h = (date: string, name: string, global = true): Holiday => ({ date, name, localName: name, global, types: ['Public'] });
// Japan's Golden Week, 2027.
const japan = [h('2027-04-29', 'Shōwa Day'), h('2027-05-03', 'Constitution Memorial Day'), h('2027-05-04', 'Greenery Day'), h('2027-05-05', "Children's Day")];

describe('holidaysDuring', () => {
  it('lists national holidays on the nights of a stay, not the morning it leaves', () => {
    expect(holidaysDuring(japan, '2027-05-01', 4).map((x) => x.date)).toEqual(['2027-05-03', '2027-05-04']);
    expect(holidaysDuring(japan, '2027-05-05', 1).map((x) => x.name)).toEqual(["Children's Day"]);
  });
  it('leaves out holidays only some regions keep', () => {
    expect(holidaysDuring([h('2027-05-27', 'Corpus Christi', false)], '2027-05-26', 3)).toEqual([]);
  });
});

// From OpenHolidays' data (github.com/openpotato/openholidaysapi.data, read
// 20 Oct 2026): Germany's 2027 summer, state by state.
const sch = (start: string, end: string, name: string, regions: string[], nationwide = false): SchoolHoliday => ({ start, end, name, regions, nationwide });
const germanSummer = ([
  ['2027-06-28', '2027-08-06', 'HE'], ['2027-06-28', '2027-08-06', 'RP'], ['2027-06-28', '2027-08-06', 'SL'], ['2027-07-01', '2027-08-11', 'HH'],
  ['2027-07-01', '2027-08-14', 'BB'], ['2027-07-01', '2027-08-14', 'BE'], ['2027-07-03', '2027-08-14', 'SH'], ['2027-07-05', '2027-08-14', 'MV'],
  ['2027-07-08', '2027-08-18', 'HB'], ['2027-07-08', '2027-08-18', 'NI'], ['2027-07-10', '2027-08-20', 'SN'], ['2027-07-10', '2027-08-20', 'ST'],
  ['2027-07-10', '2027-08-20', 'TH'], ['2027-07-19', '2027-08-31', 'NW'], ['2027-07-29', '2027-09-11', 'BW'], ['2027-08-02', '2027-09-13', 'BY'],
] as const).map(([s, e, r]) => sch(s, e, 'Summer Holidays', [`DE-${r}`]));
// France 2026-27: Christmas everywhere on the mainland, winter by zone, and
// a Corsican row from early 2026 (its 2026-27 dates weren't published).
const mainland = ['FR-ZA', 'FR-AR', 'FR-BF', 'FR-NA', 'FR-ZB', 'FR-BT', 'FR-CV', 'FR-GE', 'FR-HF', 'FR-NO', 'FR-PC', 'FR-PL', 'FR-ZC', 'FR-IF', 'FR-OC'];
const france = [
  sch('2026-02-15', '2026-03-01', 'Winter Holidays', ['FR-CO']),
  sch('2026-12-20', '2027-01-03', 'Christmas Holidays', mainland),
  sch('2027-02-07', '2027-02-21', 'Winter Holidays', ['FR-ZC', 'FR-IF']),
  sch('2027-02-14', '2027-02-28', 'Winter Holidays', ['FR-ZA', 'FR-AR', 'FR-BF', 'FR-NA']),
  sch('2027-02-21', '2027-03-07', 'Winter Holidays', ['FR-ZB', 'FR-BT', 'FR-CV', 'FR-GE', 'FR-HF', 'FR-NO', 'FR-PC', 'FR-PL']),
];

describe('schoolBreakDuring', () => {
  it('reads how much of the country is off on the stay’s busiest night', () => {
    expect(schoolBreakDuring(germanSummer, '2027-06-28', 2)).toEqual({ name: 'Summer Holidays', start: '2027-06-28', end: '2027-09-13', reach: 'some' });
    expect(schoolBreakDuring(germanSummer, '2027-07-05', 3)?.reach).toBe('most'); // 8 of 16 states
    expect(schoolBreakDuring(germanSummer, '2027-08-02', 3)?.reach).toBe('all');
    expect(schoolBreakDuring(germanSummer, '2027-09-20', 3)).toBeNull();
  });
  it('doesn’t let a region with no dates yet make a nationwide break look partial', () => {
    // Corsica's last published row is February 2026: it isn't counted in December.
    expect(schoolBreakDuring(france, '2026-12-28', 3)).toEqual({ name: 'Christmas Holidays', start: '2026-12-20', end: '2027-01-03', reach: 'all' });
    // Zone C (Paris, Toulouse, Montpellier) alone in early February.
    expect(schoolBreakDuring(france, '2027-02-08', 3)?.reach).toBe('some');
  });
  it('takes a holiday with no regions as nationwide, and leaves out one-day closures', () => {
    expect(schoolBreakDuring([sch('2027-02-15', '2027-02-19', 'Carnaval', [], true)], '2027-02-16', 2)?.reach).toBe('all');
    expect(schoolBreakDuring([sch('2027-11-17', '2027-11-17', 'Repentance Day', ['DE-BY'])], '2027-11-16', 3)).toBeNull();
  });
});

describe('longWeekend', () => {
  it('reads a Monday or Friday as a long weekend, a Tuesday or Thursday as a bridge', () => {
    expect(longWeekend('2027-05-03')).toBe('long weekend'); // Monday
    expect(longWeekend('2027-04-29')).toBe('bridge'); // Thursday
    expect(longWeekend('2027-05-05')).toBeNull(); // Wednesday
  });
  it('writes a date short', () => {
    expect(shortDate('2027-05-03')).toBe('3 May');
  });
});
