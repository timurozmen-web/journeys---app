import { describe, expect, it } from 'vitest';
import { countryCode, holidaysDuring, longWeekend, shortDate, type Holiday } from './holidays';

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
