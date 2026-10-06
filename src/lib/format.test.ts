import { describe, expect, test } from 'vitest';
import { dayMonth, formatDate, formatDateRange, formatMoney, formatMoneyHeadline, formatShortRange, weekdayDay } from './format';

describe('formatDate / formatDateRange', () => {
  test('single date', () => {
    expect(formatDate('2026-09-04')).toBe('4 September 2026');
  });

  test('same month, across months, across years', () => {
    expect(formatDateRange('2026-08-11', '2026-08-18')).toBe('11 - 18 August 2026');
    expect(formatDateRange('2026-02-27', '2026-03-01')).toBe('27 Feb - 1 Mar 2026');
    expect(formatDateRange('2026-12-28', '2027-01-03')).toBe('28 Dec 2026 - 3 Jan 2027');
  });
});

describe('formatMoney', () => {
  test('pence shown only under £100 when there are any', () => {
    expect(formatMoney(12.5)).toBe('£12.50');
    expect(formatMoney(12)).toBe('£12');
    expect(formatMoney(150.75)).toBe('£151');
    expect(formatMoney(1234)).toBe('£1,234');
  });

  test('negative amounts use a proper minus sign before the £', () => {
    expect(formatMoney(-12.5)).toBe('−£12.50');
  });

  test('headline figures always round to whole pounds', () => {
    expect(formatMoneyHeadline(1234.6)).toBe('£1,235');
    expect(formatMoneyHeadline(-40.2)).toBe('−£40');
  });
});

describe('dayMonth', () => {
  test('splits a date into a padded day and short month', () => {
    expect(dayMonth('2026-07-25')).toEqual({ day: '25', month: 'JUL' });
    expect(dayMonth('2026-08-04')).toEqual({ day: '04', month: 'AUG' });
  });
});

describe('formatShortRange', () => {
  test('drops the year for this year and keeps it otherwise', () => {
    expect(formatShortRange('2026-10-23', '2026-10-25', '2026-10-06')).toBe('23 – 25 Oct');
    expect(formatShortRange('2026-09-30', '2026-10-01', '2026-10-06')).toBe('30 Sep – 1 Oct');
    expect(formatShortRange('2027-01-15', '2027-01-23', '2026-10-06')).toBe('15 – 23 Jan 2027');
    expect(formatShortRange('2026-12-28', '2027-01-03', '2026-10-06')).toBe('28 Dec 2026 – 3 Jan 2027');
    expect(formatShortRange('2026-10-06', '2026-10-06', '2026-10-06')).toBe('6 Oct');
  });
});

describe('weekdayDay', () => {
  test('gives the weekday and day without shifting with the timezone', () => {
    expect(weekdayDay('2027-01-15')).toEqual({ weekday: 'FRI', day: '15' });
    expect(weekdayDay('2026-10-06')).toEqual({ weekday: 'TUE', day: '6' });
  });
});
