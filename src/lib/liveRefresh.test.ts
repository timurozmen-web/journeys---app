import { describe, expect, test } from 'vitest';
import { shouldReplace } from './liveRefresh';

describe('shouldReplace', () => {
  test('rows always replace what is shown', () => {
    expect(shouldReplace(3, false)).toBe(true);
    expect(shouldReplace(3, true)).toBe(true);
  });
  test('an empty table that never had data keeps the sample data', () => {
    expect(shouldReplace(0, false)).toBe(false);
  });
  test('after real data, empty means everything was deleted', () => {
    expect(shouldReplace(0, true)).toBe(true);
  });
});
