// The city-suggestion agent behind Plan a trip: what it's asked, what it's
// told, and how its answer is checked before the app sees it. Kept apart
// from the function so it can be tested without calling the model.
//
// The app sends facts with each request (src/lib/planIntel.ts,
// agentContext): every region's weather, crowds and prices in the month
// of travel, from the app's sourced climate and crowd tables, the public
// and school holidays during the trip (Nager.Date, OpenHolidays) and the
// cities the traveller has already stayed in. The agent is told to use those rather than its own
// memory for weather and crowds.

export const MODEL = 'claude-haiku-4-5-20251001';

export const SYSTEM_PROMPT = `You suggest cities worth visiting in a given country for a trip of a stated length, for a well-travelled traveller who cares about hotel loyalty programmes and efficient routing.

Return ONLY a JSON array (no other text, no markdown fences) of 3-6 city objects, ordered as a sensible geographic route (minimising backtracking), each shaped:
{"city":string,"lat":number,"lng":number,"nights":number,"why":string,"nearestAirport":string|null}

Rules:
- "lat"/"lng" must be the real coordinates of the city centre, as accurate as you can give.
- "nights" should sum to the trip length given, weighted toward the places that justify more time.
- "why" is one short sentence -- what makes this stop worth the time.
- "nearestAirport" is the IATA code of the main airport serving that city, or null if you're not confident.
- Order the array as an efficient travel sequence, not by importance.

You may be given FACTS for the month of travel: each region's average high, rainfall, crowd and price level, and the event behind them. When you are:
- Rely on them, not your own memory, for anything about weather, crowds or prices, and never state a figure that isn't in them.
- Give fewer nights to a region with heavy rain (over 250mm in the month) or highs over 35C, or leave it out, unless the trip can't make sense without it.
- A region busy because of an event can stay in, and its "why" may name the event.

You may be given HOLIDAYS: national public holidays during the trip. Domestic travel peaks around them, so popular places get busy; a stop on one may say so in "why". Don't assume they make hotels dearer: business cities often get cheaper.

You may be given SCHOOL HOLIDAYS: when the country's schools are off during the trip, and whether nationwide or in some regions. Families travel then, so beaches, mountains and theme parks fill; a stop that will be busy with them may say so in "why".

You may be given VISITED: cities the traveller has already stayed in. Prefer places they haven't been. Keep a visited city only when the route needs it or it is unmissable, and give it fewer nights.`;

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// How widely a school break reaches, as the app sends it and as the agent reads it.
const REACH = { all: 'nationwide', most: 'most regions', some: 'some regions' };

/**
 * The facts from the request, trimmed to sane sizes: they come from the
 * browser, so nothing in them is trusted to be the shape it claims.
 */
export function cleanContext(context) {
  if (!context || typeof context !== 'object') return null;
  const regions = Array.isArray(context.regions) ? context.regions.slice(0, 20).map((r) => ({
    region: clip(r?.region, 60), highC: num(r?.highC), rainMm: num(r?.rainMm),
    crowd: clip(r?.crowd, 10) || null, price: clip(r?.price, 10) || null, event: clip(r?.event, 80) || null,
  })).filter((r) => r.region) : [];
  const visited = Array.isArray(context.visited) ? context.visited.slice(0, 30).map((c) => clip(c, 60)).filter(Boolean) : [];
  const holidays = Array.isArray(context.holidays) ? context.holidays.slice(0, 20)
    .filter((h) => typeof h?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date))
    .map((h) => ({ date: h.date, name: clip(h.name, 60) })) : [];
  const day = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const school = Array.isArray(context.school) ? context.school.slice(0, 5)
    .filter((s) => day(s?.start) && day(s?.end) && Object.hasOwn(REACH, s?.reach ?? ''))
    .map((s) => ({ start: s.start, end: s.end, name: clip(s.name, 60), reach: s.reach })) : [];
  return { month: clip(context.month, 20) || null, regions, visited, holidays, school, home: clip(context.home, 60) || null };
}

