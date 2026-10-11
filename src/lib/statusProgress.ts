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

// A night credited on top of stays: from a card, a paid membership (ALL
// Accor+ Explorer) or a status promotion. `earned` is credited; otherwise
// it is still to come (a welcome bonus not yet met, a renewal later this
// year, the next spend threshold).
export interface BonusNight {
  source: 'card' | 'membership' | 'promo';
  from: string; // the card, membership or promotion it comes from
  nights: number;
  earned: boolean;
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
  currentNights: number; // stays plus every bonus night already credited this year
  pct: number | null; // current, solid segment
  pct2: number | null; // + booked nights, projected
  pct3: number | null; // + pending promotion bonus nights, projected
  pendingPct: number | null; // + booked and/or promo nights combined, whichever is present -- always populated when either exists
  bookedNights: number;
  pendingPromo: Promotion | null;
  pendingNights: number;
  bonusNights: BonusNight[];
  cardGrantedTier: string | null; // status held outright via a card, if any
  effectiveTier: string | null; // the tier actually held, card grant included
  targetTier: string | null; // the tier genuinely being worked toward
  uniqueBrandNights: number; // elite nights from a per-unique-brand promotion
  uniqueBrandCount: number;
  spendProgress: SpendProgress | null;
  brandExplorer: BrandExplorerProgress | null;
  // Where this year's nights came from, for the status ring.
  // stays + card + membership + promos = currentNights; pending is booked
  // stays plus bonus nights still to come.
  breakdown: { stays: number; card: number; membership: number; promos: number; pending: number };
}

