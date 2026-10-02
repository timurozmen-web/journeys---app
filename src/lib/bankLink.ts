// The app's side of connecting a bank. Every call goes to a Netlify
// function with the signed-in user's Supabase token; the bank login itself
// never reaches the browser.
import { supabase } from './supabase';

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

// The bank hands the user back to a server function that finishes the link
// itself, so nothing needs remembering here: the app just sends the user
// to the bank, and picks up from `?linked=` when they return.
export async function startBankLink(): Promise<string> {
  const { url } = await call<{ url: string }>('bank-link-start');
  return url;
}
export const syncBank = (connectionId: string) =>
  call<{ ok: boolean; error?: string; tracked?: number; rows?: number; problems?: string[] }>('bank-sync', { connectionId });
export const disconnectBank = (connectionId: string) => call<{ ok: true }>('bank-disconnect', { connectionId });
