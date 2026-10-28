// What every signed-in function needs: who is calling, reading the body,
// and turning a thrown HttpError into its status and message.
import { serviceClient } from './supabaseAdmin.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function readJson(event) {
  try { return JSON.parse(event.body || '{}'); } catch { throw new HttpError(400, 'Invalid request body'); }
}

export function header(event, name) {
  const h = event.headers || {};
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? h[key] : undefined;
}

export function adminClient(env = process.env) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, 'Server is missing its Supabase credentials.');
  return serviceClient(url, key);
}

// The signed-in user, from the Supabase access token the app sends. The
// user id always comes from here, never from the request body or from an
// OAuth `state` -- so nobody can attach a bank to someone else's account.
export async function requireUser(admin, event) {
  const token = (header(event, 'authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Sign in required.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Your session is not valid. Sign in again.');
  return data.user;
}

export async function handle(fn) {
  try {
    return await fn();
  } catch (err) {
    return json(err instanceof HttpError ? err.status : 500, { error: err?.message || 'Something went wrong.' });
  }
}
