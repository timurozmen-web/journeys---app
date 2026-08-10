// Runs server-side only. ANTHROPIC_API_KEY here is a plain (non-VITE_)
// environment variable, so it never gets bundled into the public app --
// only this function, running on Netlify's servers, ever sees it.

const SYSTEM_PROMPT = `You extract structured travel booking data from confirmation email text.

Read the email and determine if it's a HOTEL booking or a FLIGHT booking, then return ONLY a JSON object (no other text, no markdown fences) matching one of these shapes:

For a hotel:
{"type":"hotel","name":string,"country":string|null,"city":string|null,"brand":string|null,"checkIn":"YYYY-MM-DD","nights":number|null,"total":number|null,"currency":string|null}

For a flight:
{"type":"flight","date":"YYYY-MM-DD","from":string|null,"to":string|null,"airline":string|null,"flightNo":string|null,"cabin":string|null,"cost":number|null,"currency":string|null}

Rules:
- "from"/"to" should be 3-letter IATA airport codes if you can determine them, otherwise null.
- "total"/"cost" should be a plain number with no currency symbol or commas.
- "currency" should be a 3-letter ISO code (GBP, USD, EUR, etc) if determinable, otherwise null.
- If you genuinely cannot tell whether it's a hotel or flight booking, or the text isn't a booking confirmation at all, return {"type":"unknown"}.
- Never guess at a field you can't find evidence for in the text -- use null instead.`;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured: missing ANTHROPIC_API_KEY' }) };
  }

  let emailText;
  try {
    ({ emailText } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!emailText || typeof emailText !== 'string' || emailText.trim().length < 10) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Paste the email text first' }) };
  }
  // Basic length guard -- a booking confirmation is never this long, and
  // this keeps a stray huge paste from becoming an expensive call.
  const trimmedText = emailText.slice(0, 12000);

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
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmedText }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: `Anthropic API error: ${res.status} ${errText.slice(0, 300)}` }) };
    }

    const data = await res.json();
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not parse a clean result -- try again or enter the details manually' }) };
    }

    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }) };
  }
};
