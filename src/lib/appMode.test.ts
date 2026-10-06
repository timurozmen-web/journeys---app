import { describe, expect, it } from 'vitest';
import { modeForPath } from './appMode';

describe('modeForPath', () => {
  it('puts trips and the scrapbook in Travel', () => {
    expect(modeForPath('/now', 'loyalty')).toBe('travel');
    expect(modeForPath('/trips/abc', 'loyalty')).toBe('travel');
    expect(modeForPath('/then', 'loyalty')).toBe('travel');
    expect(modeForPath('/action/plan', 'loyalty')).toBe('travel');
  });
  it('puts balances, cards and offers in Loyalty', () => {
    expect(modeForPath('/wallet', 'travel')).toBe('loyalty');
    expect(modeForPath('/action/discover', 'travel')).toBe('loyalty');
    expect(modeForPath('/bank-sync', 'travel')).toBe('loyalty');
  });
  it('keeps the current section for shared screens', () => {
    expect(modeForPath('/settings', 'loyalty')).toBe('loyalty');
    expect(modeForPath('/log-hotel', 'travel')).toBe('travel');
  });
  it('does not match a route by prefix alone', () => {
    expect(modeForPath('/nowhere', 'loyalty')).toBe('loyalty');
  });
});
