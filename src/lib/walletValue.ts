import type { Hotel, LoyaltyProgramme, Promotion } from '../types';
import { pointsFromStays } from './loyaltyPoints';

// Expedia One Key Cash isn't a fixed stored balance -- it's 6% of what's
// actually been booked through Expedia at Platinum tier, so it's computed
// live from real bookings rather than trusted as a stored number. Shared
// by every screen that totals up the wallet, so the number is always the
// same regardless of which screen computed it first.
// Balances are also brought up to date with stays completed since each
// programme's balance was recorded, so points earned but not yet entered
// show straight away.
export function withLiveOverrides(programmes: LoyaltyProgramme[], hotels: Hotel[], promotions: Promotion[] = []): LoyaltyProgramme[] {
  const oneKeyCash = hotels
    .filter((h) => h.bookingChannel === 'Expedia' && h.status === 'Completed' && h.total)
    .reduce((s, h) => s + (h.total ?? 0) * 0.06, 0);
  return programmes.map((p) => {
    if (p.name === 'Expedia One Key Cash') return { ...p, points: Math.round(oneKeyCash), ptValue: 100 };
    const { earned, pending } = pointsFromStays(p, hotels, promotions);
    return earned || pending ? { ...p, points: p.points + earned, stayPoints: earned, pendingStayPoints: pending } : p;
  });
}
