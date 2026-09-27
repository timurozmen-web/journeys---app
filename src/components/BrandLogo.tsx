import { BrandMark } from './BrandMark';
import { BRAND_LOGOS } from '../data/brandLogos';

export function BrandLogo({
  name, shape, color, accent, size = 38,
}: {
  name: string; shape?: string; color?: string; accent?: string; size?: number;
}) {
  const logo = BRAND_LOGOS[name];
  const width = logo?.aspect === 'wide' ? Math.round(size * 2.2) : size;

  return (
    <div
      style={{
        width, height: size, borderRadius: 10, background: color || '#1E3A8F',
        display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
        border: logo?.aspect === 'wide' ? '1px solid var(--line)' : undefined,
      }}
    >
      {logo ? (
        <img
          src={logo.url}
          alt={`${name} logo`}
          style={{
            width: '100%', height: '100%', display: 'block',
            objectFit: logo.aspect === 'wide' ? 'contain' : 'cover',
            padding: logo.aspect === 'wide' ? '6px 8px' : 0, boxSizing: 'border-box',
            background: logo.aspect === 'wide' ? '#fff' : 'transparent',
          }}
        />
      ) : (
        shape && <BrandMark shape={shape} color={accent || '#fff'} size={Math.round(size * 0.47)} />
      )}
    </div>
  );
}
