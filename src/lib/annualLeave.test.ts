import { describe, expect, test } from 'vitest';
import { calculateLeaveNeeded } from './annualLeave';

describe('calculateLeaveNeeded', () => {
  test('a single weekday costs one day of leave', () => {
    expect(calculateLeaveNeeded('2026-09-04', '2026-09-04').leaveDaysNeeded).toBe(1);
  });

  test('August bank holiday weekend: Sat 29 Aug - Sun 6 Sep 2026', () => {
    expect(calculateLeaveNeeded('2026-08-29', '2026-09-06')).toEqual({
      totalDays: 9,
      weekdays: 4,
      weekendDays: 4,
      bankHolidays: 1,
      leaveDaysNeeded: 4,
      bankHolidayDates: ['2026-08-31'],
    });
  });

  test('Christmas 2026: Thu 24 - Tue 29 Dec only needs 2 days off', () => {
    const r = calculateLeaveNeeded('2026-12-24', '2026-12-29');
    expect(r.leaveDaysNeeded).toBe(2);
    expect(r.bankHolidayDates).toEqual(['2026-12-25', '2026-12-28']);
    expect(r.weekendDays).toBe(2);
  });

  test('counts inclusively, not affected by the clocks changing', () => {
    expect(calculateLeaveNeeded('2026-03-23', '2026-04-05').totalDays).toBe(14);
  });
});
