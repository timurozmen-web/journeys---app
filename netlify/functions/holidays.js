import { withLambda } from '@netlify/aws-lambda-compat';
import { fetchHolidays, fetchSchoolHolidays, parseQuery } from '../lib/holidays.js';

// GET ?country=JP&year=2027: that year's public holidays; add &kind=school
// for its school holidays instead (see netlify/lib/holidays.js). Asked
// apart so one source being down doesn't lose the other. Holidays don't
// change, so the answer is cached for a day.
export default withLambda(async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  const q = parseQuery(event.queryStringParameters);
  if (!q) return { statusCode: 400, body: JSON.stringify({ error: 'country (two letters) and year are required' }) };
  const school = event.queryStringParameters?.kind === 'school';
  try {
    const result = school ? await fetchSchoolHolidays(q) : await fetchHolidays(q);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      body: JSON.stringify({ country: q.country, year: q.year, ...result }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Holidays unavailable' }) };
  }
});
