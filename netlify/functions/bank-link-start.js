import { withLambda } from '@netlify/aws-lambda-compat';
import { randomUUID } from 'node:crypto';
import { adminClient, callbackUri, handle, HttpError, json, requireUser } from '../lib/openBanking.js';
import { signState } from '../lib/linkState.js';
import { buildAuthUrl, truelayerConfig } from '../lib/truelayer.js';

// Step 1 of connecting a bank: returns TrueLayer's consent URL. The caller
// must be signed in. The signed `state` records who started it, so the
// callback can finish the job without needing a session in whichever
// browser the bank sends the user back to.
export default withLambda((event) => handle(async () => {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'Method not allowed');
  const user = await requireUser(adminClient(), event);
  const cfg = truelayerConfig();
  const state = signState(user.id, cfg.clientSecret);
  const url = buildAuthUrl(cfg, { redirectUri: callbackUri(event), state, nonce: randomUUID() });
  return json(200, { url });
}));
