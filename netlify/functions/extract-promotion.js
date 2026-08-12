const SYSTEM_PROMPT = `You extract and classify a travel loyalty promotion from a screenshot (e.g. an email, app screen, or website page advertising a hotel/airline promotion).

Classify it into exactly one of these types, and return ONLY a JSON object (no other text, no markdown fences):

1. "multiplier" -- an earning RATE boost, e.g. "Earn 2x points", "Triple points on stays". Fields: multiplier (number, e.g. 2 or 3).
2. "threshold_bonus" -- spend/stay a certain amount, get a fixed bonus, e.g. "Spend £2,000, earn 15,000 bonus points". Fields: thresholdSpend (number, £), bonusPoints (number).
3. "fixed_discount" -- a flat £/$ amount or % off, e.g. "£50 off your next stay". Fields: discountValue (number, £ -- convert % off an estimated typical stay cost to null if you can't determine a concrete £ figure, do not guess).
4. "status_boost" -- a one-time bonus of elite-qualifying nights or a status upgrade, e.g. "Earn a bonus of 15 Status nights", "Fast Track to Gold". Fields: statusNightsBonus (number of nights).
5. "airline_partner" -- a JOINT earning promotion between a hotel programme and an airline programme, e.g. "Earn Avios when you stay at IHG hotels". Fields: partnerAirline (string, the airline/programme name).

If it doesn't clearly fit one of these, use "other" with no extra fields.

Return this shape:
{"title":string,"description":string|null,"brand":string|null,"startDate":"YYYY-MM-DD"|null,"endDate":"YYYY-MM-DD"|null,"promoType":"multiplier"|"threshold_bonus"|"fixed_discount"|"status_boost"|"airline_partner"|"other","multiplier":number|null,"thresholdSpend":number|null,"bonusPoints":number|null,"discountValue":number|null,"statusNightsBonus":number|null,"partnerAirline":string|null}

Rules:
- "brand" should be the parent loyalty programme if determinable (e.g. "Marriott Bonvoy", "Accor ALL"), not a specific hotel name.
- Only fill in the field(s) relevant to the chosen promoType -- leave all others null.
- Never guess at a field you can't find evidence for -- use null instead.
- If the image genuinely isn't a promotion (e.g. it's a booking confirmation), return {"promoType":"other","title":"Unrecognized","description":null,"brand":null,"startDate":null,"endDate":null,"multiplier":null,"thresholdSpend":null,"bonusPoints":null,"discountValue":null,"statusNightsBonus":null,"partnerAirline":null}.`;

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
  const { promoText, images } = body;

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
  if (promoText && typeof promoText === 'string' && promoText.trim().length >= 5) {
    content.push({ type: 'text', text: promoText.slice(0, 8000) });
  }
  if (content.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Paste some promotion text or attach at least one screenshot.' }) };
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
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not parse a clean result -- try again or enter it manually' }) };
    }

    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }) };
  }
};
