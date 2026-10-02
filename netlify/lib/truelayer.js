// TrueLayer Data API client for pulling card spend. Ported from the Budget
// Tracker app's working integration (its Supabase edge function), which was
// checked against TrueLayer's own SDKs and confirmed on live data. What's
// carried over, and why:
//   - Auth dialog + token exchange/refresh: nonce is mandatory in the auth
//     URL; /connect/token is form-encoded; sandbox hosts differ from live.
//   - Credit cards (Amex etc.) are NOT under /data/v1/accounts -- that
//     endpoint answers "endpoint_not_supported" for them, and they only
//     appear under /data/v1/cards. So both are listed and merged.
//   - Signs differ: card purchases come back positive, current-account
//     spend negative.
// Where this differs from the Budget Tracker, on purpose:
//   - Only the scopes spend tracking needs (no balances, no identity info).
//   - Client id/secret come from Netlify environment variables, never a table.
//   - Only genuine purchases are kept (see toSpendRow); repayments,
//     transfers, cash and fees never count toward spend goals.
// All server-side: nothing here is bundled into the app.

export const HOSTS = {
  sandbox: { auth: 'https://auth.truelayer-sandbox.com', api: 'https://api.truelayer-sandbox.com' },
  live: { auth: 'https://auth.truelayer.com', api: 'https://api.truelayer.com' },
};

// Least privilege: accounts + cards to find what to track, transactions
// for the spend, offline_access so the daily sync can refresh its token.
export const SCOPE = 'accounts cards transactions offline_access';

export class ConfigError extends Error {}

export function truelayerConfig(env = process.env) {
  // Trimmed: a space or newline pasted along with a key in the Netlify
  // dashboard is invisible there and makes the bank reject the key.
  const clientId = env.TRUELAYER_CLIENT_ID?.trim();
  const clientSecret = env.TRUELAYER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new ConfigError('Bank connection is not set up yet: TRUELAYER_CLIENT_ID and TRUELAYER_CLIENT_SECRET are missing.');
  }
  const environment = env.TRUELAYER_ENV === 'sandbox' ? 'sandbox' : 'live';
  return { clientId, clientSecret, environment, ...HOSTS[environment] };
}

export function buildAuthUrl(cfg, { redirectUri, state, nonce }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    nonce,
    state,
  });
  if (cfg.environment === 'sandbox') {
    params.set('enable_mock', 'true');
    params.set('provider_id', 'mock');
  }
  return `${cfg.auth}/?${params.toString()}`;
}

