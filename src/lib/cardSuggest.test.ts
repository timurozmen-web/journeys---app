import { describe, expect, test } from 'vitest';
import { suggestCard } from './cardSuggest';

describe('suggestCard', () => {
  test('a brand with one card suggests it', () => {
    expect(suggestCard('Hilton Honors Card')).toBe('Hilton Debit');
    expect(suggestCard('IHG One Rewards Premier')).toBe('IHG Revolut Elite');
  });
  test('Marriott is two cards, told apart by Amex or Debit in the name', () => {
    expect(suggestCard('Marriott Bonvoy American Express', 'American Express')).toBe('Marriott Amex');
    expect(suggestCard('Marriott Bonvoy', 'Amex')).toBe('Marriott Amex');
    expect(suggestCard('Marriott Bonvoy Debit')).toBe('Marriott Debit');
    expect(suggestCard('Marriott Bonvoy')).toBeNull();
  });
  test('British Airways cards: Premium Plus is told apart from the free card', () => {
    expect(suggestCard('British Airways American Express Premium Plus Card', 'American Express')).toBe('BA Amex Premium Plus');
    expect(suggestCard('British Airways American Express Credit Card', 'American Express')).toBe('BA Amex');
    expect(suggestCard('Avios Amex')).toBe('BA Amex');
  });
  test('names the bank cuts short are still told apart (the Amex feed cuts at 35 characters)', () => {
    expect(suggestCard('British Airways American Express® P', 'American Express')).toBe('BA Amex Premium Plus');
    expect(suggestCard('British Airways American Express® C', 'American Express')).toBe('BA Amex');
    expect(suggestCard('Marriott Bonvoy American Express® C', 'American Express')).toBe('Marriott Amex');
    expect(suggestCard('British Airways American Express® Premium Plus Card', 'American Express')).toBe('BA Amex Premium Plus');
    expect(suggestCard('British Airways American Express® Credit Card', 'American Express')).toBe('BA Amex');
  });
  test('an unrelated or generic name suggests nothing', () => {
    expect(suggestCard('Platinum Card', 'American Express')).toBeNull();
    expect(suggestCard('Current account')).toBeNull();
  });
});
