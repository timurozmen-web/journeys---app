import { withLambda } from '@netlify/aws-lambda-compat';
import { adminClient, handle, HttpError, json, readJson, requireUser } from '../lib/openBanking.js';

// Removes a bank connection, its saved login, and the card spend pulled
// through it (they cascade from the connection row).
export default withLambda((event) => handle(async () => {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'Method not allowed');
  const admin = adminClient();
  const user = await requireUser(admin, event);
  const { connectionId } = readJson(event);
  if (!connectionId) throw new HttpError(400, 'Missing connectionId.');
  const { error } = await admin.from('open_banking_connections').delete().eq('id', connectionId).eq('user_id', user.id);
  if (error) throw new HttpError(500, error.message);
  return json(200, { ok: true });
}));
