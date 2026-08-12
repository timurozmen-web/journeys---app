import { createClient } from '@supabase/supabase-js';
import { enableBankingFetch } from '../lib/enableBankingAuth.js';

function html(body) {
  return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body };
}

export const handler = async (event) => {
  const { code, state, error, error_description } = event.queryStringParameters || {};

  if (error) {
    return html(`<h2>Bank connection failed</h2><p>${error_description || error}</p><p>You can close this window and try again.</p>`);
  }
  if (!code || !state) {
    return html(`<h2>Bank connection failed</h2><p>Missing authorization details.</p>`);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return html(`<h2>Server not configured</h2><p>Missing Supabase service role credentials.</p>`);
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const userId = state; // set by bank-link-start

  try {
    const session = await enableBankingFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });

    const account = session.accounts?.[0];
    if (!account?.uid) {
      return html(`<h2>Bank connection failed</h2><p>No accessible account was returned.</p>`);
    }

    const { error: dbError } = await supabase.from('bank_connections').insert({
      user_id: userId,
      aspsp_name: session.aspsp?.name ?? 'Unknown bank',
      aspsp_country: session.aspsp?.country ?? '',
      session_id: session.session_id,
      account_uid: account.uid,
      account_name: account.name ?? account.product ?? null,
      consent_valid_until: session.access?.valid_until ?? new Date(Date.now() + 90 * 86400000).toISOString(),
    });
    if (dbError) throw dbError;

    return html(`<h2>Bank connected</h2><p>You can close this window and go back to the app.</p>`);
  } catch (err) {
    return html(`<h2>Bank connection failed</h2><p>${err.message || 'Unknown error'}</p>`);
  }
};
