import { enableBankingFetch } from '../lib/enableBankingAuth.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  const { aspspName, aspspCountry, userId, redirectUrl } = body;
  if (!aspspName || !aspspCountry || !userId || !redirectUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'aspspName, aspspCountry, userId, and redirectUrl are all required' }) };
  }

  // A consent window of 90 days -- comfortably covers "daily or weekly"
  // syncing without needing to re-authorize constantly. Enable Banking
  // will clamp this down if the bank's own maximum is shorter.
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 90);

  // The user's Supabase id travels in "state" so the callback (which the
  // bank redirects to directly, with no authenticated browser session)
  // knows whose account this connection belongs to.
  const state = userId;

  try {
    const data = await enableBankingFetch('/auth', {
      method: 'POST',
      body: JSON.stringify({
        access: { valid_until: validUntil.toISOString(), balances: true, transactions: true },
        aspsp: { name: aspspName, country: aspspCountry },
        state,
        redirect_url: redirectUrl,
        psu_type: 'personal',
      }),
    });
    return { statusCode: 200, body: JSON.stringify({ url: data.url }) };
  } catch (err) {
    return {
      statusCode: err.status && err.status < 500 ? err.status : 502,
      body: JSON.stringify({ error: err.message, detail: err.body }),
    };
  }
};
