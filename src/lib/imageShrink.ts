// Phone photos are 3-5MB at 4,000px or more across; a review photo is
// looked at on a phone screen, so it's stored at most 1,600px on its long
// side, which comes to a few hundred KB.
export const MAX_EDGE = 1600;
const QUALITY = 0.82;

// The size to draw a w x h image at so its long side is at most `max`,
// never enlarging a small one.
export function fitWithin(w: number, h: number, max = MAX_EDGE): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

// A JPEG of the photo at fitWithin's size. createImageBitmap applies the
// photo's own rotation (a portrait shot otherwise lands on its side); a
// file the browser can't decode (HEIC outside Safari) goes up as it is.
export async function shrinkImage(file: File): Promise<{ blob: Blob; ext: string }> {
  const original = { blob: file as Blob, ext: (file.name.split('.').pop() || 'jpg').toLowerCase() };
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return original;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, size.w, size.h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    // Already small and compressed: the re-encode can come out bigger.
    if (!blob || blob.size >= file.size) return original;
    return { blob, ext: 'jpg' };
  } catch {
    return original;
  }
}
