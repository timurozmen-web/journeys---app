import type { Hotel, LoyaltyProgramme, Promotion, Voucher } from '../types';
import type { CardResult } from './cardMath';
import { computeStatusProgress } from './statusProgress';
import { paceLine } from './spendPace';
import { daysBetweenISO } from './tripDay';

// "Worth knowing" on the Loyalty home: only what is true right now, from
// real figures. Elite status close at hand, the cards nearest their next
// spend milestone, renewals within 45 days (keep or cancel, from the
// card-year's real value against its fee), and vouchers expiring within
// 90 days.

export interface Highlight {
  key: string;
  tone: 'brand' | 'green' | 'red' | 'amber';
  title: string;
  subtitle: string;
  progressPct?: number;
}

export function loyaltyHighlights({ programmes, hotels, promotions, cardResults, vouchers, today }: {
  programmes: LoyaltyProgramme[]; hotels: Hotel[]; promotions: Promotion[]; cardResults: CardResult[]; vouchers: Voucher[]; today: string;
}): Highlight[] {
  const out: Highlight[] = [];

  const status = programmes
    .filter((p) => p.nextTier && p.nights != null && p.nightsNeeded != null)
    .map((p) => ({ p, progress: computeStatusProgress(p, hotels, promotions, cardResults) }))
    .filter((x) => x.progress.total > x.progress.currentNights)
    .sort((a, b) => (b.progress.pct ?? 0) - (a.progress.pct ?? 0))
    .slice(0, 3);
  for (const { p, progress } of status) {
    const remaining = progress.total - progress.currentNights;
    out.push({
      key: `status-${p.name}`, tone: 'brand',
      title: `${remaining} night${remaining === 1 ? '' : 's'} to ${progress.targetTier} with ${p.name}`,
      subtitle: `${progress.currentNights} of ${progress.total} nights${progress.bookedNights > 0 ? ` · ${progress.bookedNights} booked` : ''}`,
      progressPct: Math.max(0, Math.min(100, progress.pct ?? 0)),
    });
  }

  const milestones = cardResults
    .filter((r) => r.nextMilestone && r.nextMilestone.m.spendRequired)
    .map((r) => ({ r, pct: Math.min(100, (r.nextMilestone!.spend / r.nextMilestone!.m.spendRequired!) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);
  for (const { r, pct } of milestones) {
    const next = r.nextMilestone!;
    const remaining = Math.max(0, next.m.spendRequired! - next.spend);
    const programme = programmes.find((p) => p.name === r.card.programmeBrand);
    const estValue = programme?.ptValue ? Math.round((next.m.rewardPoints * programme.ptValue) / 100) : null;
    const pace = next.pace ? paceLine(next.pace) : null;
    out.push({
      key: `card-milestone-${r.card.id}`, tone: 'brand',
      title: `Spend £${Math.round(remaining).toLocaleString()} on the ${r.card.id}`,
      subtitle: `Turns into ${next.m.rewardLabel}${estValue ? `, worth about £${estValue}` : ''}${pace ? ` · ${pace}` : ''}`,
      progressPct: pct,
    });
  }

  for (const r of cardResults) {
    if (!r.cardRow || r.card.custom || r.cardRow.closedDate || !r.yearWindow || r.card.annualFee <= 0) continue;
    const days = daysBetweenISO(today, r.yearWindow.end);
    if (days < 0 || days > 45) continue;
    const keep = r.net >= 0;
    out.push({
      key: `renewal-${r.card.id}`, tone: keep ? 'green' : 'red',
      title: `${r.card.id} renews in ${days} day${days === 1 ? '' : 's'}`,
      subtitle: keep
        ? `Worth keeping: £${Math.round(r.net)} ahead of the £${r.card.annualFee} fee this year`
        : `Consider cancelling: £${Math.round(r.gross)} of value against a £${r.card.annualFee} fee this year`,
    });
  }

  const expiring = vouchers
    .filter((v) => !v.redeemed && v.expiryDate && v.expiryDate >= today)
    .map((v) => ({ v, days: daysBetweenISO(today, v.expiryDate!) }))
    .filter((x) => x.days <= 90)
    .sort((a, b) => a.days - b.days)
    .slice(0, 2);
  for (const { v, days } of expiring) {
    out.push({
      key: `voucher-${v.id}`, tone: 'amber',
      title: `${v.name} expires in ${days} day${days === 1 ? '' : 's'}`,
      subtitle: v.value ? `Worth about £${Math.round(v.value)} · from ${v.source}` : `From ${v.source}`,
    });
  }
  return out;
}
