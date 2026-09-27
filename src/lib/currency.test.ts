import { describe, expect, test } from 'vitest';
import { convertCurrency, formatCurrency } from './currency';

// Rates are "1 GBP = X", matching how fetchExchangeRates returns them.
const rates = { USD: 1.27, EUR: 1.17 };

describe('convertCurrency', () => {
  test('same currency is a no-op', () => {
    expect(convertCurrency(100, 'EUR', 'EUR', rates)).toBe(100);
  });

  test('to and from GBP', () => {
    expect(convertCurrency(100, 'GBP', 'USD', rates)).toBeCloseTo(127);
    expect(convertCurrency(127, 'USD', 'GBP', rates)).toBeCloseTo(100);
  });

  test('between two non-GBP currencies goes via GBP', () => {
    expect(convertCurrency(127, 'USD', 'EUR', rates)).toBeCloseTo(117);
  });

  test('round trip returns the original amount', () => {
    const there = convertCurrency(250, 'EUR', 'USD', rates);
    expect(convertCurrency(there, 'USD', 'EUR', rates)).toBeCloseTo(250);
  });
});

describe('formatCurrency', () => {
  test('uses the right symbol and rounds to whole units', () => {
    expect(formatCurrency(1234.4, 'GBP')).toBe('£1,234');
    expect(formatCurrency(99.6, 'AUD')).toBe('A$100');
    expect(formatCurrency(15000, 'JPY')).toBe('¥15,000');
  });
});