type StatusCardInput = {
  card: { id: string; programmeBrand: string; kind?: 'card' | 'subscription'; perks?: { id: string; label: string }[]; eliteNights: { auto: number; perSpendAmount: number | null; perSpendCap: number | null } };
  autoSpend: number;
  cardRow?: { closedDate?: string | null; openDate?: string | null } | null;
  milestoneResults?: { m: { id: string }; hit: boolean }[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

// The stored `nights` are the nights *stayed* this year as of the
// programme's baseline date. Bonus nights (cards, memberships, promotions)
// are never part of it: they are added here from their own source, each
// once. Rolling the baseline forward used to store the full total, bonuses
// included, and the next read added them again -- how a real 81 came to
// show as 111.
export function computeStatusProgress(
  p: LoyaltyProgramme,
  hotels: Hotel[],
  promotions: Promotion[],
  cardResults: StatusCardInput[] = [],
  today: string = new Date().toISOString().slice(0, 10),
): StatusProgress {
  const currentYear = Number(today.slice(0, 4));
  const yearStart = `${currentYear}-01-01`;

  // Every programme here counts status nights per calendar year, so a
  // figure entered last year says nothing about this one: once the year
  // turns, count from this year's stays alone rather than carrying last
  // year's total forward.
  const baseline = p.nightsBaselineDate;
  const staleBaseline = !!baseline && baseline < yearStart;
  const newlyCompletedNights = baseline
    ? hotels
        .filter((h) => h.brand === p.name && h.status === 'Completed' && h.date > baseline && h.date >= yearStart && !h.award)
        .reduce((s, h) => s + h.nights, 0)
    : 0;
  const currentNights = (staleBaseline ? 0 : p.nights ?? 0) + newlyCompletedNights;

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
  // Only a promotion that ran this year counts toward this year's nights.
  const appliedPromos = promotions.filter(
    (promo) =>
      promo.promoType === 'status_boost' &&
      promo.statusNightsBonus != null &&
      promo.statusNightsApplied &&
      (!promo.brand || promo.brand === p.name) &&
      (!promo.endDate || promo.endDate >= yearStart)
  );

  // Elite nights granted by holding a card or membership for this
  // programme. These are real, ongoing status progress -- an IHG card's 15
  // elite nights apply every year the card stays open, and spend-earned
  // nights accrue on top. Only open (non-closed) ones count, since the
  // benefit stops when the card or membership ends.
  const bonusNights: BonusNight[] = [];
  for (const r of cardResults) {
    if (r.card.programmeBrand !== p.name) continue;
    if (r.cardRow?.closedDate) continue; // benefit ends with the card
    const en = r.card.eliteNights;

    // A membership (ALL Accor+ Explorer) credits its nights when it starts
    // and again at each renewal. Nights count per calendar year, so this
    // year's credit is the one from a start or renewal dated this year:
    // one still ahead is to come, not credited.
    if (r.card.kind === 'subscription') {
      if (en.auto <= 0) continue;
      const open = r.cardRow?.openDate ?? null;
      const credit = !open ? null : open >= yearStart ? open : `${currentYear}${open.slice(4)}`;
      const earned = !credit || credit <= today;
      bonusNights.push({
        source: 'membership', from: r.card.id, nights: en.auto, earned,
        note: !credit ? r.card.id : earned ? `${r.card.id}, ${dayMonth(credit)}` : `${r.card.id} renews ${dayMonth(credit)}`,
      });
      continue;
    }

    // Auto nights are granted for holding the card, but only actually
    // credit once the card's welcome requirement has been met. Until then
    // they're genuinely pending, not banked -- and they stay credited
    // afterwards for as long as the card remains open.
    if (en.auto > 0) {
      const welcomeMilestone = r.milestoneResults?.find((m) => m.m.id.startsWith('welcome'));
      const welcomeMet = welcomeMilestone ? welcomeMilestone.hit : true;
      bonusNights.push({
        source: 'card', from: r.card.id, nights: en.auto, earned: welcomeMet,
        note: welcomeMet ? r.card.id : `${r.card.id}, once the welcome bonus is met`,
      });
    }

    if (en.perSpendAmount) {
      let earnedFromSpend = Math.floor(r.autoSpend / en.perSpendAmount);
      if (en.perSpendCap != null) earnedFromSpend = Math.min(earnedFromSpend, en.perSpendCap);
      if (earnedFromSpend > 0) {
        bonusNights.push({
          source: 'card', from: r.card.id, nights: earnedFromSpend, earned: true,
          note: `${r.card.id}, £${Math.round(r.autoSpend).toLocaleString()} spent`,
        });
      }
      // Only surface the next spend threshold once there's real spend on
      // the card -- otherwise it's noise on a card that hasn't been used.
      const atCap = en.perSpendCap != null && earnedFromSpend >= en.perSpendCap;
      if (!atCap && r.autoSpend > 0) {
        const spendToNext = en.perSpendAmount - (r.autoSpend % en.perSpendAmount);
        bonusNights.push({
          source: 'card', from: r.card.id, nights: 1, earned: false,
          note: `${r.card.id}, £${Math.round(spendToNext).toLocaleString()} more spend`,
        });
      }
    }
  }
  for (const promo of appliedPromos) {
    bonusNights.push({ source: 'promo', from: promo.title, nights: promo.statusNightsBonus!, earned: true, note: promo.title });
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
    if (uniqueBrandNights > 0) {
      bonusNights.push({ source: 'promo', from: uniqueBrandPromo.title, nights: uniqueBrandNights, earned: true, note: `${uniqueBrandPromo.title}, ${uniqueBrandCount} brands` });
    }
  }
  if (pendingPromo) {
    bonusNights.push({ source: 'promo', from: pendingPromo.title, nights: promoNights, earned: false, note: `${pendingPromo.title}, after your next stay` });
  }

  const credited = (source: BonusNight['source']) =>
    bonusNights.filter((b) => b.source === source && b.earned).reduce((s, b) => s + b.nights, 0);
  const earnedCardNights = credited('card');
  const membershipNights = credited('membership');
  const promoCreditedNights = credited('promo');
  const pendingBonusNights = bonusNights.filter((b) => !b.earned && b.source !== 'promo').reduce((s, b) => s + b.nights, 0);

  const pendingNights = promoNights + pendingBonusNights;

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
  const effectiveCurrentNights = currentNights + earnedCardNights + membershipNights + promoCreditedNights;
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
    pendingNights,
    bonusNights,
    cardGrantedTier,
    effectiveTier,
    targetTier,
    uniqueBrandNights,
    uniqueBrandCount,
    spendProgress,
    brandExplorer,
    breakdown: {
      stays: currentNights,
      card: earnedCardNights,
      membership: membershipNights,
      promos: promoCreditedNights,
      pending: bookedNights + pendingNights,
    },
  };
}
