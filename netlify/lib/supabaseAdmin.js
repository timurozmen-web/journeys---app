import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Supabase client for server-side jobs, using the service-role key.
// Bug this guards against: supabase-js wants a built-in WebSocket when it
// is created, and Node 20 (what Netlify ran these functions on) has none,
// so every call died with "Node.js detected but native WebSocket not
// found" before doing anything. The functions never use realtime, but the
// client still checks for it, so hand it `ws` explicitly rather than
// depending on the Node version Netlify happens to pick.
export function serviceClient(url, key) {
  return createClient(url, key, { auth: { persistSession: false }, realtime: { transport: ws } });
}
