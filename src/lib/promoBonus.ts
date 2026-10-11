import type { Hotel, Promotion } from '../types';

// Bonus points from "bonus" promotions (promo type threshold_bonus), which
// the points engine used to ignore entirely. Their terms are read from the
// promotion's own wording, the way programmes publish them:
//   "every 2 nights"                -> a bonus per 2 nights (Ruby, Hyatt)
//   "beginning on your second stay" -> earlier stays don't count
//   "on your second stay"           -> once, on that stay (IHG's targeted 10k)
//   "stays of 2+ nights"            -> once per stay that long (Marriott Fall 2026)
//   "at Ruby Hotels"                -> only stays at that brand
// A promotion whose wording names none of these earns nothing here rather
// than a guessed bonus.

export interface PromoTerms {
  perNights: number | null;
  minNights: number | null;
  nthStay: number | null;
  fromStay: number;
  onlyAt: string | null;
}

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
};
const num = (s: string) => WORD_NUM[s] ?? parseInt(s, 10);
const N = '(\\d+|one|two|three|four|five)';
const ORD = '(\\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth)';

export function promoTerms(p: Pick<Promotion, 'title' | 'description'>): PromoTerms {
  const text = `${p.title} ${p.description ?? ''}`.toLowerCase().replace(/,/g, '');
  const per = text.match(new RegExp(`every ${N} (?:eligible |qualifying |paid )?nights?`)) ?? text.match(new RegExp(`per ${N} nights?`));
  const pair = /each pair of nights/.test(text) ? 2 : null;
  const from = text.match(new RegExp(`(?:beginning|starting|from) (?:on |with )?(?:your |the )?${ORD} (?:eligible |qualifying )?stay`));
  const nth = from ? null : text.match(new RegExp(`(?:on|for) (?:your |the )?${ORD} (?:eligible |qualifying |paid )?stay`));
  const min = text.match(new RegExp(`stays? of ${N}\\+? (?:or more )?nights?`)) ?? text.match(new RegExp(`minimum (?:of )?${N} nights?`));
  const at = text.match(/\bat ([a-z][a-z&' ]*?) (?:hotels|properties)\b/);
  // "at all hotels participating in World of Hyatt" names no brand.
  const brandAt = at && !/^(all|any|select|participating|eligible|our|these|its)\b/.test(at[1]) ? at[1].trim() : null;
  return {
    perNights: per ? num(per[1]) : pair,
    minNights: min ? num(min[1]) : null,
    nthStay: nth ? num(nth[1]) : null,
    fromStay: from ? num(from[1]) : 1,
    onlyAt: brandAt,
  };
}

// "Hyatt" on a promotion is "World of Hyatt" on a stay.
function brandMatches(promoBrand: string | null, stayBrand: string): boolean {
  if (!promoBrand) return true;
  const a = promoBrand.toLowerCase();
  const b = stayBrand.toLowerCase();
  return a === b || b.includes(a.split(' ')[0]) || a.includes(b.split(' ')[0]);
}

/**
 * Bonus points a stay earns from bonus promotions. `stays` is every stay
 * logged (for "second stay" and nights counted across stays); only paid,
 * non-award stays at the promotion's brand and inside its dates count.
 */
export function promoBonusForStay(h: Hotel, stays: Hotel[], promotions: Promotion[]): number {
  if (h.award || !h.total) return 0;
  let bonus = 0;
  for (const p of promotions) {
    if (p.promoType !== 'threshold_bonus' || !p.bonusPoints) continue;
    const terms = promoTerms(p);
    const fits = (s: Hotel) =>
      brandMatches(p.brand, s.brand) && !s.award && !!s.total && s.status !== 'needs-confirm'
      && (!p.startDate || s.date >= p.startDate) && (!p.endDate || s.date <= p.endDate)
      && (!terms.onlyAt || s.name.toLowerCase().includes(terms.onlyAt));
    if (!fits(h)) continue;
    const eligible = stays.filter(fits).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const rank = eligible.findIndex((s) => s.id === h.id) + 1;
    if (rank === 0 || rank < terms.fromStay) continue;
    if (terms.nthStay != null) {
      if (rank === terms.nthStay) bonus += p.bonusPoints;
    } else if (terms.perNights != null) {
      // Nights add up across stays: a bonus each time the running total
      // passes another multiple.
      const counted = eligible.slice(terms.fromStay - 1);
      const i = counted.findIndex((s) => s.id === h.id);
      const before = counted.slice(0, i).reduce((s, x) => s + x.nights, 0);
      const through = before + h.nights;
      bonus += (Math.floor(through / terms.perNights) - Math.floor(before / terms.perNights)) * p.bonusPoints;
    } else if (terms.minNights != null) {
      if (h.nights >= terms.minNights) bonus += p.bonusPoints;
    }
  }
  return bonus;
}
