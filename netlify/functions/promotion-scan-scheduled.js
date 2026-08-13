import { createClient } from '@supabase/supabase-js';
import { withLambda } from '@netlify/aws-lambda-compat';
import crypto from 'crypto';

export const config = { schedule: '0 7 * * *' }; // daily, 07:00 UTC

const SOURCE_URL = 'https://www.headforpoints.com/best-uk-hotel-points-promotions/';
const SOURCE_NAME = 'headforpoints';

// Same classification used by the manual scan-a-screenshot flow, adapted
// for pulling several promotions out of one long page instead of one
// screenshot, and restricted to promotions an existing member can
// actually use (not new-card sign-up bonuses, which don't apply to
// someone who already holds the card).
const SYSTEM_PROMPT = `You extract CURRENT, ACTIVE hotel loyalty promotions from a webpage's text content that a page like this contains for members of these programmes: Accor ALL, Hilton Honors, IHG One Rewards, Marriott Bonvoy.

Only include promotions that:
- Are currently active (not expired, not "not currently running")
- Apply to STAYS or ONGOING member benefits -- ignore new-card sign-up bonuses (e.g. "get 40,000 points when you apply for this debit card"), since those only help someone who doesn't yet hold the card
- Are genuine, named promotions with a clear mechanic (bonus points, multiplier, status boost, discount, or airline partner earning)

For each one found, classify into exactly one type:
1. "multiplier" -- an earning RATE boost, e.g. "double points". Fields: multiplier (number).
2. "threshold_bonus" -- stay/spend a certain amount, get a fixed bonus, e.g. "2,000 bonus points for every 1-3 night stay". Fields: thresholdSpend (number, £, null if not spend-based -- night-based thresholds can leave this null), bonusPoints (number).
3. "fixed_discount" -- a flat £/$ amount or % off. Fields: discountValue (number, £, null if you can't determine a concrete figure).
4. "status_boost" -- a one-time bonus of elite-qualifying nights or a status upgrade. Fields: statusNightsBonus (number).
5. "airline_partner" -- a joint earning promotion between a hotel programme and an airline. Fields: partnerAirline (string).

Return ONLY a JSON array (no other text, no markdown fences) of objects with this shape:
{"title":string,"description":string,"brand":"Accor ALL"|"Hilton Honors"|"IHG One Rewards"|"Marriott Bonvoy","startDate":"YYYY-MM-DD"|null,"endDate":"YYYY-MM-DD"|null,"promoType":"multiplier"|"threshold_bonus"|"fixed_discount"|"status_boost"|"airline_partner"|"other","multiplier":number|null,"thresholdSpend":number|null,"bonusPoints":number|null,"discountValue":number|null,"statusNightsBonus":number|null,"partnerAirline":string|null}

If no active, relevant promotions are found, return an empty array [].`;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(brand, title) {
  return crypto.createHash('sha256').update(`${brand}::${title}`.toLowerCase()).digest('hex');
}

export default withLambda(async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !serviceKey || !anthropicKey) {
    return { statusCode: 500, body: 'Missing required environment variables' };
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // This app is currently single-user; scan runs for every user with any
  // loyalty programme configured, so it naturally extends if that changes.
  const { data: users, error: usersErr } = await supabase.from('loyalty_programmes').select('user_id').limit(1000);
  if (usersErr) return { statusCode: 500, body: `Failed to load users: ${usersErr.message}` };
  const userIds = [...new Set((users ?? []).map((u) => u.user_id))];
  if (userIds.length === 0) return { statusCode: 200, body: 'No users to scan for' };

  let pageText;
  try {
    const pageRes = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JourneysApp/1.0)' } });
    if (!pageRes.ok) throw new Error(`Fetch failed: ${pageRes.status}`);
    const html = await pageRes.text();
    pageText = stripHtml(html).slice(0, 40000); // keep well within a reasonable token budget
  } catch (err) {
    return { statusCode: 502, body: `Failed to fetch source page: ${err.message}` };
  }

  let promos;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: pageText }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Claude API error');
    const text = data.content?.[0]?.text ?? '[]';
    promos = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
    if (!Array.isArray(promos)) throw new Error('Expected a JSON array');
  } catch (err) {
    return { statusCode: 502, body: `Extraction failed: ${err.message}` };
  }

  const results = [];
  for (const userId of userIds) {
    const rows = promos.map((p) => ({
      user_id: userId,
      source: SOURCE_NAME,
      brand: p.brand ?? null,
      title: p.title,
      description: p.description ?? null,
      start_date: p.startDate ?? null,
      end_date: p.endDate ?? null,
      promo_type: p.promoType ?? 'other',
      multiplier: p.multiplier ?? null,
      threshold_spend: p.thresholdSpend ?? null,
      bonus_points: p.bonusPoints ?? null,
      discount_value: p.discountValue ?? null,
      status_nights_bonus: p.statusNightsBonus ?? null,
      partner_airline: p.partnerAirline ?? null,
      fingerprint: fingerprint(p.brand, p.title),
    }));
    if (rows.length > 0) {
      const { error } = await supabase
        .from('promotion_scan_candidates')
        .upsert(rows, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true });
      if (error) {
        results.push({ userId, error: error.message });
        continue;
      }
    }
    results.push({ userId, found: rows.length });
  }

  return { statusCode: 200, body: JSON.stringify({ results }) };
});
