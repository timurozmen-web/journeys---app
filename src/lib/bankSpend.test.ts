import { describe, expect, test } from 'vitest';
import { groupBankSpend } from './bankSpend';

const row = (accountId: string, amount: number) => ({ accountId, date: '2026-05-01', amount, currency: 'GBP', merchant: null });

describe('groupBankSpend', () => {
  test('groups purchases under the card their account feeds', () => {
    const out = groupBankSpend(
      [{ id: 'a1', paymentCardId: 'Marriott Amex', syncedThrough: '2026-06-01' }, { id: 'a2', paymentCardId: 'Hilton Debit', syncedThrough: '2026-06-01' }],
      [row('a1', 10), row('a2', 20), row('a1', 5)],
    );
    expect(out['Marriott Amex'].map((r) => r.amount)).toEqual([10, 5]);
    expect(out['Hilton Debit'].map((r) => r.amount)).toEqual([20]);
  });

  test('a synced card with no purchases is still connected (empty list)', () => {
    expect(groupBankSpend([{ id: 'a1', paymentCardId: 'Accor Explorer', syncedThrough: '2026-06-01' }], [])).toEqual({ 'Accor Explorer': [] });
  });

  test('an account that has not synced yet leaves its card on logged spend', () => {
    expect(groupBankSpend([{ id: 'a1', paymentCardId: 'Accor Explorer', syncedThrough: null }], [])).toEqual({});
  });

  test('unmapped accounts contribute nothing', () => {
    expect(groupBankSpend([{ id: 'a1', paymentCardId: null, syncedThrough: '2026-06-01' }], [row('a1', 99)])).toEqual({});
  });

  test('two accounts feeding one card are added together', () => {
    const out = groupBankSpend(
      [{ id: 'a1', paymentCardId: 'Marriott Debit', syncedThrough: 'x' }, { id: 'a2', paymentCardId: 'Marriott Debit', syncedThrough: 'x' }],
      [row('a1', 1), row('a2', 2)],
    );
    expect(out['Marriott Debit']).toHaveLength(2);
  });
});
