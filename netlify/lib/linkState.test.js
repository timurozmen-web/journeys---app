import { describe, expect, test } from 'vitest';
import { signState, verifyState } from './linkState.js';

describe('link state', () => {
  const secret = 'client-secret';
  const t0 = 1_800_000_000_000;

  test('gives back the user who started the link', () => {
    expect(verifyState(signState('user-1', secret, t0), secret, t0 + 60_000)).toBe('user-1');
  });

  test('a tampered or re-signed state is refused', () => {
    const [payload] = signState('user-1', secret, t0).split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'someone-else', t: t0, n: 'x' })).toString('base64url');
    expect(() => verifyState(`${forged}.${signState('x', secret, t0).split('.')[1]}`, secret, t0)).toThrow(/not valid/);
    expect(() => verifyState(`${payload}.bad`, secret, t0)).toThrow(/not valid/);
    expect(() => verifyState(signState('user-1', 'other-secret', t0), secret, t0)).toThrow(/not valid/);
  });

  test('missing or garbage state is refused', () => {
    for (const s of [undefined, '', 'abc', 'a.b.c']) expect(() => verifyState(s, secret, t0)).toThrow(/not valid/);
  });

  test('expires after 15 minutes', () => {
    const s = signState('user-1', secret, t0);
    expect(verifyState(s, secret, t0 + 14 * 60_000)).toBe('user-1');
    expect(() => verifyState(s, secret, t0 + 16 * 60_000)).toThrow(/expired/);
  });
});
