// Posts to one of the app's Netlify functions as the signed-in user. The
// ones that call Claude or the bank check the token, so nobody else can
// run them on this account's keys.
import { supabase } from './supabase';

export async function postFunction(name: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}
