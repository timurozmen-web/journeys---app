import { describe, expect, test } from 'vitest';
import { buildAuthUrl, ConfigError, listItems, SCOPE, toSpendRow, truelayerConfig } from './truelayer.js';

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
const routed = (routes) => async (url) => {
  const key = Object.keys(routes).find((k) => String(url).includes(k));
  return key ? routes[key] : res(404, { error: 'not_found' });
};

describe('truelayerConfig', () => {
  test('needs the app credentials from the environment', () => {
    expect(() => truelayerConfig({})).toThrow(ConfigError);
    expect(() => truelayerConfig({ TRUELAYER_CLIENT_ID: 'x' })).toThrow(ConfigError);
  });

  test('defaults to live; sandbox only when asked', () => {
    const env = { TRUELAYER_CLIENT_ID: 'id', TRUELAYER_CLIENT_SECRET: 's' };
    expect(truelayerConfig(env).api).toBe('https://api.truelayer.com');
    expect(truelayerConfig({ ...env, TRUELAYER_ENV: 'sandbox' }).api).toBe('https://api.truelayer-sandbox.com');
  });
});

describe('truelayerConfig trimming', () => {
  test('stray whitespace around a pasted key is ignored', () => {
    const cfg = truelayerConfig({ TRUELAYER_CLIENT_ID: ' id\n', TRUELAYER_CLIENT_SECRET: '\tsecret ' });
    expect([cfg.clientId, cfg.clientSecret]).toEqual(['id', 'secret']);
  });
});

describe('buildAuthUrl', () => {
  const cfg = truelayerConfig({ TRUELAYER_CLIENT_ID: 'id', TRUELAYER_CLIENT_SECRET: 's' });

  test('carries a nonce, the state and only the scopes spend tracking needs', () => {
    const u = new URL(buildAuthUrl(cfg, { redirectUri: 'https://x.test/cb', state: 'st', nonce: 'no' }));
    expect(u.origin).toBe('https://auth.truelayer.com');
    expect(u.searchParams.get('nonce')).toBe('no'); // TrueLayer rejects an auth URL without one
    expect(u.searchParams.get('state')).toBe('st');
    expect(u.searchParams.get('redirect_uri')).toBe('https://x.test/cb');
    expect(SCOPE.split(' ')).toEqual(expect.arrayContaining(['accounts', 'cards', 'transactions', 'offline_access']));
    expect(SCOPE).not.toMatch(/balance|info/);
    expect(u.searchParams.get('enable_mock')).toBeNull();
  });

  test('the sandbox uses the mock bank', () => {
    const sb = truelayerConfig({ TRUELAYER_CLIENT_ID: 'id', TRUELAYER_CLIENT_SECRET: 's', TRUELAYER_ENV: 'sandbox' });
    const u = new URL(buildAuthUrl(sb, { redirectUri: 'https://x.test/cb', state: 's', nonce: 'n' }));
    expect(u.origin).toBe('https://auth.truelayer-sandbox.com');
    expect(u.searchParams.get('enable_mock')).toBe('true');
  });
});

