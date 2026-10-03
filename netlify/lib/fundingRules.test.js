import { describe, expect, test } from 'vitest';
import { FUNDING_RULES, fundingSpendRow } from './fundingRules.js';

const rule = FUNDING_RULES['Marriott Debit'];
const txn = (description, amount = -42.5, extra = {}) => ({
  transaction_id: `t-${description}`, timestamp: '2026-09-10T10:00:00Z', amount, currency: 'GBP', transaction_category: 'PURCHASE', description, ...extra,
});

describe('Marriott Debit (Currensea via Monzo)', () => {
  test('a Mbv-numbered line counts, with the prefix removed from the merchant', () => {
    expect(fundingSpendRow(rule, txn('Mbv04 Courtyard By Marriott'))).toMatchObject({ amount: 42.5, merchant: 'Courtyard By Marriott', txn_date: '2026-09-10' });
    expect(fundingSpendRow(rule, txn('Mbv05 Zola.Comregi'))?.merchant).toBe('Zola.Comregi');
    expect(fundingSpendRow(rule, txn('Mbv03 Uber Train'))?.merchant).toBe('Uber Train');
  });

  test('the running number can be any length and the case does not matter', () => {
    expect(fundingSpendRow(rule, txn('MBV123 Hotel'))?.merchant).toBe('Hotel');
    expect(fundingSpendRow(rule, txn('mbv7 shop'))?.merchant).toBe('shop');
  });

  test('other Monzo spending is not the card\'s', () => {
    for (const d of ['Tesco', 'Uber Train', 'Mbv Courtyard', 'MBVS Ltd', 'Pret Mbv04']) expect(fundingSpendRow(rule, txn(d))).toBeNull();
  });

  test('does not depend on the bank\'s category for the line', () => {
    expect(fundingSpendRow(rule, txn('Mbv04 Hotel', -10, { transaction_category: 'DEBIT' }))).not.toBeNull();
    expect(fundingSpendRow(rule, txn('Mbv04 Hotel', -10, { transaction_category: 'TRANSFER' }))).not.toBeNull();
  });

  test('money coming in is a refund, not spend', () => {
    expect(fundingSpendRow(rule, txn('Mbv04 Hotel', 42.5))).toBeNull();
  });

  test('also matches when the bank puts the text in merchant_name', () => {
    expect(fundingSpendRow(rule, txn('Card payment', -9, { merchant_name: 'Mbv09 Hilton' }))?.merchant).toBe('Hilton');
  });
});
