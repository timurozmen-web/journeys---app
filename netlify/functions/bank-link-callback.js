import { withLambda } from '@netlify/aws-lambda-compat';
import { adminClient, callbackUri, completeLink, header, supabaseStore } from '../lib/openBanking.js';
import { verifyState } from '../lib/linkState.js';
import { truelayerConfig } from '../lib/truelayer.js';

// Where TrueLayer sends the user after they consent. It finishes the link
// itself (the signed `state` says which user started it) and then sends
// the browser on to the app: `?linked=<id>` on success, `?error=` if not.
// Doing the work here, not in the app, means it completes even when the
// bank returns you to a browser that isn't signed in or isn't the
// installed app.
export default withLambda(async (event) => {
  const { code, state, error, error_description: description } = event.queryStringParameters || {};
  const host = header(event, 'x-forwarded-host') || header(event, 'host');
  const proto = header(event, 'x-forwarded-proto') || 'https';
  const back = (params) => ({ statusCode: 302, headers: { Location: `${proto}://${host}/#/bank-sync?${new URLSearchParams(params)}` }, body: '' });

  if (error) return back({ error: description || error });
  try {
    const cfg = truelayerConfig();
    const userId = verifyState(state, cfg.clientSecret);
    const result = await completeLink({ store: supabaseStore(adminClient()), cfg, userId, code, redirectUri: callbackUri(event) });
    return back({ linked: result.connectionId });
  } catch (err) {
    console.error('bank-link-callback failed:', err?.message);
    return back({ error: err?.message || 'Could not finish connecting your bank.' });
  }
});
