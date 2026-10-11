import type { Promotion } from '../types';

/**
 * Why a promotion has moved to Archived, or null while it still matters.
 * It has served its purpose once it has ended, once a discount has been
 * used, or once a status boost has been applied. Archived promotions still
 * count where they should (an applied status boost stays in the nights).
 */
export function promoArchiveReason(p: Pick<Promotion, 'endDate' | 'promoType' | 'discountUsed' | 'statusNightsApplied'>, today: string): 'ended' | 'used' | 'applied' | null {
  if (p.promoType === 'status_boost' && p.statusNightsApplied) return 'applied';
  if (p.promoType === 'fixed_discount' && p.discountUsed) return 'used';
  if (p.endDate && p.endDate < today) return 'ended';
  return null;
}
