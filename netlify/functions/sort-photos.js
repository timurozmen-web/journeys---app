import { withLambda } from '@netlify/aws-lambda-compat';
import { adminClient, handle, HttpError, json, readJson, requireUser } from '../lib/http.js';
import { MAX_PHOTOS, PHOTO_SCHEMA, PHOTO_SYSTEM, aspectsByPhoto } from '../lib/photoAspects.js';

// Sorts a stay's photos into the review's aspects (src/lib/photoSort.ts
// sends them, small). Signed-in callers only, as each call is paid for.
// ANTHROPIC_API_KEY is a plain (non-VITE_) variable, read only here.
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default withLambda((event) => handle(async () => {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'Method not allowed');
  await requireUser(adminClient(), event);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new HttpError(500, 'Server not configured: missing ANTHROPIC_API_KEY');

  const { images } = readJson(event);
  if (!Array.isArray(images) || images.length === 0) throw new HttpError(400, 'No photos sent.');
  if (images.length > MAX_PHOTOS) throw new HttpError(400, `Send at most ${MAX_PHOTOS} photos at a time.`);
  const content = [];
  images.forEach((img, i) => {
    if (!img || typeof img.data !== 'string' || !ALLOWED_IMAGE_TYPES.has(img.mediaType)) throw new HttpError(400, 'Malformed photo.');
    content.push({ type: 'text', text: `Photo ${i + 1}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // A declined request is re-run on the fallback Anthropic picks for its
      // reason, rather than coming back empty.
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      fallbacks: 'default',
      // Sorting is a quick look, not a hard problem.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PHOTO_SCHEMA } },
      system: PHOTO_SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new HttpError(502, `Anthropic API error: ${res.status} ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  if (data.stop_reason === 'refusal' || data.stop_reason === 'max_tokens') throw new HttpError(502, 'Could not sort these photos.');
  let answer;
  try {
    answer = JSON.parse(data.content?.find((c) => c.type === 'text')?.text ?? '');
  } catch {
    throw new HttpError(502, 'Could not sort these photos.');
  }
  return json(200, { aspects: aspectsByPhoto(images.length, answer) });
}));
