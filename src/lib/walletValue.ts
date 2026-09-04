import type { Hotel, LoyaltyProgramme } from '../types';

// Expedia One Key Cash isn't a fixed stored balance -- it's 6% of what's
// actually been booked through Expedia at Platinum tier, so it's computed
// live from real bookings rather than trusted as a stored number. Shared
// by every screen that totals up the wallet, so the number is always the
// same regardless of which screen computed it first.
export function withLiveOverrides(programmes: LoyaltyProgramme[], hotels: Hotel[]): LoyaltyProgramme[] {
  const oneKeyCash = hotels
    .filter((h) => h.bookingChannel === 'Expedia' && h.status === 'Completed' && h.total)
    .reduce((s, h) => s + (h.total ?? 0) * 0.06, 0);
  return programmes.map((p) =>
    p.name === 'Expedia One Key Cash' ? { ...p, points: Math.round(oneKeyCash), ptValue: 100 } : p
  );
}
