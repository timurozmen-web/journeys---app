import { withLambda } from '@netlify/aws-lambda-compat';

const FLIGHT_SYSTEM_PROMPT = `You build a single, natural-language Google Flights search query from structured flight search parameters.

Return ONLY a JSON object (no other text, no markdown fences) shaped:
{"query": string}

Rules:
- Always state whether it's a one-way or return search, the cities, and any given date(s), in a clear, unambiguous sentence.
- If "stops" is "nonstop", include the word "nonstop". If "one-stop", include "1 stop or fewer". If "any", omit any stops language.
- If "cabin" is given (and not "any"), include it plainly, e.g. "business class".
- If "airline" is given as a specific carrier name, include it plainly, e.g. "on British Airways".
- If "alliance" is given (and not "any"), this is the important part: an airline alliance (Star Alliance, Oneworld, or SkyTeam) is a group of roughly 15-20 airlines, not a single searchable entity, so naming the alliance itself in a Google Flights search does not work. Instead, use your own knowledge of airline networks to pick the ONE specific member airline of that alliance most likely to actually operate the given route (direct or with minimal connections), and name that specific airline in the query instead of the alliance. Prioritize an airline actually based in or near the departure or arrival region over a more globally famous member that has no real presence on that route -- e.g. for a Seoul-Sydney route, a Korea-or-Australia-based alliance member is a far better choice than a European one just because it's a bigger airline. If you are not confident which member airline serves this route, pick the alliance's most plausible carrier for that specific region rather than defaulting to whichever member is most famous overall.
- If BOTH airline and alliance are given, only use the specific airline (it's more precise) and ignore the alliance.
- Never combine two clauses with the same preposition back to back (e.g. never produce "...on Oneworld on 2027-03-10..." -- keep every clause clearly separated, e.g. with commas).
- Keep the whole query as one grammatically clean sentence a human travel agent would plausibly type into a search bar.`;

const HOTEL_SYSTEM_PROMPT = `You build a single, natural-language Google Hotels search query from structured parameters (a hotel brand/programme name, a city, and a country).

Return ONLY a JSON object (no other text, no markdown fences) shaped:
{"query": string}

Rules:
- The loyalty programme name given may not exactly match how the hotel brand is commonly searched for (e.g. "Marriott Bonvoy" is the loyalty programme, but people search for "Marriott" hotels; "World of Hyatt" -> "Hyatt"). Use your knowledge of these brands to translate the programme name into the actual hotel brand name(s) travellers would search for.
- Some loyalty programmes cover multiple distinct hotel brands (e.g. Marriott Bonvoy spans Marriott, Sheraton, Westin, Ritz-Carlton, and more; IHG One Rewards spans InterContinental, Holiday Inn, Crowne Plaza, and more). If the programme is a multi-brand umbrella, name the single most relevant/flagship brand for a general search rather than listing every sub-brand.
- Keep the query short and natural, e.g. "Marriott hotels in Tokyo, Japan".`;

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

  const { type } = body;
  if (type !== 'flight' && type !== 'hotel') {
    return { statusCode: 400, body: JSON.stringify({ error: 'type must be "flight" or "hotel"' }) };
  }

  const systemPrompt = type === 'flight' ? FLIGHT_SYSTEM_PROMPT : HOTEL_SYSTEM_PROMPT;
  const userContent = JSON.stringify(body.params ?? {});

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
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Claude API error');
    const text = data.content?.[0]?.text ?? '{}';
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
    if (!parsed.query || typeof parsed.query !== 'string') throw new Error('No query returned');
    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Query generation failed' }) };
  }
});
