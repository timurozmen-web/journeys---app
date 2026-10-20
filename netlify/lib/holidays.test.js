import { describe, expect, test } from 'vitest';
import { fetchHolidays, fetchSchoolHolidays, mapHolidays, mapSchoolHolidays, parseQuery } from './holidays.js';

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

  // Shaped as OpenHolidays answers (its HolidayResponse, camel-cased).
  const french = [
    {
      id: 'a', startDate: '2026-12-20', endDate: '2027-01-03', type: 'School', regionalScope: 'Regional', temporalScope: 'FullDay', nationwide: false,
      name: [{ language: 'EN', text: 'Christmas Holidays' }, { language: 'FR', text: 'Vacances de Noël' }],
      subdivisions: [{ code: 'FR-ZA', shortName: 'ZA' }, { code: 'FR-IF', shortName: 'IF' }],
    },
    { id: 'b', startDate: '2027-07-03', type: 'EndOfLessons', nationwide: false, name: [{ language: 'EN', text: 'End of lessons' }], subdivisions: [{ code: 'FR-ZA', shortName: 'ZA' }] },
    { id: 'c', startDate: '2027-02-15', endDate: '2027-02-19', type: 'School', nationwide: false, name: [{ language: 'PT', text: 'Carnaval' }], subdivisions: [] },
    { id: 'd', startDate: 'soon', type: 'School' },
  ];

  test('keeps school holidays with their regions, not one-day markers', () => {
    expect(mapSchoolHolidays(french)).toEqual([
      { start: '2026-12-20', end: '2027-01-03', name: 'Christmas Holidays', nationwide: false, regions: ['FR-ZA', 'FR-IF'] },
      { start: '2027-02-15', end: '2027-02-19', name: 'Carnaval', nationwide: true, regions: [] },
    ]);
    expect(mapSchoolHolidays(null)).toEqual([]);
  });

  test('asks OpenHolidays for the year, only for countries it covers', async () => {
    const asked = [];
    const fr = await fetchSchoolHolidays({ country: 'FR', year: 2027 }, async (url) => {
      asked.push(url);
      return { ok: true, status: 200, json: async () => french.slice(0, 1) };
    });
    expect(asked).toEqual(['https://openholidaysapi.org/SchoolHolidays?countryIsoCode=FR&languageIsoCode=EN&validFrom=2027-01-01&validTo=2027-12-31']);
    expect(fr.supported).toBe(true);
    expect(fr.school).toHaveLength(1);
    expect(await fetchSchoolHolidays({ country: 'JP', year: 2027 }, async () => { throw new Error('not asked'); })).toEqual({ supported: false, school: [] });
    await expect(fetchSchoolHolidays({ country: 'DE', year: 2027 }, async () => ({ ok: false, status: 400 }))).rejects.toThrow('400');
  });
});
