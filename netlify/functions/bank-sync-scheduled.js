import { createClient } from '@supabase/supabase-js';
import { withLambda } from '@netlify/aws-lambda-compat';
import { enableBankingFetch } from '../lib/enableBankingAuth.js';

export const config = { schedule: '0 6 * * *' }; // daily, 06:00 UTC

export default withLambda(async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: 'Missing Supabase service role credentials' };
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: connections, error: fetchErr } = await supabase
    .from('bank_connections')
    .select('*')
    .gt('consent_valid_until', new Date().toISOString());
  if (fetchErr) {
    return { statusCode: 500, body: `Failed to load connections: ${fetchErr.message}` };
  }

  const results = [];
  for (const conn of connections ?? []) {
    try {
      // Only pull what's new since the last sync (or the last 30 days on
      // first run), rather than re-fetching full history every time.
      const dateFrom = conn.last_synced_at
        ? new Date(conn.last_synced_at).toISOString().slice(0, 10)
        : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const data = await enableBankingFetch(
        `/accounts/${conn.account_uid}/transactions?date_from=${dateFrom}`
      );

      const rows = (data.transactions ?? [])
        .filter((t) => t.credit_debit_indicator === 'DBIT') // spend only, not incoming payments
        .map((t) => ({
          user_id: conn.user_id,
          connection_id: conn.id,
          external_transaction_id: t.transaction_id || t.entry_reference,
          transaction_date: t.booking_date || t.transaction_date,
          amount: t.transaction_amount?.amount,
          currency: t.transaction_amount?.currency,
          description: Array.isArray(t.remittance_information) ? t.remittance_information.join(' ') : t.remittance_information || null,
        }))
        .filter((r) => r.external_transaction_id && r.amount);

      if (rows.length > 0) {
        // Upsert on the (user_id, external_transaction_id) unique
        // constraint -- re-running never creates duplicates.
        const { error: insertErr } = await supabase
          .from('bank_transactions')
          .upsert(rows, { onConflict: 'user_id,external_transaction_id', ignoreDuplicates: true });
        if (insertErr) throw insertErr;
      }

      await supabase.from('bank_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id);
      results.push({ connection: conn.id, synced: rows.length });
    } catch (err) {
      results.push({ connection: conn.id, error: err.message });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ results }) };
});
