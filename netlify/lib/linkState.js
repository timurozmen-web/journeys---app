import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// The `state` value that travels to the bank and back. It is signed and
// short-lived instead of being remembered by the browser.
// Bug this replaces: the first design kept a random state in the app's
// local storage and checked it on return, but the bank sends you back
// through your browser, which does not share storage with the installed
// home-screen app, so the check failed and the link was thrown away.
// Signing means the server alone can tell a genuine return from a forged
// one, and which user started it, whichever browser the bank sends you to.
// Replays are harmless: the bank's one-time code can only be swapped once.
const MAX_AGE_MS = 15 * 60 * 1000;

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

export function signState(userId, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: userId, t: now, n: randomBytes(8).toString('hex') })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

// Returns the user id who started the link, or throws.
export function verifyState(state, secret, now = Date.now()) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) throw new Error('This bank link is not valid. Start again.');
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new Error('This bank link is not valid. Start again.');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new Error('This bank link is not valid. Start again.'); }
  if (!data.u || typeof data.t !== 'number') throw new Error('This bank link is not valid. Start again.');
  if (now - data.t > MAX_AGE_MS || data.t > now + 60_000) throw new Error('This bank link took too long and has expired. Start again.');
  return data.u;
}
