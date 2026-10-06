import { useEffect, useState } from 'react';
import { getDestinationPhoto, type UnsplashPhoto } from '../lib/unsplash';
import { HeroScene } from './HeroScene';

const MIN_PHOTO_HEIGHT = 90;

export function DestinationPhoto({ query, seed, height }: { query: string; seed: string; height: number }) {
  const [photo, setPhoto] = useState<UnsplashPhoto | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    setPhoto('loading');
    getDestinationPhoto(query).then((p) => {
      if (!cancelled) setPhoto(p);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Small thumbnails get the drawn scene rather than a photo: the
  // photographer credit a photo needs covered most of a 44px thumbnail.
  if (photo === 'loading' || photo === null || height < MIN_PHOTO_HEIGHT) {
    return <HeroScene seed={seed} height={height} />;
  }

  return (
    <div style={{ position: 'relative', height }}>
      <img src={photo.url} alt={query} style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
      <a
        href={photo.photographerUrl} onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', right: 6, bottom: 3, fontSize: 'calc(var(--fs-micro) * .8)', color: 'var(--on-dark2)',
          opacity: 0.75, textShadow: '0 1px 3px rgba(0,0,0,.6)', textDecoration: 'none', lineHeight: 1,
        }}
      >
        {photo.photographerName} / Unsplash
      </a>
    </div>
  );
}
