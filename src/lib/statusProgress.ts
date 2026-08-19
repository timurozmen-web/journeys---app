import type { Hotel, LoyaltyProgramme, Promotion } from '../types';
import { detectSubBrand } from '../data/brandMap';

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

export interface CardEliteNights {
  cardId: string;
  nights: number;
  earned: boolean; // already banked vs still pending a spend threshold
  note: string;
}

export interface BrandExplorerProgress {
  brandsStayed: string[]; // distinct sub-brands from completed stays
  brandsPending: string[]; // distinct sub-brands from booked (not yet completed) stays
  completedCount: number;
  pendingCount: number;
  vouchersEarned: number; // one per 5 distinct brands
  brandsToNextVoucher: number;
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
  cardEliteNights: CardEliteNights[];
  spendProgress: SpendProgress | null;
  brandExplorer: BrandExplorerProgress | null;
}

export function computeStatusProgress(
  p: LoyaltyProgramme,
  hotels: Hotel[],
  promotions: Promotion[],
  cardResults: { card: { id: string; programmeBrand: string; eliteNights: { auto: number; perSpendAmount: number | null; perSpendCap: number | null } }; autoSpend: number; cardRow?: { closedDate?: string | null } | null }[] = []
): StatusProgress {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const newlyCompletedNights = p.nightsBaselineDate
    ? hotels
        .filter((h) => h.brand === p.name && h.status === 'Completed' && h.date > p.nightsBaselineDate!)
        .reduce((s, h) => s + h.nights, 0)
    : 0;
  const currentNights = (p.nights ?? 0) + newlyCompletedNights;

  const bookedNights = hotels
    .filter((h) => h.brand === p.name && h.status === 'Booked' && Number(h.date.slice(0, 4)) === currentYear)
    .reduce((s, h) => s + h.nights, 0);

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
  const promoNights = pendingPromo ? pendingPromo.statusNightsBonus! + (bookedNights > 0 ? 0 : 1) : 0;

  // Elite nights granted by holding a card for this programme. These are
  // real, ongoing status progress -- an IHG card's 15 elite nights apply
  // every year the card stays open, and spend-earned nights accrue on top.
  // Only open (non-closed) cards count, since the benefit stops when the
  // card is closed.
  const cardEliteNights: CardEliteNights[] = [];
  for (const r of cardResults) {
    if (r.card.programmeBrand !== p.name) continue;
    if (r.cardRow?.closedDate) continue; // benefit ends with the card
    const en = r.card.eliteNights;
    if (en.auto > 0) {
      cardEliteNights.push({
        cardId: r.card.id, nights: en.auto, earned: true,
        note: `${en.auto} elite nights for holding ${r.card.id}`,
      });
    }
    if (en.perSpendAmount) {
      let earnedFromSpend = Math.floor(r.autoSpend / en.perSpendAmount);
      if (en.perSpendCap != null) earnedFromSpend = Math.min(earnedFromSpend, en.perSpendCap);
      if (earnedFromSpend > 0) {
        cardEliteNights.push({
          cardId: r.card.id, nights: earnedFromSpend, earned: true,
          note: `${earnedFromSpend} elite nights from £${Math.round(r.autoSpend).toLocaleString()} card spend`,
        });
      }
      // Show the next threshold as genuinely pending, so the user can see
      // what's within reach rather than only what's already banked.
      const atCap = en.perSpendCap != null && earnedFromSpend >= en.perSpendCap;
      if (!atCap) {
        const spendToNext = en.perSpendAmount - (r.autoSpend % en.perSpendAmount);
        cardEliteNights.push({
          cardId: r.card.id, nights: 1, earned: false,
          note: `+1 elite night at £${Math.round(spendToNext).toLocaleString()} more spend`,
        });
      }
    }
  }
  const earnedCardNights = cardEliteNights.filter((c) => c.earned).reduce((s, c) => s + c.nights, 0);
  const pendingCardNights = cardEliteNights.filter((c) => !c.earned).reduce((s, c) => s + c.nights, 0);

  // Everything not yet banked, combined: booked stays, promo bonuses, and
  // card nights still short of their spend threshold.
  const pendingNights = promoNights + pendingCardNights;

  const total = (p.nights ?? 0) + (p.nightsNeeded ?? 0);
  // Card elite nights that are already earned count as real, current
  // progress -- not pending -- since they've genuinely been credited.
  const effectiveCurrentNights = currentNights + earnedCardNights;
  const projectedBooked = Math.min(total, effectiveCurrentNights + bookedNights);
  const projectedWithPromo = Math.min(total, projectedBooked + pendingNights);

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
    // Booked-but-not-completed stays count as pending qualifying spend --
    // converted at the same static rate as completed spend, so an upcoming
    // stay's contribution is visible before it happens.
    const pendingSpend = spendGBP('Booked') * rate;

    spendProgress = {
      label: config.label, currentAmount, pendingAmount: pendingSpend, requiredAmount,
      unit: config.unit, currencySymbol: config.currencySymbol,
      pct: Math.min(100, (currentAmount / requiredAmount) * 100),
      pendingPct: pendingSpend > 0 ? Math.min(100, ((currentAmount + pendingSpend) / requiredAmount) * 100) : null,
    };
  }

  // Hyatt's Brand Explorer: 5 distinct sub-brands earns a free-night award
  // at a Category 1-5 property. Sub-brands are deduced from the logged
  // hotel names, so no manual tracking is needed.
  let brandExplorer: BrandExplorerProgress | null = null;
  if (p.name === 'World of Hyatt') {
    const subBrandsFor = (status: Hotel['status']) => {
      const found = new Set<string>();
      for (const h of hotels) {
        if (h.brand !== p.name || h.status !== status) continue;
        const sub = detectSubBrand(h.name, p.name);
        if (sub) found.add(sub);
      }
      return found;
    };
    const completed = subBrandsFor('Completed');
    const bookedSet = subBrandsFor('Booked');
    // Only count a booked brand as pending if it isn't already completed.
    const pendingOnly = [...bookedSet].filter((b) => !completed.has(b));
    const completedCount = completed.size;
    brandExplorer = {
      brandsStayed: [...completed].sort(),
      brandsPending: pendingOnly.sort(),
      completedCount,
      pendingCount: pendingOnly.length,
      vouchersEarned: Math.floor(completedCount / 5),
      brandsToNextVoucher: (5 - (completedCount % 5)) % 5 || 5,
    };
  }

  return {
    total,
    currentNights: effectiveCurrentNights,
    pct: p.nights != null && p.nightsNeeded != null ? (effectiveCurrentNights / total) * 100 : null,
    pct2: bookedNights > 0 ? (projectedBooked / total) * 100 : null,
    pct3: pendingNights > 0 ? (projectedWithPromo / total) * 100 : null,
    pendingPct: bookedNights + pendingNights > 0 ? (projectedWithPromo / total) * 100 : null,
    bookedNights,
    pendingPromo,
    pendingNights,
    cardEliteNights,
    spendProgress,
    brandExplorer,
  };
}
