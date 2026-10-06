import { describe, expect, test } from 'vitest';
import { badgeLabel } from './badges';

describe('badgeLabel', () => {
  test('nothing, a number, or 9+', () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(1)).toBe('1');
    expect(badgeLabel(9)).toBe('9');
    expect(badgeLabel(10)).toBe('9+');
    expect(badgeLabel(42)).toBe('9+');
  });
});
