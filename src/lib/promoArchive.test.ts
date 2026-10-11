import { describe, expect, it } from 'vitest';
import { promoArchiveReason } from './promoArchive';

const base = { endDate: null, promoType: 'multiplier' as const, discountUsed: false, statusNightsApplied: false };

describe('promoArchiveReason', () => {
  const today = '2026-10-11';
  it('keeps a running promotion', () => {
    expect(promoArchiveReason({ ...base, endDate: '2026-11-04' }, today)).toBeNull();
    expect(promoArchiveReason(base, today)).toBeNull();
  });
  it('archives one that has ended, been used or been applied', () => {
    expect(promoArchiveReason({ ...base, endDate: '2026-09-07' }, today)).toBe('ended');
    expect(promoArchiveReason({ ...base, promoType: 'fixed_discount', discountUsed: true }, today)).toBe('used');
    expect(promoArchiveReason({ ...base, promoType: 'status_boost', statusNightsApplied: true, endDate: '2026-09-30' }, today)).toBe('applied');
  });
});
