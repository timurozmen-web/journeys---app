import { withLambda } from '@netlify/aws-lambda-compat';
import { fetchHolidays, parseQuery } from '../lib/holidays.js';

// GET ?country=JP&year=2027: that year's public holidays (see
// netlify/lib/holidays.js). Holidays don't change, so the answer is cached
// for a day.
export default withLambda(async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  const q = parseQuery(event.queryStringParameters);
  if (!q) return { statusCode: 400, body: JSON.stringify({ error: 'country (two letters) and year are required' }) };
  try {
    const result = await fetchHolidays(q);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      body: JSON.stringify({ country: q.country, year: q.year, ...result }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Holidays unavailable' }) };
  }
});
