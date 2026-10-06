import { CARDS_STATIC, customCardDef, defaultCardFor, cardYearWindow, milestonesFor } from '../data/cardDefs';
import type { CardDef, Milestone } from '../data/cardDefs';
import type { Hotel, Flight, LoyaltyProgramme, PaymentCard } from '../types';
import { bankRowsToItems, regionOfCountry, summariseSpend } from './earning';
import type { BankSpendRow, SpendItem, SpendSummary } from './earning';
import { spendPace } from './spendPace';
import type { Pace } from './spendPace';
import { addMonths } from './tripDay';

const ELITE_NIGHT_VALUE = 10; // £/night — placeholder default, confirmed with the user, not a real published figure

export interface MilestoneResult {
  m: Milestone;
  hit: boolean;
  value: number; // £
  superseded: boolean;
  // Spend counted toward this milestone: for a time-limited one (a
  // welcome bonus) only what was spent inside its window.
  spend: number;
  window: { start: string; end: string } | null; // the span this milestone is judged over
  missed: boolean;   // its window closed before the target was reached
  pace: Pace | null; // for spend milestones that are still open
}
export interface CardResult {
  card: CardDef;
  cardRow: PaymentCard | undefined;
  autoSpend: number;
  autoPts: number;
  summary: SpendSummary;   // card-year spend split into this card's earning categories
  connected: boolean;      // true when real bank spend feeds this card
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

export interface CardSpendInputs {
  // Real purchases per card id, from the connected bank. A card that has
  // an entry here (even an empty one) is "connected": its spend comes only
  // from the bank, so a stay you also logged against it isn't counted twice.
  bankSpend?: Record<string, BankSpendRow[]>;
  rates?: Record<string, number>; // 1 GBP = X, for any spend billed in another currency
}

// Spend a card hasn't got bank data for, estimated from what you logged:
// stays paid with it, Virgin Atlantic flights, and any manual figure.
function loggedSpendItems(card: CardDef, hotels: Hotel[], flights: Flight[], cardRow: PaymentCard | undefined): SpendItem[] {
  const items: SpendItem[] = [];
  for (const h of hotels) {
    const cardForHotel = h.card || defaultCardFor(h.brand);
    if (cardForHotel !== card.id || !h.total) continue;
    items.push({ date: h.date, amount: h.total, own: h.brand === card.programmeBrand, region: regionOfCountry(h.country), source: 'hotel', basis: 'logged' });
  }
  // Virgin Atlantic flight spend auto-attributes to the Virgin card --
  // there's no per-flight card tag.
  if (card.programmeBrand === 'Virgin Points') {
    for (const f of flights) {
      if (f.airline !== 'Virgin Atlantic' || !f.cost || !f.date) continue;
      items.push({ date: f.date, amount: f.cost, own: true, region: 'elsewhere', source: 'flight', basis: 'logged' });
    }
  }
  // Spend not captured by a logged hotel/flight (everyday purchases etc):
  // counts toward milestones AND earns points at the card's general rate,
  // in the region you said it was in. It has no date.
  const manual = cardRow?.manualSpendAdjustment ?? 0;
  if (manual) {
    items.push({ date: null, amount: manual, own: false, region: (cardRow?.manualSpendIsUK ?? true) ? 'uk' : 'elsewhere', source: 'manual', basis: 'logged' });
  }
  return items;
}

export function computeCardResults(
  hotels: Hotel[],
  flights: Flight[],
  paymentCards: PaymentCard[],
  loyaltyProgrammes: LoyaltyProgramme[],
  today: string,
  inputs: CardSpendInputs = {},
): CardResult[] {
  const ptValueByBrand = new Map(loyaltyProgrammes.map((p) => [p.name, p.ptValue]));

  // The catalogue, plus any card the user added by hand that isn't in it.
  const defs = [...CARDS_STATIC, ...paymentCards.filter((c) => !CARDS_STATIC.some((d) => d.id === c.id)).map(customCardDef)];

  return defs.map((card) => {
    const cardRow = paymentCards.find((c) => c.id === card.id);
    const ptVal = ptValueByBrand.get(card.programmeBrand) ?? 1;
    const yearWindow = cardYearWindow(cardRow?.openDate ?? null, today);

    const bankRows = inputs.bankSpend?.[card.id];
    const connected = bankRows !== undefined;
    const items = connected ? bankRowsToItems(card, bankRows, inputs.rates) : loggedSpendItems(card, hotels, flights, cardRow);

    const summary = summariseSpend(card, items, yearWindow, today);
    const autoSpend = summary.totalSpend;
    const autoPts = summary.totalPoints;

    const milestoneResults: MilestoneResult[] = milestonesFor(card, cardRow?.openDate ?? null).map((m) => {
      const value = Math.round((m.rewardPoints * ptVal) / 100);
      if (m.type === 'tick') {
        return { m, hit: true, value, superseded: false, spend: 0, window: null, missed: false, pace: null };
      }
      const target = m.spendRequired ?? Infinity;

      // A welcome bonus has to be earned within its own window from the
      // card's opening (e.g. £3k in the first 3 months). Judging it
      // against the whole card-year instead would call it "hit" for
      // spend that came too late to qualify. Only dated spend can be
      // placed in a window; a manual figure has no date, so it keeps
      // counting, as it always has -- it's your own statement of spend.
      let window = yearWindow;
      const counted = items;
      let windowClosed = false;
      if (m.windowMonths && cardRow?.openDate) {
        window = { start: cardRow.openDate, end: addMonths(cardRow.openDate, m.windowMonths) };
        windowClosed = today >= window.end;
      }
      const spend = summariseSpend(card, m.abroadOnly ? counted.filter((it) => it.region !== 'uk') : counted, window, today).totalSpend;
      const hit = spend >= target;
      const missed = !hit && windowClosed;
      const pace = !hit && !missed && window ? spendPace({ spent: spend, target, windowStart: window.start, windowEnd: window.end, today }) : null;
      return { m, hit, value, superseded: false, spend, window, missed, pace };
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
    // The next goal worth chasing: the lowest spend target that is neither
    // reached nor out of time.
    const nextMilestone = milestoneResults.filter((r) => !r.hit && !r.missed && r.m.type === 'spend').sort((a, b) => (a.m.spendRequired ?? 0) - (b.m.spendRequired ?? 0))[0] ?? null;

    return { card, cardRow, autoSpend, autoPts, summary, connected, yearWindow, milestoneResults, milestoneValue, totalEliteNights, eliteNightValue, ptsValue, gross, net, nextMilestone };
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
      // Bug fixed: a renewal reward was dated from the start of the card year
      // and shown expiring at its end -- i.e. on the day it is actually issued.
      // It arrives at renewal and is valid from then (and only if the card is
      // still open at renewal).
      if (m.m.issuedAtRenewal) {
        if (r.cardRow?.closedDate && r.cardRow.closedDate < r.yearWindow.end) continue;
        candidates.push({
          name: m.m.rewardLabel, source: r.card.id, value: m.value,
          earnedDate: r.yearWindow.end,
          expiryDate: m.m.validMonths ? addMonths(r.yearWindow.end, m.m.validMonths) : null,
          sourceKey: `${r.card.id}::${m.m.id}::${r.yearWindow.start}`,
        });
        continue;
      }
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
