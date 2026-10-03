// Open banking orchestration shared by the bank-* functions: who is
// calling, how a connection is synced, and the Supabase-backed store the
// sync writes through. The sync itself only talks to the `store`
// interface, so it is tested against an in-memory fake (we can't call a
// real bank from a test).
import { serviceClient } from './supabaseAdmin.js';
import { FUNDING_RULES, fundingSpendRow } from './fundingRules.js';
import { ConfigError, exchangeCode, fetchTransactions, listItems, refreshAccessToken, toSpendRow } from './truelayer.js';

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

// The one address TrueLayer sends the user back to; must be registered in
// the TrueLayer console. Built from the request's own host so start and
// exchange always agree.
export function callbackUri(event) {
  const host = header(event, 'x-forwarded-host') || header(event, 'host');
  if (!host) throw new HttpError(400, 'Could not work out this site\'s address.');
  const proto = header(event, 'x-forwarded-proto') || 'https';
  return `${proto}://${host}/bank-link-callback`;
}

export async function handle(fn) {
  try {
    return await fn();
  } catch (err) {
    const status = err instanceof HttpError ? err.status : err instanceof ConfigError ? 503 : 500;
    return json(status, { error: err?.message || 'Something went wrong.' });
  }
}

export function addDaysISO(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
const todayISO = () => new Date().toISOString().slice(0, 10);

const OVERLAP_DAYS = 7;       // re-read a week each sync, so late-settling purchases are caught
const MAX_HISTORY_DAYS = 730; // the most a first sync asks for
const FALLBACK_DAYS = 90;     // what a bank will always share without a fresh login

// Finishes a bank link once the user has approved it: swaps the one-time
// code for tokens (kept server-side only), records the connection and the
// accounts/cards the bank shared. No transactions are read here; that
// waits until the user says which rewards card each account pays for.
export async function completeLink({ store, cfg, userId, code, redirectUri, fetchImpl = fetch }) {
  if (!code) throw new HttpError(400, 'The bank did not send back an authorisation code. Try connecting again.');
  const token = await exchangeCode(cfg, code, redirectUri, fetchImpl);
  if (!token.ok) throw new HttpError(400, `The bank connection was not accepted (${token.status}${token.reason ? ` ${token.reason}` : ''}). Try connecting again.`);

  const { items, error } = await listItems(cfg, token.accessToken, fetchImpl);
  if (error) throw new HttpError(items.length === 0 && error.startsWith('No accounts') ? 400 : 502, error);

  const connectionId = await store.createConnection(userId, items[0].providerName);
  try {
    await store.saveTokens(connectionId, { accessToken: token.accessToken, refreshToken: token.refreshToken, expiresAt: token.expiresAt });
    await store.upsertAccounts(connectionId, userId, items);
    await store.markConnection(connectionId, { status: 'ok', error: null, providerName: items[0].providerName });
  } catch (err) {
    // Don't leave a half-made connection behind (it would show as connected
    // with no login saved).
    await store.deleteConnection(connectionId).catch(() => {});
    throw err;
  }
  return { connectionId, providerName: items[0].providerName, accounts: items.length };
}

// Syncs one bank connection: refreshes its login if needed, refreshes the
// list of accounts/cards, then pulls purchases for the ones mapped to a
// rewards card. Accounts you haven't mapped are listed but their
// transactions are never fetched.
export async function syncConnection({ store, cfg, connection, today = todayISO(), fetchImpl = fetch }) {
  const tokens = await store.getTokens(connection.id);
  if (!tokens) {
    const message = 'No saved login for this bank. Reconnect it.';
    await store.markConnection(connection.id, { status: 'error', error: message });
    return { ok: false, needsReconnect: true, error: message };
  }

  let accessToken = tokens.access_token;
  if (!tokens.expires_at || Date.parse(tokens.expires_at) - Date.now() < 60_000) {
    const r = await refreshAccessToken(cfg, tokens.refresh_token, fetchImpl);
    if (!r.ok) {
      const message = 'Your bank login has expired. Reconnect to keep tracking spend.';
      await store.markConnection(connection.id, { status: 'error', error: message });
      return { ok: false, needsReconnect: true, error: message };
    }
    accessToken = r.accessToken;
    await store.saveTokens(connection.id, { accessToken: r.accessToken, refreshToken: r.refreshToken ?? tokens.refresh_token, expiresAt: r.expiresAt });
  }

  const { items, error } = await listItems(cfg, accessToken, fetchImpl);
  if (error) {
    await store.markConnection(connection.id, { status: 'error', error });
    return { ok: false, error };
  }
  if (items.length === 0) {
    const message = 'No accounts or cards were shared.';
    await store.markConnection(connection.id, { status: 'error', error: message });
    return { ok: false, error: message };
  }

  const accounts = await store.upsertAccounts(connection.id, connection.user_id, items);
  const itemById = new Map(items.map((i) => [i.providerAccountId, i]));

  let tracked = 0;
  let rows = 0;
  const problems = [];
  for (const acc of accounts) {
    if (!acc.payment_card_id) continue;
    const item = itemById.get(acc.provider_account_id);
    if (!item) continue;
    tracked += 1;

    let fetched;
    let from;
    if (acc.synced_through) {
      from = addDaysISO(acc.synced_through, -OVERLAP_DAYS);
      fetched = await fetchTransactions(cfg, accessToken, item, from, today, fetchImpl);
    } else {
      // First sync of this account: go back as far as the card was
      // opened (card-year and welcome-bonus goals need it), up to two
      // years. Banks only share long history right after you log in, so
      // if that's refused, settle for the last 90 days.
      const opened = await store.cardOpenDate(connection.user_id, acc.payment_card_id);
      const earliest = addDaysISO(today, -MAX_HISTORY_DAYS);
      from = opened ? (opened > earliest ? opened : earliest) : addDaysISO(today, -365);
      fetched = await fetchTransactions(cfg, accessToken, item, from, today, fetchImpl);
      if (!fetched.ok) {
        from = addDaysISO(today, -FALLBACK_DAYS);
        fetched = await fetchTransactions(cfg, accessToken, item, from, today, fetchImpl);
      }
    }
    if (!fetched.ok) {
      problems.push(`${item.displayName}: the bank refused the request (HTTP ${fetched.status}).`);
      continue;
    }

    // One row per transaction id: Postgres rejects an upsert that touches
    // the same row twice.
    const byId = new Map();
    for (const t of fetched.transactions) {
      // A card paid for from a current account: only that card's own lines
      // on the account count (see fundingRules.js).
      const rule = item.kind === 'account' ? FUNDING_RULES[acc.payment_card_id] : undefined;
      const row = rule ? fundingSpendRow(rule, t) : toSpendRow(item.kind, t);
      if (row) byId.set(row.external_id, row);
    }
    const spendRows = [...byId.values()];
    if (spendRows.length > 0) await store.upsertSpend(acc.id, connection.user_id, spendRows);
    await store.setSyncedThrough(acc.id, today);
    rows += spendRows.length;
  }

  await store.markConnection(connection.id, {
    status: problems.length > 0 ? 'partial' : 'ok',
    error: problems.length > 0 ? problems.join(' ') : null,
    providerName: items[0].providerName,
    synced: true,
  });
  return { ok: true, accounts: accounts.length, tracked, rows, problems };
}

// The real store, over Supabase with the service-role key. Tokens live in
// a table the app's own (anon) key cannot read.
export function supabaseStore(admin) {
  const check = ({ error }) => { if (error) throw new Error(error.message); };
  return {
    async createConnection(userId, providerName) {
      const { data, error } = await admin.from('open_banking_connections').insert({ user_id: userId, provider_name: providerName }).select('id').single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    async deleteConnection(connectionId) {
      check(await admin.from('open_banking_connections').delete().eq('id', connectionId));
    },
    async getTokens(connectionId) {
      const { data, error } = await admin.from('open_banking_tokens').select('access_token, refresh_token, expires_at').eq('connection_id', connectionId).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async saveTokens(connectionId, t) {
      check(await admin.from('open_banking_tokens').upsert({ connection_id: connectionId, access_token: t.accessToken, refresh_token: t.refreshToken, expires_at: t.expiresAt }));
    },
    async upsertAccounts(connectionId, userId, items) {
      check(await admin.from('open_banking_accounts').upsert(
        items.map((i) => ({ user_id: userId, connection_id: connectionId, provider_account_id: i.providerAccountId, kind: i.kind, display_name: i.displayName, last4: i.last4, currency: i.currency })),
        { onConflict: 'connection_id,provider_account_id' },
      ));
      const { data, error } = await admin.from('open_banking_accounts').select('id, provider_account_id, kind, display_name, last4, currency, payment_card_id, synced_through').eq('connection_id', connectionId);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async cardOpenDate(userId, cardId) {
      const { data } = await admin.from('payment_cards').select('open_date').eq('id', cardId).eq('user_id', userId).maybeSingle();
      return data?.open_date ?? null;
    },
    async upsertSpend(accountId, userId, rows) {
      for (let i = 0; i < rows.length; i += 500) {
        check(await admin.from('card_spend').upsert(
          rows.slice(i, i + 500).map((r) => ({ ...r, user_id: userId, account_id: accountId })),
          { onConflict: 'account_id,external_id' },
        ));
      }
    },
    async setSyncedThrough(accountId, date) {
      check(await admin.from('open_banking_accounts').update({ synced_through: date }).eq('id', accountId));
    },
    async markConnection(connectionId, m) {
      const patch = { last_sync_status: m.status, last_sync_error: m.error ?? null };
      if (m.providerName) patch.provider_name = m.providerName;
      if (m.synced) patch.last_synced_at = new Date().toISOString();
      check(await admin.from('open_banking_connections').update(patch).eq('id', connectionId));
    },
  };
}
