// The app's side of connecting a bank. Every call goes to a Netlify
// function with the signed-in user's Supabase token; the bank login itself
// never reaches the browser.
import { supabase } from './supabase';

const STATE_KEY = 'journeys-bank-link-state';

async function call<T>(fn: string, body: unknown = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const res = await fetch(`/.netlify/functions/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `Request failed (${res.status})`);
  return json as T;
}

// Remembered across the trip to the bank's site, so a callback we didn't
// start (a forged or stale link) can be told apart and ignored.
export function rememberState(state: string) {
  try { localStorage.setItem(STATE_KEY, state); } catch { /* private mode: the check below then refuses, which is the safe side */ }
}
export function takeState(): string | null {
  try {
    const v = localStorage.getItem(STATE_KEY);
    localStorage.removeItem(STATE_KEY);
    return v;
  } catch { return null; }
}

export async function startBankLink(): Promise<string> {
  const { url, state } = await call<{ url: string; state: string }>('bank-link-start');
  rememberState(state);
  return url;
}
export const exchangeBankCode = (code: string) => call<{ connectionId: string }>('bank-link-exchange', { code });
export const syncBank = (connectionId: string) =>
  call<{ ok: boolean; error?: string; tracked?: number; rows?: number; problems?: string[] }>('bank-sync', { connectionId });
export const disconnectBank = (connectionId: string) => call<{ ok: true }>('bank-disconnect', { connectionId });
