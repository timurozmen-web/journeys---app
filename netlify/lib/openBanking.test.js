import { describe, expect, test } from 'vitest';
import { addDaysISO, callbackUri, completeLink, HttpError, requireUser, syncConnection } from './openBanking.js';
import { truelayerConfig } from './truelayer.js';

const cfg = truelayerConfig({ TRUELAYER_CLIENT_ID: 'id', TRUELAYER_CLIENT_SECRET: 's' });
const TODAY = '2026-10-02';

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body });

// A fake TrueLayer: answers by URL, and records every call.
function fakeBank({ cards = [], accounts = [], txns = {}, failTxns = {}, tokenOk = true } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.endsWith('/connect/token')) return tokenOk ? res(200, { access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 }) : res(400, { error: 'invalid_grant' });
    if (u.includes('/data/v1/accounts?') || u.endsWith('/data/v1/accounts')) return accounts.length ? res(200, { results: accounts }) : res(501, { error: 'endpoint_not_supported' });
    if (u.endsWith('/data/v1/cards')) return cards.length ? res(200, { results: cards }) : res(501, { error: 'endpoint_not_supported' });
    const m = u.match(/\/data\/v1\/(?:cards|accounts)\/([^/]+)\/transactions\?(.*)$/);
    if (m) {
      const [, id, qs] = m;
      const from = new URLSearchParams(qs).get('from');
      const fail = failTxns[id];
      if (fail && (fail.always || from < fail.before)) return res(fail.status ?? 403, { error: 'sca_exceeded' });
      return res(200, { results: txns[id] ?? [] });
    }
    return res(404, {});
  };
  return { fetchImpl, calls, txnCalls: () => calls.filter((c) => /transactions\?/.test(c.url)) };
}

// An in-memory stand-in for the Supabase-backed store.
function fakeStore({ tokens, accounts = [], openDates = {} } = {}) {
  const state = {
    tokens: tokens ?? { access_token: 'at', refresh_token: 'rt', expires_at: new Date(Date.now() + 3_600_000).toISOString() },
    accounts: accounts.map((a, i) => ({ id: `acc${i}`, kind: 'card', payment_card_id: null, synced_through: null, ...a })),
    spend: [], marks: [], savedTokens: [],
  };
  return {
    state,
    getTokens: async () => state.tokens,
    saveTokens: async (_c, t) => { state.savedTokens.push(t); },
    upsertAccounts: async (_c, _u, items) => {
      for (const it of items) {
        if (!state.accounts.find((a) => a.provider_account_id === it.providerAccountId)) {
          state.accounts.push({ id: `acc${state.accounts.length}`, provider_account_id: it.providerAccountId, kind: it.kind, payment_card_id: null, synced_through: null });
        }
      }
      return state.accounts;
    },
    cardOpenDate: async (_u, cardId) => openDates[cardId] ?? null,
    upsertSpend: async (accountId, _u, rows) => { state.spend.push(...rows.map((r) => ({ ...r, accountId }))); },
    setSyncedThrough: async (id, d) => { state.accounts.find((a) => a.id === id).synced_through = d; },
    markConnection: async (_id, m) => { state.marks.push(m); },
    createConnection: async (userId, providerName) => { state.created = { userId, providerName }; return 'conn-new'; },
    deleteConnection: async (id) => { state.deleted = id; },
  };
}

const connection = { id: 'conn1', user_id: 'user1' };
const amexCard = { account_id: 'amex1', card_network: 'AMEX', partial_card_number: '1234', provider: { display_name: 'American Express' } };
const purchase = (id, date, amount) => ({ transaction_id: id, timestamp: `${date}T10:00:00Z`, amount, currency: 'GBP', transaction_category: 'DEBIT', description: 'SHOP' });
const repayment = { transaction_id: 'pay1', timestamp: '2026-09-01T10:00:00Z', amount: -500, currency: 'GBP', transaction_category: 'CREDIT', description: 'PAYMENT RECEIVED' };

