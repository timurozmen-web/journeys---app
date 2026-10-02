import { describe, expect, test } from 'vitest';
import { suggestCard } from './cardSuggest';

describe('suggestCard', () => {
  test('a brand with one card suggests it', () => {
    expect(suggestCard('Hilton Honors Card')).toBe('Hilton Debit');
    expect(suggestCard('IHG One Rewards Premier')).toBe('IHG Revolut Elite');
  });
  test('Marriott is two cards, so it needs Amex in the name to pick one', () => {
    expect(suggestCard('Marriott Bonvoy American Express', 'American Express')).toBe('Marriott Amex');
    expect(suggestCard('Marriott Bonvoy', 'Amex')).toBe('Marriott Amex');
    expect(suggestCard('Marriott Bonvoy Debit')).toBeNull();
  });
  test('an unrelated or generic name suggests nothing', () => {
    expect(suggestCard('Platinum Card', 'American Express')).toBeNull();
    expect(suggestCard('Current account')).toBeNull();
  });
});
