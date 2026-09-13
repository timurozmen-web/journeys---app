// UK (England & Wales) bank holidays, sourced directly from gov.uk/bank-holidays
// (page last updated 24 November 2025). Covers 2026-2028 -- re-fetch and
// extend when this runs out, since bank holidays are only confirmed a
// couple of years ahead.
export const UK_BANK_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  // 2027
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
  // 2028
  '2028-01-03', '2028-04-14', '2028-04-17', '2028-05-01', '2028-05-29', '2028-08-28', '2028-12-25', '2028-12-26',
]);

export interface LeaveBreakdown {
  totalDays: number;
  weekdays: number;
  weekendDays: number;
  bankHolidays: number;
  leaveDaysNeeded: number; // weekdays that aren't a bank holiday -- the actual cost in annual leave
  bankHolidayDates: string[]; // which bank holidays fall in range, for display
}

// Counts every day from startDate to endDate inclusive and works out how
// many of them would actually need to be booked as annual leave (a
// weekday that isn't a bank holiday) versus days that are "free" (weekend
// or bank holiday) -- the real value of planning a trip around a bank
// holiday weekend.
export function calculateLeaveNeeded(startDate: string, endDate: string): LeaveBreakdown {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  let weekdays = 0;
  let weekendDays = 0;
  let bankHolidays = 0;
  const bankHolidayDates: string[] = [];

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isBankHoliday = UK_BANK_HOLIDAYS.has(iso);

    if (isBankHoliday) {
      bankHolidays += 1;
      bankHolidayDates.push(iso);
    } else if (isWeekend) {
      weekendDays += 1;
    } else {
      weekdays += 1;
    }
  }

  const totalDays = weekdays + weekendDays + bankHolidays;
  return { totalDays, weekdays, weekendDays, bankHolidays, leaveDaysNeeded: weekdays, bankHolidayDates };
}
