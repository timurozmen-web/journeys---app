import { withLambda } from '@netlify/aws-lambda-compat';
import {
  adminClient, callbackUri, handle, HttpError, json, readJson, requireUser, supabaseStore,
} from '../lib/openBanking.js';
import { exchangeCode, listItems, truelayerConfig } from '../lib/truelayer.js';

// Step 2: the app, signed in, hands over the one-time code from TrueLayer.
// We swap it for tokens (kept server-side only), record the connection,
// and return the accounts and cards found so the user can say which
// rewards card each one is. No transactions are read yet.
export default withLambda((event) => handle(async () => {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'Method not allowed');
  const admin = adminClient();
  const user = await requireUser(admin, event);
  const { code } = readJson(event);
  if (!code || typeof code !== 'string') throw new HttpError(400, 'Missing authorisation code.');

  const cfg = truelayerConfig();
  const token = await exchangeCode(cfg, code, callbackUri(event));
  if (!token.ok) throw new HttpError(400, `The bank connection was not accepted (${token.status}). Try connecting again.`);

  const { items, error } = await listItems(cfg, token.accessToken);
  if (error) throw new HttpError(502, error);
  if (items.length === 0) throw new HttpError(400, 'No accounts or cards were shared. Connect again and tick the ones you want tracked.');

  const { data: conn, error: connError } = await admin.from('open_banking_connections')
    .insert({ user_id: user.id, provider_name: items[0].providerName }).select('id').single();
  if (connError) throw new HttpError(500, connError.message);

  const store = supabaseStore(admin);
  await store.saveTokens(conn.id, { accessToken: token.accessToken, refreshToken: token.refreshToken, expiresAt: token.expiresAt });
  const accounts = await store.upsertAccounts(conn.id, user.id, items);
  await store.markConnection(conn.id, { status: 'ok', error: null, providerName: items[0].providerName });
  return json(200, { connectionId: conn.id, providerName: items[0].providerName, accounts });
}));