describe('toSpendRow: only real purchases count', () => {
  const card = (o) => ({ transaction_id: 't1', timestamp: '2026-02-03T14:20:00+00:00', amount: 42.5, currency: 'GBP', transaction_category: 'DEBIT', description: 'MARRIOTT LONDON', ...o });
  const acct = (o) => ({ transaction_id: 't2', timestamp: '2026-02-03T09:00:00Z', amount: -42.5, currency: 'GBP', transaction_category: 'PURCHASE', description: 'TESCO', ...o });

  test('a card purchase (DEBIT, signed positive) is spend', () => {
    expect(toSpendRow('card', card())).toEqual({ external_id: 't1', txn_date: '2026-02-03', amount: 42.5, currency: 'GBP', merchant: 'MARRIOTT LONDON' });
  });

  test('a current-account card payment (PURCHASE, signed negative) is spend, as a positive figure', () => {
    expect(toSpendRow('account', acct())).toMatchObject({ amount: 42.5, merchant: 'TESCO' });
  });

  test('repayments, refunds, transfers, direct debits, cash and zero-value rows are not', () => {
    expect(toSpendRow('card', card({ transaction_category: 'CREDIT', amount: -300 }))).toBeNull();
    expect(toSpendRow('account', acct({ transaction_category: 'CREDIT', amount: 100 }))).toBeNull();
    expect(toSpendRow('account', acct({ transaction_category: 'TRANSFER' }))).toBeNull();
    expect(toSpendRow('account', acct({ transaction_category: 'DEBIT' }))).toBeNull(); // direct debit / standing order
    expect(toSpendRow('account', acct({ transaction_category: 'ATM' }))).toBeNull();
    expect(toSpendRow('card', card({ amount: 0 }))).toBeNull();
  });

  test('a row with no id or date is skipped; the merchant name wins over the description', () => {
    expect(toSpendRow('card', card({ transaction_id: undefined }))).toBeNull();
    expect(toSpendRow('card', card({ timestamp: undefined }))).toBeNull();
    expect(toSpendRow('card', card({ merchant_name: 'Marriott', description: 'MARRIOTT 0001 GB' })).merchant).toBe('Marriott');
  });
});

describe('listItems', () => {
  const cfg = truelayerConfig({ TRUELAYER_CLIENT_ID: 'id', TRUELAYER_CLIENT_SECRET: 's' });
  const accountsBody = { results: [{ account_id: 'a1', display_name: 'Current', provider: { display_name: 'Monzo' }, account_number: { number: '12345678' }, currency: 'GBP' }] };
  const cardsBody = { results: [{ account_id: 'c1', card_network: 'AMEX', partial_card_number: '1234', provider: { display_name: 'American Express' } }] };

  test('merges current accounts and cards from the same bank login', async () => {
    const f = routed({ '/data/v1/accounts': res(200, accountsBody), '/data/v1/cards': res(200, cardsBody) });
    const { items, error } = await listItems(cfg, 'tok', f);
    expect(error).toBeNull();
    expect(items.map((i) => [i.kind, i.providerAccountId, i.last4])).toEqual([['account', 'a1', '5678'], ['card', 'c1', '1234']]);
  });

  test('a card-only provider (Amex) answers endpoint_not_supported for accounts, and that is fine', async () => {
    const f = routed({ '/data/v1/accounts': res(501, { error: 'endpoint_not_supported' }), '/data/v1/cards': res(200, cardsBody) });
    const { items, error } = await listItems(cfg, 'tok', f);
    expect(error).toBeNull();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'card', providerName: 'American Express' });
  });

  test('a card-only login may answer "forbidden" for accounts instead; still just no accounts', async () => {
    const f = routed({ '/data/v1/accounts': res(403, { error: 'access_denied' }), '/data/v1/cards': res(200, cardsBody) });
    const { items, error } = await listItems(cfg, 'tok', f);
    expect(error).toBeNull();
    expect(items.map((i) => i.kind)).toEqual(['card']);
  });

  test('when nothing at all comes back, the error says what each endpoint answered', async () => {
    const f = routed({ '/data/v1/accounts': res(403, { error: 'access_denied' }), '/data/v1/cards': res(200, { results: [] }) });
    const { items, error } = await listItems(cfg, 'tok', f);
    expect(items).toEqual([]);
    expect(error).toBe('No accounts or cards were shared (accounts: HTTP 403 access_denied; cards: 0 found).');
  });

  test('a real failure is reported, not mistaken for "no cards"', async () => {
    const f = routed({ '/data/v1/accounts': res(500, { error: 'internal' }), '/data/v1/cards': res(200, cardsBody) });
    const { items, error } = await listItems(cfg, 'tok', f);
    expect(items).toEqual([]);
    expect(error).toMatch(/accounts.*HTTP 500/);
  });
});
