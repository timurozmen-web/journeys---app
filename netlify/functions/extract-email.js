// Runs server-side only. ANTHROPIC_API_KEY here is a plain (non-VITE_)
// environment variable, so it never gets bundled into the public app --
// only this function, running on Netlify's servers, ever sees it.

const SYSTEM_PROMPT = `You extract structured travel booking data from a hotel or flight confirmation, given either as plain text or as one or more screenshot images of the confirmation (read any text visible in the images).

Determine if it's a HOTEL booking or a FLIGHT booking, then return ONLY a JSON object (no other text, no markdown fences) matching one of these shapes:

For a hotel:
{"type":"hotel","name":string,"country":string|null,"city":string|null,"brand":string|null,"checkIn":"YYYY-MM-DD","nights":number|null,"total":number|null,"currency":string|null}

For a flight:
{"type":"flight","date":"YYYY-MM-DD","from":string|null,"to":string|null,"airline":string|null,"flightNo":string|null,"cabin":string|null,"cost":number|null,"currency":string|null}

Rules:
- "from"/"to" should be 3-letter IATA airport codes if you can determine them, otherwise null.
- "total"/"cost" should be a plain number with no currency symbol or commas.
- "currency" should be a 3-letter ISO code (GBP, USD, EUR, etc) if determinable, otherwise null.
- If multiple images are provided, they may be different parts of the same scrolled confirmation -- combine what you learn from all of them into one result.
- If you genuinely cannot tell whether it's a hotel or flight booking, or the content isn't a booking confirmation at all, return {"type":"unknown"}.
- Never guess at a field you can't find evidence for -- use null instead.`;

const MAX_IMAGES = 4;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const handler = async (event) => {
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
  const { emailText, images } = body;

  const content = [];
  if (Array.isArray(images) && images.length > 0) {
    if (images.length > MAX_IMAGES) {
      return { statusCode: 400, body: JSON.stringify({ error: `Send at most ${MAX_IMAGES} screenshots at a time.` }) };
    }
    for (const img of images) {
      if (!img || typeof img.mediaType !== 'string' || typeof img.data !== 'string') {
        return { statusCode: 400, body: JSON.stringify({ error: 'Malformed image data' }) };
      }
      if (!ALLOWED_IMAGE_TYPES.has(img.mediaType)) {
        return { statusCode: 400, body: JSON.stringify({ error: `Unsupported image type: ${img.mediaType}` }) };
      }
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
    }
  }
  if (emailText && typeof emailText === 'string' && emailText.trim().length >= 10) {
    content.push({ type: 'text', text: emailText.slice(0, 12000) });
  }
  if (content.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Paste some email text or attach at least one screenshot.' }) };
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
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
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
