import { CARDS_STATIC, defaultCardFor, cardYearWindow, isEuropeOrUK, isIHGPremiumCountry } from '../data/cardDefs';
import type { CardDef, Milestone } from '../data/cardDefs';
import type { Hotel, Flight, LoyaltyProgramme, PaymentCard } from '../types';

const ELITE_NIGHT_VALUE = 10; // £/night — placeholder default, confirmed with the user, not a real published figure

export interface MilestoneResult {
  m: Milestone;
  hit: boolean;
  value: number; // £
  superseded: boolean;
}
export interface CardResult {
  card: CardDef;
  cardRow: PaymentCard | undefined;
  autoSpend: number;
  autoPts: number;
  yearWindow: { start: string; end: string } | null;
  milestoneResults: MilestoneResult[];
  milestoneValue: number;
  totalEliteNights: number;
  eliteNightValue: number;
  ptsValue: number;
  gross: number;
  net: number;
  nextMilestone: MilestoneResult | null;
}

export function computeCardResults(
  hotels: Hotel[],
  flights: Flight[],
  paymentCards: PaymentCard[],
  loyaltyProgrammes: LoyaltyProgramme[],
  today: string
): CardResult[] {
  const ptValueByBrand = new Map(loyaltyProgrammes.map((p) => [p.name, p.ptValue]));

  return CARDS_STATIC.map((card) => {
    const cardRow = paymentCards.find((c) => c.id === card.id);
    const ptVal = ptValueByBrand.get(card.programmeBrand) ?? 1;
    const yearWindow = cardYearWindow(cardRow?.openDate ?? null, today);

    let autoSpend = 0;
    let autoPts = 0;

    for (const h of hotels) {
      const cardForHotel = h.card || defaultCardFor(h.brand);
      if (cardForHotel !== card.id || !h.total) continue;
      if (yearWindow && (h.date < yearWindow.start || h.date >= yearWindow.end)) continue;
      const rate = card.rateFor({
        ownBrand: h.brand === card.programmeBrand,
        isUK: h.country === 'United Kingdom',
        isUKEurope: isEuropeOrUK(h.country),
        isPremiumCountry: isIHGPremiumCountry(h.country),
        date: h.date,
      });
      autoSpend += h.total;
      autoPts += h.total * rate;
    }

    // Virgin Atlantic flight spend auto-attributes to the Virgin card,
    // same special case as the old app -- there's no per-flight card tag.
    if (card.programmeBrand === 'Virgin Points') {
      for (const f of flights) {
        if (f.airline !== 'Virgin Atlantic' || !f.cost || !f.date) continue;
        if (yearWindow && (f.date < yearWindow.start || f.date >= yearWindow.end)) continue;
        const rate = card.rateFor({ ownBrand: true, isUK: false, isUKEurope: false, isPremiumCountry: false, date: f.date });
        autoSpend += f.cost;
        autoPts += f.cost * rate;
      }
    }

    const milestoneResults: MilestoneResult[] = card.milestones.map((m) => {
      const hit = m.type === 'tick' ? true : autoSpend >= (m.spendRequired ?? Infinity);
      return { m, hit, value: Math.round((m.rewardPoints * ptVal) / 100), superseded: false };
    });
    // If a higher milestone that supersedes a lower one is hit, don't double-count the lower one.
    for (const r of milestoneResults) {
      if (r.hit && r.m.supersedes) {
        const lower = milestoneResults.find((x) => x.m.id === r.m.supersedes);
        if (lower) lower.superseded = true;
      }
    }
    const milestoneValue = milestoneResults.filter((r) => r.hit && !r.superseded).reduce((s, r) => s + r.value, 0);

    const en = card.eliteNights;
    let earnedEN = en.perSpendAmount ? Math.floor(autoSpend / en.perSpendAmount) : 0;
    if (en.perSpendCap != null) earnedEN = Math.min(earnedEN, en.perSpendCap);
    const totalEliteNights = en.auto + earnedEN;
    const eliteNightValue = totalEliteNights * ELITE_NIGHT_VALUE;

    const ptsValue = Math.round(autoPts) * ptVal / 100;
    const gross = ptsValue + milestoneValue + eliteNightValue; // perks intentionally excluded -- no fixed value, confirmed
    const net = gross - card.annualFee;
    const nextMilestone = milestoneResults.filter((r) => !r.hit && r.m.type === 'spend').sort((a, b) => (a.m.spendRequired ?? 0) - (b.m.spendRequired ?? 0))[0] ?? null;

    return { card, cardRow, autoSpend, autoPts: Math.round(autoPts), yearWindow, milestoneResults, milestoneValue, totalEliteNights, eliteNightValue, ptsValue, gross, net, nextMilestone };
  });
}

// Hit, non-superseded milestones flagged isVoucher become real voucher
// candidates -- the sourceKey is stable per card-year, so re-running this
// on every load never creates duplicates, only genuinely new vouchers.
export function computeCardVoucherCandidates(results: CardResult[]) {
  const candidates: { name: string; source: string; value: number; earnedDate: string; expiryDate: string | null; sourceKey: string }[] = [];
  for (const r of results) {
    if (!r.yearWindow) continue;
    for (const m of r.milestoneResults) {
      if (!m.hit || m.superseded || !m.m.isVoucher) continue;
      candidates.push({
        name: m.m.rewardLabel,
        source: r.card.id,
        value: m.value,
        earnedDate: r.yearWindow.start,
        expiryDate: r.yearWindow.end,
        sourceKey: `${r.card.id}::${m.m.id}::${r.yearWindow.start}`,
      });
    }
  }
  return candidates;
}
