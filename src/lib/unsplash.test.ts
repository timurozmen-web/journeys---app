import { describe, expect, it } from 'vitest';
import { pickPlacePhoto } from './unsplash';

const photo = (alt: string, tags: string[] = []) => ({
  alt_description: alt, description: null, tags: tags.map((title) => ({ title })),
  urls: { regular: alt }, user: { name: 'x', links: { html: 'x' } }, links: { download_location: 'x' },
});

describe('pickPlacePhoto', () => {
  it('skips photos of people for the first one of the place itself', () => {
    const picked = pickPlacePhoto([
      photo('a group of people standing on top of a beach'),
      photo('a woman in a hat on a pier'),
      photo('turquoise water and a white sand beach with palm trees'),
    ]);
    expect(picked?.alt_description).toBe('turquoise water and a white sand beach with palm trees');
  });

  it('reads the tags too', () => {
    expect(pickPlacePhoto([photo('a beach at sunset', ['couple']), photo('a lighthouse by the sea')])?.alt_description).toBe('a lighthouse by the sea');
  });

  it('gives no photo rather than one of strangers', () => {
    expect(pickPlacePhoto([photo('a man surfing a wave')])).toBeNull();
  });
});
