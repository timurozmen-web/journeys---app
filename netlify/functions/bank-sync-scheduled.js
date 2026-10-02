import { withLambda } from '@netlify/aws-lambda-compat';
import { adminClient, supabaseStore, syncConnection } from '../lib/openBanking.js';
import { truelayerConfig } from '../lib/truelayer.js';

export const config = { schedule: '0 6 * * *' }; // daily, 06:00 UTC

// Keeps every connected bank's spend fresh without opening the app, so
// spending goals are live. A failure on one connection never stops the
// rest.
export default withLambda(async () => {
  const admin = adminClient();
  const cfg = truelayerConfig();
  const store = supabaseStore(admin);
  const { data: connections, error } = await admin.from('open_banking_connections').select('id, user_id');
  if (error) return { statusCode: 500, body: `Failed to load connections: ${error.message}` };

  const results = [];
  for (const connection of connections ?? []) {
    try {
      const r = await syncConnection({ store, cfg, connection });
      results.push({ connection: connection.id, ok: r.ok, rows: r.rows ?? 0, error: r.error });
    } catch (err) {
      results.push({ connection: connection.id, ok: false, error: err.message });
    }
  }
  return { statusCode: 200, body: JSON.stringify({ results }) };
});