async function requestToken(cfg, params, fetchImpl) {
  const res = await fetchImpl(`${cfg.auth}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // TrueLayer explains itself as {"error":"invalid_client",...}; keep that
    // code so the failure can be diagnosed (never any token or secret).
    let reason = '';
    try { const j = JSON.parse(body); reason = [j.error, j.error_description].filter(Boolean).join(': ').slice(0, 160); } catch { /* not JSON */ }
    return { ok: false, status: res.status, reason, body: body.slice(0, 300) };
  }
  const data = await res.json();
  return {
    ok: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export function exchangeCode(cfg, code, redirectUri, fetchImpl = fetch) {
  return requestToken(cfg, {
    grant_type: 'authorization_code', client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri, code,
  }, fetchImpl);
}

export function refreshAccessToken(cfg, refreshToken, fetchImpl = fetch) {
  return requestToken(cfg, {
    grant_type: 'refresh_token', client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: refreshToken,
  }, fetchImpl);
}

// GET against the Data API that keeps TrueLayer's own error code (e.g.
// "endpoint_not_supported") so "this bank has no such resource" can be
// told apart from a real failure.
export async function getData(url, accessToken, fetchImpl = fetch) {
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const text = await res.text().catch(() => '');
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  if (!res.ok) return { ok: false, status: res.status, errorCode: parsed?.error, body: text.slice(0, 300) };
  return { ok: true, data: parsed };
}

// A login that only covers cards (an Amex, say) has no current accounts to
// list, and the bank may say so as "not supported" or as "forbidden"
// depending on the provider. Either means "none here", not a failure.
const UNAVAILABLE_CODES = new Set(['endpoint_not_supported', 'access_denied', 'insufficient_permissions', 'scope_not_granted', 'invalid_scope']);
const isUnavailable = (r) => UNAVAILABLE_CODES.has(r.errorCode) || [403, 404, 501].includes(r.status);
const describe = (r) => (r.ok ? `${r.data?.results?.length ?? 0} found` : `HTTP ${r.status}${r.errorCode ? ` ${r.errorCode}` : ''}`);

// Every current account and card the user shared, in one shape.
export async function listItems(cfg, accessToken, fetchImpl = fetch) {
  const [accounts, cards] = await Promise.all([
    getData(`${cfg.api}/data/v1/accounts`, accessToken, fetchImpl),
    getData(`${cfg.api}/data/v1/cards`, accessToken, fetchImpl),
  ]);
  for (const [name, r] of [['accounts', accounts], ['cards', cards]]) {
    if (!r.ok && !isUnavailable(r)) {
      return { items: [], error: `Could not read your ${name} (${describe(r)}).` };
    }
  }
  const items = [];
  if (accounts.ok) {
    for (const a of accounts.data?.results ?? []) {
      const num = a.account_number?.number;
      items.push({
        kind: 'account',
        providerAccountId: a.account_id,
        displayName: a.display_name || a.provider?.display_name || 'Bank account',
        providerName: a.provider?.display_name || 'Bank',
        last4: typeof num === 'string' && num.length >= 4 ? num.slice(-4) : null,
        currency: a.currency || 'GBP',
      });
    }
  }
  if (cards.ok) {
    for (const c of cards.data?.results ?? []) {
      items.push({
        kind: 'card',
        providerAccountId: c.account_id,
        displayName: (c.display_name || c.card_network || 'Card').trim(),
        providerName: c.provider?.display_name || 'Card',
        last4: c.partial_card_number ?? null,
        currency: c.currency || 'GBP',
      });
    }
  }
  if (items.length === 0) {
    return { items, error: `No accounts or cards were shared (accounts: ${describe(accounts)}; cards: ${describe(cards)}).` };
  }
  return { items, error: null };
}

export async function fetchTransactions(cfg, accessToken, item, from, to, fetchImpl = fetch) {
  const path = item.kind === 'card' ? 'cards' : 'accounts';
  const qs = new URLSearchParams({ from, to });
  const res = await getData(`${cfg.api}/data/v1/${path}/${item.providerAccountId}/transactions?${qs}`, accessToken, fetchImpl);
  if (!res.ok) return { ok: false, status: res.status, errorCode: res.errorCode, transactions: [] };
  return { ok: true, transactions: res.data?.results ?? [] };
}

// Which transactions are real spend, and as a positive pound figure.
// Checked against the Budget Tracker's live data: a card's purchases are
// category DEBIT (repayments and refunds are CREDIT); a current account's
// card payments are PURCHASE (transfers are TRANSFER, incoming money is
// CREDIT, and DEBIT there is mostly direct debits/standing orders, which
// don't earn points). Cash, fees and interest aren't purchases either.
// Refunds are not netted off -- a CREDIT can't be told from a card
// repayment -- so spend can read slightly high after a refund.
export function toSpendRow(kind, txn) {
  const category = txn.transaction_category;
  const isPurchase = kind === 'card' ? category === 'DEBIT' : category === 'PURCHASE';
  if (!isPurchase) return null;
  const raw = Number(txn.amount);
  if (!Number.isFinite(raw) || raw === 0) return null;
  const amount = kind === 'card' ? raw : -raw; // cards sign purchases +, accounts sign spend -
  if (amount <= 0) return null;
  const externalId = txn.transaction_id || txn.normalised_provider_transaction_id;
  if (!externalId || !txn.timestamp) return null;
  return {
    external_id: String(externalId),
    txn_date: String(txn.timestamp).slice(0, 10),
    amount: Math.round(amount * 100) / 100,
    currency: txn.currency || 'GBP',
    merchant: String(txn.merchant_name || txn.description || '').slice(0, 120) || null,
  };
}
