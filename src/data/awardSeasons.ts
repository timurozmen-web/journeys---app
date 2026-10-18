// Which dates are peak for reward seats, where the airline's calendar is
// known, so a seat is priced at one figure rather than "27,500-33,000".
// Outside what's listed, or on a date the sources disagree about, the
// season is unknown and both prices are shown. Checked 18 Oct 2026.

export type SeasonCalendar = 'BA' | 'VS' | 'VS-Caribbean';

// British Airways, 2026 peak dates from London: AwardWallet's calendar.
// Pointszilla agrees except for 6-9 July and 13 December (AwardWallet
// peak) and 11 December (Pointszilla peak); Avios Intelligence has all of
// July as peak, so 14 and 21 July are in doubt too. Those dates are
// unknown. BA hasn't published 2027.
const r = (from: string, to: string): [string, string] => [from, to];
export const BA_PEAK_2026: [string, string][] = [
  r('2026-01-01', '2026-01-04'), r('2026-02-13', '2026-02-15'), r('2026-02-20', '2026-02-22'), r('2026-03-27', '2026-03-30'),
  r('2026-04-02', '2026-04-06'), r('2026-04-09', '2026-04-12'), r('2026-05-01', '2026-05-04'), r('2026-05-22', '2026-05-31'),
  r('2026-06-06', '2026-06-07'), r('2026-06-12', '2026-06-14'), r('2026-06-19', '2026-06-21'), r('2026-06-26', '2026-06-28'),
  r('2026-07-03', '2026-07-05'), r('2026-07-10', '2026-07-13'), r('2026-07-15', '2026-07-20'), r('2026-07-22', '2026-07-31'),
  r('2026-08-01', '2026-08-31'), r('2026-09-01', '2026-09-01'), r('2026-09-04', '2026-09-06'), r('2026-09-11', '2026-09-13'),
  r('2026-09-18', '2026-09-20'), r('2026-09-25', '2026-09-27'), r('2026-10-23', '2026-10-25'), r('2026-10-30', '2026-11-01'),
  r('2026-11-21', '2026-11-21'), r('2026-11-29', '2026-11-29'), r('2026-12-12', '2026-12-12'), r('2026-12-18', '2026-12-24'),
  r('2026-12-26', '2026-12-31'),
];
export const BA_DISPUTED_2026 = new Set(['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-14', '2026-07-21', '2026-12-11', '2026-12-13']);
export const BA_KNOWN: [string, string] = ['2026-01-01', '2026-12-31'];

// Virgin Atlantic Saver seats: peak windows from Virgin's own Saver page
// (flywith.virginatlantic.com), matched by Reward Seat Scout's 2026
// breakdown. Every date is standard or peak, so within the span the
// windows cover, a date outside them is standard.
export const VS_PEAK: Record<'VS' | 'VS-Caribbean', { known: [string, string]; peak: [string, string][] }> = {
  VS: {
    known: ['2026-06-14', '2027-01-05'],
    peak: [r('2026-06-14', '2026-09-01'), r('2026-10-23', '2026-11-03'), r('2026-12-07', '2027-01-05')],
  },
  // The Caribbean and Indian Ocean (Maldives) have their own calendar.
  'VS-Caribbean': {
    known: ['2026-07-18', '2027-03-02'],
    peak: [r('2026-07-18', '2026-09-01'), r('2026-10-23', '2026-11-03'), r('2026-12-01', '2027-03-02')],
  },
};
