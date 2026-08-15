import type { Hotel, LoyaltyProgramme, Promotion } from '../types';

// Per-brand spend/status-points requirements, verified against each
// programme's real published terms rather than assumed to all work like
// Marriott's flat dollar threshold.
interface SpendConfig {
  label: string;
  unit: 'currency' | 'points';
  currencySymbol?: string; // for 'currency' unit
  fxRateFromGBP: number;
  pointsPerGBP?: number; // for 'points' unit -- computed directly from GBP to avoid a double FX conversion
  requiredByTier: Record<string, number>; // next-tier name -> required amount, in the unit above
}

const SPEND_CONFIGS: Record<string, SpendConfig> = {
  'Marriott Bonvoy': {
    label: 'Qualifying spend', unit: 'currency', currencySymbol: '$', fxRateFromGBP: 1.27,
    requiredByTier: { Ambassador: 23000 },
  },
  // Accor: 25 status points per €10 spent (2.5/€), verified against
  // Accor's own published terms. Thresholds per tier, each independently
  // reachable via nights OR status points -- whichever comes first.
  'Accor ALL': {
    label: 'Status points', unit: 'points', fxRateFromGBP: 1.17, pointsPerGBP: 1.17 * 2.5,
    requiredByTier: { Silver: 2000, Gold: 7000, Platinum: 14000, Diamond: 26000 },
  },
};

export interface SpendProgress {
  label: string;
  currentAmount: number; // from Completed stays this year
  pendingAmount: number; // from Booked stays this year, not yet completed
  requiredAmount: number;
  unit: 'currency' | 'points';
  currencySymbol?: string;
  pct: number; // completed only
  pendingPct: number | null; // completed + pending combined, when pending > 0
}

export interface StatusProgress {
  total: number;
  currentNights: number; // static baseline + newly-completed stays since the baseline date
  pct: number | null; // current, solid segment
  pct2: number | null; // + booked nights, projected
  pct3: number | null; // + pending promotion bonus nights, projected
  pendingPct: number | null; // + booked and/or promo nights combined, whichever is present -- always populated when either exists
  bookedNights: number;
  pendingPromo: Promotion | null;
  pendingNights: number;
  spendProgress: SpendProgress | null;
}

export function computeStatusProgress(p: LoyaltyProgramme, hotels: Hotel[], promotions: Promotion[]): StatusProgress {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  // Current nights = the static baseline (accurate as of nightsBaselineDate)
  // plus any stays for this brand completed *after* that date -- avoids
  // double-counting nights already folded into the baseline, while still
  // growing live as new stays actually complete.
  const newlyCompletedNights = p.nightsBaselineDate
    ? hotels
        .filter((h) => h.brand === p.name && h.status === 'Completed' && h.date > p.nightsBaselineDate!)
        .reduce((s, h) => s + h.nights, 0)
    : 0;
  const currentNights = (p.nights ?? 0) + newlyCompletedNights;

  // Only stays booked within the current qualification year count as
  // pending progress toward it -- a stay booked for next year belongs to
  // a separate, future qualification period and shouldn't inflate this
  // year's bar.
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
  // The promo's bonus nights land alongside the 1 real night of whatever
  // stay triggers it. If a booked stay already exists, that's presumably
  // the trigger and its night is already counted via bookedNights -- add
  // just the bonus on top. If there's no booked stay yet, this is a pure
  // projection of "your next stay, whenever it happens" -- so the +1
  // triggering night needs to be added explicitly, or a 15-night bonus
  // would incorrectly show as only +15 instead of the real +16.
  const pendingNights = pendingPromo ? pendingPromo.statusNightsBonus! + (bookedNights > 0 ? 0 : 1) : 0;

  const total = (p.nights ?? 0) + (p.nightsNeeded ?? 0);
  const projectedBooked = Math.min(total, currentNights + bookedNights);
  const projectedWithPromo = Math.min(total, projectedBooked + pendingNights);

  // Any brand with a configured spend/status-points requirement for the
  // tier being pursued gets a second bar, alongside nights -- not just
  // Marriott. Completed spend is the solid segment; booked-but-not-yet-
  // completed spend this year shows as pending, same as nights.
  let spendProgress: SpendProgress | null = null;
  const config = SPEND_CONFIGS[p.name];
  const requiredAmount = config && p.nextTier ? config.requiredByTier[p.nextTier] : undefined;
  if (config && requiredAmount != null) {
    const spendGBP = (status: Hotel['status']) =>
      hotels
        .filter((h) => h.brand === p.name && h.status === status && Number(h.date.slice(0, 4)) === currentYear)
        .reduce((s, h) => s + (h.total ?? 0), 0);

    const rate = config.unit === 'points' ? config.pointsPerGBP! : config.fxRateFromGBP;
    const currentAmount = spendGBP('Completed') * rate;
    const pendingSpend = spendGBP('Booked') * rate;

    spendProgress = {
      label: config.label, currentAmount, pendingAmount: pendingSpend, requiredAmount,
      unit: config.unit, currencySymbol: config.currencySymbol,
      pct: Math.min(100, (currentAmount / requiredAmount) * 100),
      pendingPct: pendingSpend > 0 ? Math.min(100, ((currentAmount + pendingSpend) / requiredAmount) * 100) : null,
    };
  }

  return {
    total,
    currentNights,
    pct: p.nights != null && p.nightsNeeded != null ? (currentNights / total) * 100 : null,
    pct2: bookedNights > 0 ? (projectedBooked / total) * 100 : null,
    pct3: pendingNights > 0 ? (projectedWithPromo / total) * 100 : null,
    pendingPct: bookedNights + pendingNights > 0 ? (projectedWithPromo / total) * 100 : null,
    bookedNights,
    pendingPromo,
    pendingNights,
    spendProgress,
  };
}
