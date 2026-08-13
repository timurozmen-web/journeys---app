import jwt from 'jsonwebtoken';

const ENABLE_BANKING_BASE = 'https://api.enablebanking.com';

// Env var UIs handle multi-line PEM keys inconsistently -- some preserve
// real newlines, some collapse them to literal "\n" text, some collapse
// them entirely onto one line. This normalizes whichever form arrives
// back into valid, properly-line-wrapped PEM.
function normalizePrivateKey(raw) {
  let key = raw.trim();

  // Case 1: literal backslash-n sequences instead of real newlines.
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }

  // Case 2: still no real newlines at all (single-line paste) -- pull the
  // header, footer, and base64 body apart and rebuild proper PEM with
  // standard 64-character line wrapping.
  if (!key.includes('\n')) {
    const match = key.match(/-----BEGIN ([A-Z ]+)-----(.*)-----END ([A-Z ]+)-----/);
    if (match) {
      const [, beginLabel, body, endLabel] = match;
      const cleanBody = body.replace(/\s+/g, '');
      const wrapped = cleanBody.match(/.{1,64}/g)?.join('\n') ?? cleanBody;
      key = `-----BEGIN ${beginLabel}-----\n${wrapped}\n-----END ${endLabel}-----`;
    }
  }

  return key;
}

// Enable Banking JWTs: RS256, "kid" = your registered app_id, max 24h TTL.
// The private key never leaves this server-side module.
export function buildEnableBankingJWT() {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  const rawKey = process.env.ENABLE_BANKING_PRIVATE_KEY;
  if (!appId || !rawKey) {
    throw new Error('Server not configured: missing ENABLE_BANKING_APP_ID or ENABLE_BANKING_PRIVATE_KEY');
  }
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 },
    normalizePrivateKey(rawKey),
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