/** The user message: the trip, then the facts and the places already visited. */
export function buildMessage({ country, nights, context }) {
  const c = cleanContext(context);
  const lines = [`Country: ${clip(country, 60)}. Trip length: ${nights ?? 10} nights.${c?.month ? ` Month: ${c.month}.` : ''}${c?.home ? ` Travelling from ${c.home}.` : ''}`];
  if (c?.regions.length) {
    lines.push('', `FACTS for ${c.month ?? 'the month of travel'}:`);
    for (const r of c.regions) {
      const bits = [
        r.highC != null ? `high ${Math.round(r.highC)}C` : null,
        r.rainMm != null ? `rain ${Math.round(r.rainMm)}mm` : null,
        r.crowd ? `crowds ${r.crowd}` : null,
        r.price ? `prices ${r.price}` : null,
      ].filter(Boolean);
      lines.push(`- ${r.region}: ${bits.join(', ')}${r.event ? ` (${r.event})` : ''}`);
    }
  }
  if (c?.holidays.length) lines.push('', `HOLIDAYS: ${c.holidays.map((h) => `${h.date} ${h.name}`).join('; ')}`);
  if (c?.school.length) lines.push('', `SCHOOL HOLIDAYS: ${c.school.map((s) => `${s.start} to ${s.end} ${s.name} (${REACH[s.reach]})`).join('; ')}`);
  if (c?.visited.length) lines.push('', `VISITED: ${c.visited.join(', ')}`);
  return lines.join('\n');
}

/**
 * Shares out `total` nights in proportion to what was suggested, every
 * stop keeping at least one (largest remainders get the spare nights).
 * The model's nights often don't add up to the trip: 12 asked, 13 given.
 */
export function fitNights(suggested, total) {
  const n = suggested.length;
  if (n === 0 || !total) return suggested;
  const sum = suggested.reduce((s, x) => s + x, 0);
  if (sum === total) return suggested;
  const spare = total - n; // one night each first
  // Weighted by the nights suggested beyond the first; evenly when every
  // stop was given one.
  const weights = suggested.map((x) => Math.max(0, x - 1));
  const w = weights.reduce((s, x) => s + x, 0);
  const extra = weights.map((x) => (w > 0 ? x / w : 1 / n) * spare);
  const base = extra.map(Math.floor);
  let left = spare - base.reduce((s, x) => s + x, 0);
  const order = extra.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (left <= 0) break; base[i] += 1; left -= 1; }
  return base.map((x) => x + 1);
}

/**
 * The model's answer as cities the app can use, or an error saying what
 * was wrong with it. Drops entries without a name or real coordinates,
 * keeps an airport code only if it looks like one, and makes the nights
 * add up to the trip.
 */
export function parseCities(text, nights) {
  const raw = String(text ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '');
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end < start) throw new Error('No list of cities in the answer');
  let list;
  try { list = JSON.parse(raw.slice(start, end + 1)); } catch { throw new Error('The answer was not valid JSON'); }
  if (!Array.isArray(list)) throw new Error('Expected a JSON array');
  const total = Number.isInteger(nights) && nights > 0 ? nights : null;
  let cities = list
    .filter((c) => c && typeof c.city === 'string' && c.city.trim() && num(c.lat) != null && num(c.lng) != null && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180)
    .slice(0, 8)
    .map((c) => ({
      city: c.city.trim(),
      lat: c.lat,
      lng: c.lng,
      nights: Math.max(1, Math.round(num(c.nights) ?? 1)),
      why: clip(c.why, 200),
      nearestAirport: typeof c.nearestAirport === 'string' && /^[A-Za-z]{3}$/.test(c.nearestAirport.trim()) ? c.nearestAirport.trim().toUpperCase() : null,
    }));
  if (cities.length === 0) throw new Error('No usable cities in the answer');
  if (total) {
    cities = cities.slice(0, total);
    const fitted = fitNights(cities.map((c) => c.nights), total);
    cities = cities.map((c, i) => ({ ...c, nights: fitted[i] }));
  }
  return cities;
}

/** Asks the model and checks its answer. `fetchImpl` is swapped in tests. */
export async function suggestCities({ country, nights, context }, { apiKey, fetchImpl = fetch }) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildMessage({ country, nights, context }) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Claude API error');
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseCities(text, nights);
}
