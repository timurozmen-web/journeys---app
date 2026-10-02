import { withLambda } from '@netlify/aws-lambda-compat';
import {
  adminClient, handle, HttpError, json, readJson, requireUser, supabaseStore, syncConnection,
} from '../lib/openBanking.js';
import { truelayerConfig } from '../lib/truelayer.js';

// Pulls purchases for one of the signed-in user's connections now (the
// app calls this right after cards are mapped, and from "Sync now").
export default withLambda((event) => handle(async () => {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'Method not allowed');
  const admin = adminClient();
  const user = await requireUser(admin, event);
  const { connectionId } = readJson(event);
  if (!connectionId) throw new HttpError(400, 'Missing connectionId.');
  const { data: connection } = await admin.from('open_banking_connections').select('id, user_id').eq('id', connectionId).eq('user_id', user.id).maybeSingle();
  if (!connection) throw new HttpError(404, 'Connection not found.');
  const result = await syncConnection({ store: supabaseStore(admin), cfg: truelayerConfig(), connection });
  return json(result.ok ? 200 : 400, result);
}));
