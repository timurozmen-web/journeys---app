import type { Hotel, LoyaltyProgramme, Promotion } from '../types';

export interface StatusProgress {
  total: number;
  pct: number | null; // current, solid segment
  pct2: number | null; // + booked nights, projected
  pct3: number | null; // + pending promotion bonus nights, projected
  bookedNights: number;
  pendingPromo: Promotion | null;
  pendingNights: number;
  spendBar: { spendUSD: number; spendRequiredUSD: number; pct: number } | null;
}

export function computeStatusProgress(p: LoyaltyProgramme, hotels: Hotel[], promotions: Promotion[]): StatusProgress {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const bookedNights = hotels
    .filter((h) => h.brand === p.name && h.status === 'Booked' && Number(h.date.slice(0, 4)) === currentYear)
    .reduce((s, h) => s + h.nights, 0);

  // A status_boost promotion for this brand, active now, not yet applied
  // -- its bonus nights land all at once on the next qualifying stay, so
  // shown as a separate "pending" projection rather than folded into
  // booked nights.
  const pendingPromo =
    promotions.find(
      (promo) =>
        promo.promoType === 'status_boost' &&
        promo.statusNightsBonus != null &&
        !promo.statusNightsApplied &&
        (!promo.brand || promo.brand === p.name) &&
        (!promo.startDate || promo.startDate <= today) &&
        (!promo.endDate || promo.endDate >= today)
    ) ?? null;
  const pendingNights = pendingPromo?.statusNightsBonus ?? 0;

  const total = (p.nights ?? 0) + (p.nightsNeeded ?? 0);
  const projectedBooked = Math.min(total, (p.nights ?? 0) + bookedNights);
  const projectedWithPromo = Math.min(total, projectedBooked + pendingNights);

  // Marriott's Ambassador tier has a genuinely separate, second
  // requirement -- $23,000 USD qualifying spend in the calendar year,
  // alongside the 100 nights.
  let spendBar: StatusProgress['spendBar'] = null;
  if (p.name === 'Marriott Bonvoy' && p.nextTier === 'Ambassador') {
    const spendGBP = hotels
      .filter((h) => h.brand === 'Marriott Bonvoy' && h.status === 'Completed' && Number(h.date.slice(0, 4)) === currentYear)
      .reduce((s, h) => s + (h.total ?? 0), 0);
    const spendUSD = spendGBP * 1.27;
    spendBar = { spendUSD, spendRequiredUSD: 23000, pct: Math.min(100, (spendUSD / 23000) * 100) };
  }

  return {
    total,
    pct: p.nights != null && p.nightsNeeded != null ? (p.nights / total) * 100 : null,
    pct2: bookedNights > 0 ? (projectedBooked / total) * 100 : null,
    pct3: pendingNights > 0 ? (projectedWithPromo / total) * 100 : null,
    bookedNights,
    pendingPromo,
    pendingNights,
    spendBar,
  };
}
