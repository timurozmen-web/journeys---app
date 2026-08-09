import { useEffect, useState } from 'react';
import { getDestinationPhoto, type UnsplashPhoto } from '../lib/unsplash';
import { HeroScene } from './HeroScene';

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

  if (photo === 'loading' || photo === null) {
    return <HeroScene seed={seed} height={height} />;
  }

  return (
    <div style={{ position: 'relative', height }}>
      <img src={photo.url} alt={query} style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
      <a
        href={photo.photographerUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', right: 6, bottom: 4, fontSize: 8.5, color: 'rgba(255,255,255,.85)',
          textShadow: '0 1px 3px rgba(0,0,0,.6)', textDecoration: 'none',
        }}
      >
        {photo.photographerName} / Unsplash
      </a>
    </div>
  );
}
