import type { DiscoverItem, Hotel } from '../types';

export interface PromoMatch {
  hotel: Hotel;
  reason: string;
}

// Whether a kept promo can even be evaluated against stays -- distinct
// from whether it currently matches any, since "requires registration
// but you haven't ticked it yet" is a real, different state to show.
export function promoIsActive(item: DiscoverItem): boolean {
  if (item.status !== 'kept') return false;
  if (item.requiresRegistration && !item.registered) return false;
  return true;
}

// Checks a kept, registered (if required) promo against real logged
// hotel stays and returns which ones genuinely qualify, plus why --
// this is the actual "smart" part: reading the promo's own terms
// (date range, minimum nights, new-bookings-only) rather than just
// showing the headline and leaving the user to work it out.
export function matchingStays(item: DiscoverItem, hotels: Hotel[]): PromoMatch[] {
  if (!promoIsActive(item)) return [];

  const matches: PromoMatch[] = [];
  for (const h of hotels) {
    if (!h.date) continue;

    // Brand match: only relevant if the promo names a programme and the
    // stay's own loyalty brand is known and different.
    if (item.relatedProgramme && h.brand && !brandsRoughlyMatch(item.relatedProgramme, h.brand)) continue;

    // Date range: the stay's check-in must fall inside the promo window.
    if (item.promoStart && h.date < item.promoStart) continue;
    if (item.promoEnd && h.date > item.promoEnd) continue;

    // Minimum nights, if the promo specifies one.
    if (item.minNights != null && h.nights < item.minNights) continue;

    // New-bookings-only: the stay must have been logged (added to the
    // wallet) after the promo was marked as registered -- a stay
    // already booked before registering doesn't retroactively qualify
    // for most hotel promotions, and this is the only signal available
    // for "when was this actually booked" without a separate booking-
    // date field.
    if (item.newBookingsOnly && item.registeredAt && h.createdAt && h.createdAt < item.registeredAt) continue;

    const reasons: string[] = [];
    if (item.minNights != null) reasons.push(`${h.nights} of ${item.minNights}+ nights`);
    if (item.promoStart || item.promoEnd) reasons.push('within the promo dates');
    matches.push({ hotel: h, reason: reasons.join(', ') || 'matches the promo terms' });
  }
  return matches;
}

function brandsRoughlyMatch(programmeName: string, hotelBrand: string): boolean {
  const a = programmeName.toLowerCase();
  const b = hotelBrand.toLowerCase();
  return a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0];
}
