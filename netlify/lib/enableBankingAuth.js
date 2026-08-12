import jwt from 'jsonwebtoken';

const ENABLE_BANKING_BASE = 'https://api.enablebanking.com';

// Enable Banking JWTs: RS256, "kid" = your registered app_id, max 24h TTL.
// The private key never leaves this server-side module.
export function buildEnableBankingJWT() {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  const privateKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
  if (!appId || !privateKey) {
    throw new Error('Server not configured: missing ENABLE_BANKING_APP_ID or ENABLE_BANKING_PRIVATE_KEY');
  }
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 },
    // Netlify env vars can't hold real newlines cleanly -- the key is
    // stored with literal "\n" sequences and restored here.
    privateKey.replace(/\\n/g, '\n'),
    { algorithm: 'RS256', header: { kid: appId } }
  );
}

export async function enableBankingFetch(path, options = {}) {
  const token = buildEnableBankingJWT();
  const res = await fetch(`${ENABLE_BANKING_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || body.error_description || `Enable Banking API error: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}
