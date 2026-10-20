import { describe, expect, test } from 'vitest';
import { fetchHolidays, mapHolidays, parseQuery } from './holidays.js';

describe('holidays', () => {
  test('takes a two-letter country and a sane year only', () => {
    expect(parseQuery({ country: 'jp', year: '2027' })).toEqual({ country: 'JP', year: 2027 });
    expect(parseQuery({ country: 'Japan', year: '2027' })).toBeNull();
    expect(parseQuery({ country: 'JP', year: '27' })).toBeNull();
    expect(parseQuery({ country: 'JP' })).toBeNull();
    expect(parseQuery(undefined)).toBeNull();
  });

  test('keeps what the app uses, and marks regional holidays', () => {
    expect(mapHolidays([
      { date: '2027-05-03', localName: '憲法記念日', name: 'Constitution Memorial Day', countryCode: 'JP', global: true, counties: null, types: ['Public'] },
      { date: '2027-06-03', localName: 'Fronleichnam', name: 'Corpus Christi', countryCode: 'DE', global: false, counties: ['DE-BY'], types: ['Public'] },
      { date: 'soon', name: 'Broken' },
    ])).toEqual([
      { date: '2027-05-03', name: 'Constitution Memorial Day', localName: '憲法記念日', global: true, types: ['Public'] },
      { date: '2027-06-03', name: 'Corpus Christi', localName: 'Fronleichnam', global: false, types: ['Public'] },
    ]);
    expect(mapHolidays({ error: 'x' })).toEqual([]);
  });

  test('asks Nager for the country and year, and treats an unknown country as none', async () => {
    const asked = [];
    const ok = await fetchHolidays({ country: 'JP', year: 2027 }, async (url) => {
      asked.push(url);
      return { ok: true, status: 200, json: async () => [{ date: '2027-01-01', name: "New Year's Day", localName: '元日', global: true, types: ['Public'] }] };
    });
    expect(asked).toEqual(['https://date.nager.at/api/v3/PublicHolidays/2027/JP']);
    expect(ok).toEqual({ supported: true, holidays: [{ date: '2027-01-01', name: "New Year's Day", localName: '元日', global: true, types: ['Public'] }] });
    expect(await fetchHolidays({ country: 'AE', year: 2027 }, async () => ({ ok: false, status: 404 }))).toEqual({ supported: false, holidays: [] });
    await expect(fetchHolidays({ country: 'JP', year: 2027 }, async () => ({ ok: false, status: 500 }))).rejects.toThrow('500');
  });
});
