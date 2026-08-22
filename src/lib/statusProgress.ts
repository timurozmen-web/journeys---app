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

// Real tier ladders per programme, lowest to highest. Used to work out
// which tier is genuinely still ahead -- a card that grants Platinum
// outright means Silver/Gold aren't meaningful targets any more.
const TIER_LADDERS: Record<string, string[]> = {
  'Marriott Bonvoy': ['Member', 'Silver', 'Gold', 'Platinum', 'Titanium Elite', 'Ambassador'],
  'IHG One Rewards': ['Club', 'Silver', 'Gold', 'Platinum', 'Diamond'],
  'Hilton Honors': ['Member', 'Silver', 'Gold', 'Diamond'],
  'World of Hyatt': ['Member', 'Discoverist', 'Explorist', 'Globalist'],
  'Accor ALL': ['Classic', 'Silver', 'Gold', 'Platinum', 'Diamond'],
};

// Nights required to reach each tier, from the programmes' real published
// requirements. Only needed where a card grants status outright and the
// app therefore has to work out the *next* real target itself.
const TIER_NIGHT_REQUIREMENTS: Record<string, Record<string, number>> = {
  'IHG One Rewards': { Silver: 10, Gold: 20, Platinum: 40, Diamond: 70 },
  'Marriott Bonvoy': { Silver: 10, Gold: 25, Platinum: 50, 'Titanium Elite': 75, Ambassador: 100 },
  // Diamond is points-only (26,000 status points), no night threshold --
  // intentionally omitted rather than guessed at.
  'Accor ALL': { Silver: 10, Gold: 30, Platinum: 60 },
};

/**
 * Works out the tier a member is genuinely working toward, accounting for
 * status granted outright by a card. Without this, holding a card that
 * grants Platinum would still show progress toward Silver, which is
 * meaningless -- the real target is the next tier above what's held.
 */
// Tier names vary in the wild ("Silver" vs "Silver Elite" vs "Platinum
// Elite"), so match on the distinctive word rather than requiring an
// exact string -- an exact indexOf silently returned -1 and broke tier
// resolution entirely.
function tierIndex(ladder: string[], tier: string | null | undefined): number {
  if (!tier) return -1;
  const t = tier.toLowerCase();
  let best = -1;
  for (let i = 0; i < ladder.length; i++) {
    const l = ladder[i].toLowerCase();
    if (t === l || t.includes(l) || l.includes(t)) {
      if (best === -1 || ladder[i].length > ladder[best].length) best = i;
    }
  }
  return best;
}

function resolveTargetTier(
  programmeName: string,
  storedNextTier: string | null | undefined,
  cardGrantedTier: string | null
): { targetTier: string | null; nightsNeeded: number | null } {
  const ladder = TIER_LADDERS[programmeName];
  if (!ladder || !cardGrantedTier) {
    return { targetTier: storedNextTier ?? null, nightsNeeded: null };
  }
  const grantedIdx = tierIndex(ladder, cardGrantedTier);
  const storedIdx = tierIndex(ladder, storedNextTier);
  if (grantedIdx >= 0 && grantedIdx >= storedIdx) {
    const nextUp = ladder[grantedIdx + 1] ?? null;
    const needed = nextUp ? TIER_NIGHT_REQUIREMENTS[programmeName]?.[nextUp] ?? null : null;
    return { targetTier: nextUp, nightsNeeded: needed };
  }
  return { targetTier: storedNextTier ?? null, nightsNeeded: null };
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
  appliedPromoNights: number; // status-boost bonus nights confirmed applied -- not auto-added to the total, since the user's own nights baseline should already reflect it once genuinely credited by the programme; shown as a visible confirmation instead
  pendingNights: number;
  cardEliteNights: CardEliteNights[];
  cardGrantedTier: string | null; // status held outright via a card, if any
  effectiveTier: string | null; // the tier actually held, card grant included
  targetTier: string | null; // the tier genuinely being worked toward
  uniqueBrandNights: number; // elite nights from a per-unique-brand promotion
  uniqueBrandCount: number;
  spendProgress: SpendProgress | null;
  brandExplorer: BrandExplorerProgress | null;
}

