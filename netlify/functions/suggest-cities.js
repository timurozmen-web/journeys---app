import { withLambda } from '@netlify/aws-lambda-compat';

const SYSTEM_PROMPT = `You suggest cities worth visiting in a given country for a trip of a stated length, for a well-travelled traveller who cares about hotel loyalty programmes and efficient routing.

Return ONLY a JSON array (no other text, no markdown fences) of 3-6 city objects, ordered as a sensible geographic route (minimising backtracking), each shaped:
{"city":string,"lat":number,"lng":number,"nights":number,"why":string,"nearestAirport":string|null}

Rules:
- "lat"/"lng" must be the real coordinates of the city centre, as accurate as you can give.
- "nights" should sum to roughly the trip length given, weighted toward the places that justify more time.
- "why" is one short sentence -- what makes this stop worth the time.
- "nearestAirport" is the IATA code of the main airport serving that city, or null if you're not confident.
- Order the array as an efficient travel sequence, not by importance.`;

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
  const { country, nights } = body;
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
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Country: ${country}. Trip length: ${nights ?? 10} nights.` }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Claude API error');
    const text = data.content?.[0]?.text ?? '[]';
    const cities = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
    if (!Array.isArray(cities)) throw new Error('Expected a JSON array');
    return { statusCode: 200, body: JSON.stringify({ cities }) };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Suggestion failed' }) };
  }
});