describe('syncConnection', () => {
  test('accounts not mapped to a card are listed but their transactions are never fetched', async () => {
    const bank = fakeBank({ cards: [amexCard] });
    const store = fakeStore();
    const r = await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(r).toMatchObject({ ok: true, accounts: 1, tracked: 0, rows: 0 });
    expect(bank.txnCalls()).toHaveLength(0);
    expect(store.state.accounts).toHaveLength(1);
  });

  test('a mapped card: first sync reaches back to when the card was opened and keeps only purchases', async () => {
    const bank = fakeBank({ cards: [amexCard], txns: { amex1: [purchase('p1', '2026-09-10', 120.5), repayment, purchase('p2', '2026-09-11', 30)] } });
    const store = fakeStore({ accounts: [{ provider_account_id: 'amex1', payment_card_id: 'Marriott Amex' }], openDates: { 'Marriott Amex': '2026-03-15' } });
    const r = await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(r).toMatchObject({ ok: true, tracked: 1, rows: 2 });
    expect(store.state.spend.map((s) => s.external_id).sort()).toEqual(['p1', 'p2']); // the repayment is not spend
    expect(new URLSearchParams(bank.txnCalls()[0].url.split('?')[1]).get('from')).toBe('2026-03-15');
    expect(store.state.accounts[0].synced_through).toBe(TODAY);
    expect(store.state.marks.at(-1)).toMatchObject({ status: 'ok', synced: true, providerName: 'American Express' });
  });

  test('a first sync never asks for more than two years', async () => {
    const bank = fakeBank({ cards: [amexCard] });
    const store = fakeStore({ accounts: [{ provider_account_id: 'amex1', payment_card_id: 'Marriott Amex' }], openDates: { 'Marriott Amex': '2019-01-01' } });
    await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(new URLSearchParams(bank.txnCalls()[0].url.split('?')[1]).get('from')).toBe(addDaysISO(TODAY, -730));
  });

  test('if the bank refuses the long history, it settles for the last 90 days', async () => {
    const bank = fakeBank({ cards: [amexCard], txns: { amex1: [purchase('p1', '2026-09-10', 10)] }, failTxns: { amex1: { before: addDaysISO(TODAY, -90) } } });
    const store = fakeStore({ accounts: [{ provider_account_id: 'amex1', payment_card_id: 'Marriott Amex' }], openDates: { 'Marriott Amex': '2026-01-01' } });
    const r = await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(r).toMatchObject({ ok: true, rows: 1 });
    expect(bank.txnCalls()).toHaveLength(2);
    expect(new URLSearchParams(bank.txnCalls()[1].url.split('?')[1]).get('from')).toBe(addDaysISO(TODAY, -90));
  });

  test('later syncs only re-read the last week, so late-settling purchases are still caught', async () => {
    const bank = fakeBank({ cards: [amexCard] });
    const store = fakeStore({ accounts: [{ provider_account_id: 'amex1', payment_card_id: 'Marriott Amex', synced_through: '2026-09-29' }] });
    await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(new URLSearchParams(bank.txnCalls()[0].url.split('?')[1]).get('from')).toBe('2026-09-22');
  });

  test('the same transaction twice in one response is stored once', async () => {
    const bank = fakeBank({ cards: [amexCard], txns: { amex1: [purchase('dup', '2026-09-10', 10), purchase('dup', '2026-09-10', 10)] } });
    const store = fakeStore({ accounts: [{ provider_account_id: 'amex1', payment_card_id: 'Marriott Amex' }] });
    const r = await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(r.rows).toBe(1);
  });

  test('an expired login is refreshed and the new tokens saved', async () => {
    const bank = fakeBank({ cards: [amexCard] });
    const store = fakeStore({ tokens: { access_token: 'old', refresh_token: 'rt-old', expires_at: new Date(Date.now() - 1000).toISOString() } });
    const r = await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(r.ok).toBe(true);
    expect(store.state.savedTokens[0]).toMatchObject({ accessToken: 'new-at', refreshToken: 'new-rt' });
    expect(bank.calls.some((c) => c.init?.headers?.Authorization === 'Bearer new-at')).toBe(true);
  });

  test('a login that cannot be refreshed asks the user to reconnect', async () => {
    const bank = fakeBank({ cards: [amexCard], tokenOk: false });
    const store = fakeStore({ tokens: { access_token: 'old', refresh_token: 'rt', expires_at: new Date(Date.now() - 1000).toISOString() } });
    const r = await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(r).toMatchObject({ ok: false, needsReconnect: true });
    expect(store.state.marks.at(-1)).toMatchObject({ status: 'error' });
  });

  test('one account failing does not lose the others; the connection is marked partial', async () => {
    const second = { account_id: 'amex2', card_network: 'VISA', partial_card_number: '9999', provider: { display_name: 'American Express' } };
    const bank = fakeBank({ cards: [amexCard, second], txns: { amex1: [purchase('p1', '2026-09-10', 10)] }, failTxns: { amex2: { always: true, status: 500 } } });
    const store = fakeStore({ accounts: [
      { provider_account_id: 'amex1', payment_card_id: 'Marriott Amex' },
      { provider_account_id: 'amex2', payment_card_id: 'Hilton Debit' },
    ] });
    const r = await syncConnection({ store, cfg, connection, today: TODAY, fetchImpl: bank.fetchImpl });
    expect(r).toMatchObject({ ok: true, rows: 1 });
    expect(r.problems).toHaveLength(1);
    expect(store.state.marks.at(-1)).toMatchObject({ status: 'partial' });
  });
});

