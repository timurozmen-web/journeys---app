import { enableBankingFetch } from '../lib/enableBankingAuth.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const country = event.queryStringParameters?.country || 'GB';
  try {
    const data = await enableBankingFetch(`/aspsps?country=${encodeURIComponent(country)}&psu_type=personal`);
    const banks = (data.aspsps || []).map((a) => ({ name: a.name, country: a.country, logo: a.logo }));
    return { statusCode: 200, body: JSON.stringify({ banks }) };
  } catch (err) {
    return {
      statusCode: err.status && err.status < 500 ? err.status : 502,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
