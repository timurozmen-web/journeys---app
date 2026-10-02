import { withLambda } from '@netlify/aws-lambda-compat';
import { header } from '../lib/openBanking.js';

// Where TrueLayer sends the user after they consent. It does nothing
// itself -- no signed-in user exists on this request -- it just hands the
// code back to the app, which is signed in and finishes the job with
// bank-link-exchange.
export default withLambda(async (event) => {
  const { code, state, error, error_description: description } = event.queryStringParameters || {};
  const host = header(event, 'x-forwarded-host') || header(event, 'host');
  const proto = header(event, 'x-forwarded-proto') || 'https';
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (state) params.set('state', state);
  if (error) params.set('error', description || error);
  return { statusCode: 302, headers: { Location: `${proto}://${host}/#/bank-sync?${params.toString()}` }, body: '' };
});