export function computeStatusProgress(
  p: LoyaltyProgramme,
  hotels: Hotel[],
  promotions: Promotion[],
  cardResults: { card: { id: string; programmeBrand: string; perks?: { id: string; label: string }[]; eliteNights: { auto: number; perSpendAmount: number | null; perSpendCap: number | null } }; autoSpend: number; cardRow?: { closedDate?: string | null } | null; milestoneResults?: { m: { id: string }; hit: boolean }[] }[] = []
): StatusProgress {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const newlyCompletedNights = p.nightsBaselineDate
    ? hotels
        .filter((h) => h.brand === p.name && h.status === 'Completed' && h.date > p.nightsBaselineDate! && !h.award)
        .reduce((s, h) => s + h.nights, 0)
    : 0;
  const currentNights = (p.nights ?? 0) + newlyCompletedNights;

  // A card may grant status outright (the IHG card gives Platinum, the
  // Marriott Debit gives Gold). Take the highest such grant from any open
  // card for this programme, so progress targets the next tier genuinely
  // still ahead rather than one already held.
  const ladder = TIER_LADDERS[p.name] ?? [];
  let cardGrantedTier: string | null = null;
  for (const r of cardResults) {
    if (r.card.programmeBrand !== p.name) continue;
    if (r.cardRow?.closedDate) continue;
    for (const perk of r.card.perks ?? []) {
      const match = ladder.find((t) => perk.label.toLowerCase().includes(t.toLowerCase()));
      if (match && (!cardGrantedTier || ladder.indexOf(match) > ladder.indexOf(cardGrantedTier))) {
        cardGrantedTier = match;
      }
    }
  }
  const { targetTier, nightsNeeded: resolvedNightsNeeded } = resolveTargetTier(p.name, p.nextTier, cardGrantedTier);
  // The tier genuinely held right now: the stored tier, unless a card
  // grants something higher outright.
  const effectiveTier =
    cardGrantedTier && tierIndex(ladder, cardGrantedTier) > tierIndex(ladder, p.tier)
      ? cardGrantedTier
      : p.tier ?? null;

  // Any stay for this brand this year that hasn't completed yet counts as
  // pending nights -- including in-progress and needs-confirm stays, not
  // only those explicitly marked Booked.
  const bookedNights = hotels
    .filter((h) => h.brand === p.name && h.status !== 'Completed' && !h.award && Number(h.date.slice(0, 4)) === currentYear)
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

  // Once a status-boost promotion is marked applied (the qualifying stay
  // has genuinely happened and the programme has credited it), its bonus
  // nights are real, banked progress -- not just "no longer pending".
  // Previously nothing added them anywhere once applied, so the bonus
  // silently vanished from the display entirely when ticked complete.
  const appliedPromoNights = promotions
    .filter(
      (promo) =>
        promo.promoType === 'status_boost' &&
        promo.statusNightsBonus != null &&
        promo.statusNightsApplied &&
        (!promo.brand || promo.brand === p.name)
    )
    .reduce((s, promo) => s + promo.statusNightsBonus!, 0);

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

    // Auto nights are granted for holding the card, but only actually
    // credit once the card's welcome requirement has been met. Until then
    // they're genuinely pending, not banked -- and they stay credited
    // afterwards for as long as the card remains open.
    if (en.auto > 0) {
      const welcomeMilestone = r.milestoneResults?.find((m) => m.m.id.startsWith('welcome'));
      const welcomeMet = welcomeMilestone ? welcomeMilestone.hit : true;
      cardEliteNights.push({
        cardId: r.card.id, nights: en.auto, earned: welcomeMet,
        note: welcomeMet
          ? `${en.auto} elite nights for holding ${r.card.id}`
          : `${en.auto} elite nights once the ${r.card.id} welcome bonus is met`,
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
      // Only surface the next spend threshold once there's real spend on
      // the card -- otherwise it's noise on a card that hasn't been used.
      const atCap = en.perSpendCap != null && earnedFromSpend >= en.perSpendCap;
      if (!atCap && r.autoSpend > 0) {
        const spendToNext = en.perSpendAmount - (r.autoSpend % en.perSpendAmount);
        cardEliteNights.push({
          cardId: r.card.id, nights: 1, earned: false,
          note: `+1 elite night at £${Math.round(spendToNext).toLocaleString()} more spend`,
        });
      }
    }
  }
  // Some promotions award a bonus elite night per *unique brand* stayed
  // within a window (Marriott ran exactly this). Counted from real logged
  // stays by deducing each stay's distinct sub-brand, so it reflects what
  // actually happened rather than needing manual entry.
  let uniqueBrandNights = 0;
  let uniqueBrandCount = 0;
  const uniqueBrandPromo =
    promotions.find(
      (promo) =>
        promo.promoType === 'status_boost' &&
        (promo.brand === p.name || !promo.brand) &&
        (!promo.endDate || promo.endDate >= today) && // only currently-active, not an already-expired past promotion
        /unique brand|per brand|brand bonus/i.test(`${promo.title} ${promo.description ?? ''}`)
    ) ?? null;
  if (uniqueBrandPromo) {
    const brandsInWindow = new Set<string>();
    for (const h of hotels) {
      if (h.brand !== p.name || h.status !== 'Completed') continue;
      if (uniqueBrandPromo.startDate && h.date < uniqueBrandPromo.startDate) continue;
      if (uniqueBrandPromo.endDate && h.date > uniqueBrandPromo.endDate) continue;
      const sub = detectSubBrand(h.name, p.name);
      if (sub) brandsInWindow.add(sub);
    }
    uniqueBrandCount = brandsInWindow.size;
    uniqueBrandNights = uniqueBrandCount;
  }

  const earnedCardNights = cardEliteNights.filter((c) => c.earned).reduce((s, c) => s + c.nights, 0);
  const pendingCardNights = cardEliteNights.filter((c) => !c.earned).reduce((s, c) => s + c.nights, 0);

  const pendingNights = promoNights + pendingCardNights;

  // Total nights needed for the tier genuinely being targeted -- uses the
  // resolved requirement when a card grants status outright, since the
  // stored nightsNeeded refers to a tier that may already be held.
  // Prefer the authoritative published requirement for whichever tier is
  // actually being targeted, whenever one is known -- not only when a
  // card-grant override triggered. Falling back to the stored nights +
  // nightsNeeded sum is risky: those two fields can drift out of
  // consistency with each other (exactly this happened for real -- nights
  // was corrected to 81 without also correcting nightsNeeded, silently
  // producing 81+23=104 instead of the real Ambassador requirement of 100).
  const effectiveTargetTier = targetTier ?? p.nextTier;
  const authoritativeTotal = effectiveTargetTier ? TIER_NIGHT_REQUIREMENTS[p.name]?.[effectiveTargetTier] : undefined;
  const total = authoritativeTotal ?? resolvedNightsNeeded ?? ((p.nights ?? 0) + (p.nightsNeeded ?? 0));
  // The stored nights value is the complete, real current total -- it
  // already reflects everything genuinely credited so far, including
  // card elite nights already earned and any past promotion bonus that's
  // already happened. Re-adding earned card nights on top double-counts
  // them (this was the exact cause of a real 81 showing as 111). Only
  // card nights genuinely not yet earned count separately, as pending.
  const effectiveCurrentNights = currentNights + uniqueBrandNights + earnedCardNights;
  const projectedBooked = Math.min(total, effectiveCurrentNights + bookedNights);
  const projectedWithPromo = Math.min(total, projectedBooked + pendingNights);

  let spendProgress: SpendProgress | null = null;
  const config = SPEND_CONFIGS[p.name];
  let requiredAmount: number | undefined;
  if (config && p.nextTier) {
    const tierKey = Object.keys(config.requiredByTier).find(
      (k) => k.toLowerCase() === p.nextTier!.toLowerCase() || p.nextTier!.toLowerCase().includes(k.toLowerCase())
    );
    requiredAmount = tierKey ? config.requiredByTier[tierKey] : undefined;
  }
  if (config && requiredAmount != null) {
    const completedSpendGBP = hotels
      .filter((h) => h.brand === p.name && h.status === 'Completed' && !h.award && Number(h.date.slice(0, 4)) === currentYear)
      .reduce((s, h) => s + (h.total ?? 0), 0);
    // Anything for this brand this year that hasn't completed yet counts
    // as pending spend -- including in-progress and needs-confirm stays,
    // not only those explicitly marked Booked, which was silently
    // excluding real upcoming spend.
    const pendingSpendGBP = hotels
      .filter((h) => h.brand === p.name && h.status !== 'Completed' && !h.award && Number(h.date.slice(0, 4)) === currentYear)
      .reduce((s, h) => s + (h.total ?? 0), 0);

    const rate = config.unit === 'points' ? config.pointsPerGBP! : config.fxRateFromGBP;
    const currentAmount = config.unit === 'points' && p.statusPointsOverride != null ? p.statusPointsOverride : completedSpendGBP * rate;
    const pendingSpend = pendingSpendGBP * rate;

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
    pct: p.nights != null && total > 0 ? (effectiveCurrentNights / total) * 100 : null,
    pct2: bookedNights > 0 ? (projectedBooked / total) * 100 : null,
    pct3: pendingNights > 0 ? (projectedWithPromo / total) * 100 : null,
    pendingPct: bookedNights + pendingNights > 0 ? (projectedWithPromo / total) * 100 : null,
    bookedNights,
    pendingPromo,
    appliedPromoNights,
    pendingNights,
    cardEliteNights,
    cardGrantedTier,
    effectiveTier,
    targetTier,
    uniqueBrandNights,
    uniqueBrandCount,
    spendProgress,
    brandExplorer,
  };
}
