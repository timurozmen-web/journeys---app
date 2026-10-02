import { daysBetweenISO } from './tripDay';

// Where a spending goal stands against its deadline: how much is left,
// how long, what it needs per month, and whether the pace so far gets
// there. Everything is derived from the real figures, nothing assumed.
export interface Pace {
  remaining: number;        // £ still to spend (0 once reached)
  daysLeft: number;         // 0 once the window has closed
  perMonthNeeded: number;   // £/month over the days left
  projected: number;        // £ by the deadline if the pace so far continues
  onTrack: boolean;
  status: 'reached' | 'open' | 'closed';
}

const DAYS_PER_MONTH = 30.44;

export function spendPace(a: { spent: number; target: number; windowStart: string; windowEnd: string; today: string }): Pace {
  const remaining = Math.max(0, a.target - a.spent);
  const daysLeft = Math.max(0, daysBetweenISO(a.today, a.windowEnd));
  if (a.spent >= a.target) {
    return { remaining: 0, daysLeft, perMonthNeeded: 0, projected: a.spent, onTrack: true, status: 'reached' };
  }
  if (daysLeft === 0) {
    return { remaining, daysLeft: 0, perMonthNeeded: 0, projected: a.spent, onTrack: false, status: 'closed' };
  }
  const elapsed = Math.max(1, daysBetweenISO(a.windowStart, a.today));
  const projected = a.spent + (a.spent / elapsed) * daysLeft;
  return {
    remaining,
    daysLeft,
    perMonthNeeded: remaining / (daysLeft / DAYS_PER_MONTH),
    projected,
    onTrack: projected >= a.target,
    status: 'open',
  };
}
