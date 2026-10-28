import { withLambda } from '@netlify/aws-lambda-compat';
import { adminClient, json, requireUser } from '../lib/http.js';
import { suggestCities } from '../lib/planPrompt.js';

// Plan a trip's city suggestions. The prompt, the facts it's given and
// the checks on its answer are in netlify/lib/planPrompt.js.
export default withLambda(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  // Signed-in callers only: each call is paid for.
  try {
    await requireUser(adminClient(), event);
  } catch (err) {
    return json(err.status ?? 500, { error: err.message });
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
  const { country, nights, context } = body;
  if (!country) {
    return { statusCode: 400, body: JSON.stringify({ error: 'country is required' }) };
  }

  try {
    const cities = await suggestCities({ country, nights: Number.isInteger(nights) ? nights : 10, context }, { apiKey });
    return { statusCode: 200, body: JSON.stringify({ cities }) };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Suggestion failed' }) };
  }
});
