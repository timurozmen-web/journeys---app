import { describe, expect, test } from 'vitest';
import { SW_NAVIGATION_DENYLIST } from './swDenylist';

const denied = (path: string) => SW_NAVIGATION_DENYLIST.some((re) => re.test(path));

describe('service worker navigation denylist', () => {
  test('the bank return address and the functions are never served the app shell', () => {
    expect(denied('/bank-link-callback')).toBe(true);
    expect(denied('/.netlify/functions/bank-link-start')).toBe(true);
  });
  test('the app itself still is', () => {
    expect(denied('/')).toBe(false);
    expect(denied('/index.html')).toBe(false);
  });
});
