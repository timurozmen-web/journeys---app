import { describe, expect, test } from 'vitest';
import { addDays, addMonths, daysBetweenISO, tripDayInfo } from './tripDay';
import { makeTrip } from '../test/fixtures';

describe('addDays', () => {
  test('adds nights to a check-in date', () => {
    expect(addDays('2026-09-04', 4)).toBe('2026-09-08');
  });

  test('rolls over month, year and leap-day boundaries', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  // Regression: checkout used to come out a day early in BST.
  test('is not shifted by the clocks changing', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // clocks go forward 29 Mar
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26'); // clocks go back 25 Oct
    expect(addDays('2026-07-01', 1)).toBe('2026-07-02'); // mid-BST
  });
});

describe('tripDayInfo', () => {
  const trip = makeTrip({ start: '2026-09-04', end: '2026-09-08' });

  // Regression: a 4-8 Sep stay used to count as 5 days.
  test('a 4-8 Sep trip is 4 days long', () => {
    expect(tripDayInfo(trip, '2026-09-04')).toEqual({ dayIndex: 1, totalDays: 4 });
    expect(tripDayInfo(trip, '2026-09-05')).toEqual({ dayIndex: 2, totalDays: 4 });
  });

  test('clamps the day into range before and after the trip', () => {
    expect(tripDayInfo(trip, '2026-09-01').dayIndex).toBe(1);
    expect(tripDayInfo(trip, '2026-09-20').dayIndex).toBe(4);
  });

  test('a same-day trip is still 1 day, never 0', () => {
    expect(tripDayInfo(makeTrip({ start: '2026-09-04', end: '2026-09-04' }), '2026-09-04')).toEqual({ dayIndex: 1, totalDays: 1 });
  });

  test('counts correctly across the clocks going forward', () => {
    const dst = makeTrip({ start: '2026-03-27', end: '2026-03-31' });
    expect(tripDayInfo(dst, '2026-03-30')).toEqual({ dayIndex: 4, totalDays: 4 });
  });
});

describe('addMonths', () => {
  test('adds calendar months', () => {
    expect(addMonths('2025-12-01', 3)).toBe('2026-03-01');
    expect(addMonths('2026-07-24', 12)).toBe('2027-07-24');
  });

  test('clamps to the end of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2027-12-31', 2)).toBe('2028-02-29'); // leap year
  });

  test('is not shifted by the clocks changing', () => {
    expect(addMonths('2026-03-01', 1)).toBe('2026-04-01');
    expect(addMonths('2026-10-25', 1)).toBe('2026-11-25');
  });
});

describe('daysBetweenISO', () => {
  test('counts whole days, including across the clocks changing', () => {
    expect(daysBetweenISO('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetweenISO('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetweenISO('2026-09-04', '2026-09-04')).toBe(0);
    expect(daysBetweenISO('2026-09-08', '2026-09-04')).toBe(-4);
  });
});
