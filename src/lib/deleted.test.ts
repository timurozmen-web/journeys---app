import { describe, expect, it } from 'vitest';
import { markDeleted, wasDeleted } from './deleted';

describe('deleted', () => {
  it('remembers what was deleted, by kind', () => {
    markDeleted('trip', 't1');
    expect(wasDeleted('trip', 't1')).toBe(true);
    expect(wasDeleted('programme', 't1')).toBe(false);
    expect(wasDeleted('trip', 't2')).toBe(false);
  });
});