describe('request helpers', () => {
  test('callbackUri is built from the request host', () => {
    expect(callbackUri({ headers: { host: 'journeys.example.app' } })).toBe('https://journeys.example.app/bank-link-callback');
    expect(callbackUri({ headers: { 'X-Forwarded-Host': 'a.test', 'x-forwarded-proto': 'http' } })).toBe('http://a.test/bank-link-callback');
    expect(() => callbackUri({ headers: {} })).toThrow(HttpError);
  });

  test('requireUser takes the user from the verified token, and refuses a missing or bad one', async () => {
    const admin = { auth: { getUser: async (t) => (t === 'good' ? { data: { user: { id: 'u1' } }, error: null } : { data: null, error: { message: 'bad' } }) } };
    expect(await requireUser(admin, { headers: { Authorization: 'Bearer good' } })).toEqual({ id: 'u1' });
    await expect(requireUser(admin, { headers: {} })).rejects.toMatchObject({ status: 401 });
    await expect(requireUser(admin, { headers: { authorization: 'Bearer nope' } })).rejects.toMatchObject({ status: 401 });
  });
});

describe('completeLink', () => {
  test('swaps the code, saves the login, and lists what the bank shared without reading any transactions', async () => {
    const bank = fakeBank({ cards: [amexCard] });
    const store = fakeStore({ tokens: null });
    const r = await completeLink({ store, cfg, userId: 'user1', code: 'abc', redirectUri: 'https://x.test/bank-link-callback', fetchImpl: bank.fetchImpl });
    expect(r).toMatchObject({ connectionId: 'conn-new', accounts: 1 });
    expect(store.state.created).toEqual({ userId: 'user1', providerName: 'American Express' });
    expect(store.state.savedTokens[0]).toMatchObject({ accessToken: 'new-at', refreshToken: 'new-rt' });
    expect(store.state.accounts).toHaveLength(1);
    expect(bank.txnCalls()).toHaveLength(0);
  });

  test('a code the bank rejects makes no connection', async () => {
    const store = fakeStore();
    await expect(completeLink({ store, cfg, userId: 'u', code: 'bad', redirectUri: 'r', fetchImpl: fakeBank({ tokenOk: false }).fetchImpl })).rejects.toMatchObject({ status: 400 });
    expect(store.state.created).toBeUndefined();
  });

  test('a rejected code reports the reason the bank gave', async () => {
    const f = async () => res(400, { error: 'invalid_client', error_description: 'bad secret' });
    await expect(completeLink({ store: fakeStore(), cfg, userId: 'u', code: 'c', redirectUri: 'r', fetchImpl: f })).rejects.toThrow('(400 invalid_client: bad secret)');
  });

  test('no accounts shared: nothing is created', async () => {
    const store = fakeStore();
    await expect(completeLink({ store, cfg, userId: 'u', code: 'c', redirectUri: 'r', fetchImpl: fakeBank().fetchImpl })).rejects.toMatchObject({ status: 400 });
    expect(store.state.created).toBeUndefined();
  });

  test('a failure after the connection row exists removes it again', async () => {
    const store = fakeStore();
    store.saveTokens = async () => { throw new Error('db down'); };
    await expect(completeLink({ store, cfg, userId: 'u', code: 'c', redirectUri: 'r', fetchImpl: fakeBank({ cards: [amexCard] }).fetchImpl })).rejects.toThrow('db down');
    expect(store.state.deleted).toBe('conn-new');
  });

  test('missing code is refused', async () => {
    await expect(completeLink({ store: fakeStore(), cfg, userId: 'u', code: undefined, redirectUri: 'r' })).rejects.toMatchObject({ status: 400 });
  });
});
