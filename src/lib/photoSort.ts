// Sends a stay's photos, small, to be sorted into the review's aspects
// (netlify/functions/sort-photos.js) and returns each one's aspects, in
// order. Ten at a time, the most the function takes.
import { supabase } from './supabase';
import { shrinkImage } from './imageShrink';

const BATCH = 10;
const SORT_EDGE = 768;
const SENDABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function sortPhotos(files: File[]): Promise<string[][]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const result: string[][] = files.map(() => ['overall']);
  for (let i = 0; i < files.length; i += BATCH) {
    const prepared = await Promise.all(files.slice(i, i + BATCH).map(async (file, j) => {
      const small = await shrinkImage(file, SORT_EDGE, 0.7);
      return { at: i + j, mediaType: small.blob.type, blob: small.blob };
    }));
    // One the browser couldn't turn into a JPEG (HEIC outside Safari) stays
    // under Overall, to be moved by hand.
    const sendable = prepared.filter((p) => SENDABLE.has(p.mediaType));
    if (sendable.length === 0) continue;
    const images = await Promise.all(sendable.map(async (p) => ({ mediaType: p.mediaType, data: await base64(p.blob) })));
    const res = await fetch('/.netlify/functions/sort-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ images }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(json.aspects)) throw new Error(json.error || `Photos not sorted (${res.status})`);
    sendable.forEach((p, k) => { result[p.at] = json.aspects[k]; });
  }
  return result;
}
