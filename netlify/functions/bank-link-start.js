import { withLambda } from '@netlify/aws-lambda-compat';
import { randomUUID } from 'node:crypto';
import { adminClient, callbackUri, handle, HttpError, json, requireUser } from '../lib/openBanking.js';
import { buildAuthUrl, truelayerConfig } from '../lib/truelayer.js';

// Step 1 of connecting a bank: returns TrueLayer's consent URL. The
// caller must be signed in. `state` is a random value the app keeps and
// checks when the user comes back, so a stray or forged callback is
// ignored (it is never the user id).
export default withLambda((event) => handle(async () => {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'Method not allowed');
  await requireUser(adminClient(), event);
  const cfg = truelayerConfig();
  const state = randomUUID();
  const url = buildAuthUrl(cfg, { redirectUri: callbackUri(event), state, nonce: randomUUID() });
  return json(200, { url, state });
}));
