import { withLambda } from '@netlify/aws-lambda-compat';

const SYSTEM_PROMPT = `You give general seasonal travel guidance for a destination country, based on well-established, widely-known patterns -- weather, major local/international events, school holiday periods, and generally-understood high/shoulder/low season reputations for that destination. You do not have access to live or historical flight/hotel pricing data, so never state specific prices or claim precision you don't have.

Return ONLY a JSON object (no other text, no markdown fences) shaped:
{"months":[{"month":string,"priceLevel":"low"|"medium"|"high","note":string}],"summary":string}

Rules:
- "months" must have exactly 12 entries, in calendar order starting January, using short month names ("Jan", "Feb", etc).
- "priceLevel" reflects the well-known general reputation of that month for that destination (peak tourist season = high, off-season = low), not a specific number.
- "note" is one short phrase (under 10 words) -- the main reason for that level, e.g. "Cherry blossom season, very busy" or "Typhoon risk, quieter" or "School holidays push prices up".
- "summary" is one sentence giving a genuinely useful, specific recommendation for the best-value time to visit, not a generic platitude.`;

export default withLambda(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured: missing ANTHROPIC_API_KEY' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  const { country } = body;
  if (!country) {
    return { statusCode: 400, body: JSON.stringify({ error: 'country is required' }) };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Country: ${country}` }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Claude API error');
    const text = data.content?.[0]?.text ?? '{}';
    const guidance = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
    return { statusCode: 200, body: JSON.stringify(guidance) };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Guidance failed' }) };
  }
});
