import { BrandMark } from './BrandMark';

interface LogoEntry {
  url: string;
  aspect: 'square' | 'wide'; // wide = real wordmark, given more horizontal room instead of a cramped square crop
}

// Maps a loyalty programme's exact name to its real logo asset.
// Add an entry here once a verified logo/icon is available for that
// programme -- everything else automatically falls back to the
// abstract BrandMark shape until then.
export const BRAND_LOGOS: Record<string, LogoEntry> = {
  'Accor ALL': { url: '/brand-logos/accor.jpg', aspect: 'square' },
  'Marriott Bonvoy': { url: '/brand-logos/marriott-wordmark.png', aspect: 'wide' },
  'Qantas Points': { url: '/brand-logos/qantas.png', aspect: 'square' },
  'Singapore KrisFlyer': { url: '/brand-logos/singapore-airlines.png', aspect: 'square' },
  'Virgin Points': { url: '/brand-logos/virgin-atlantic.png', aspect: 'square' },
  'Expedia One Key Cash': { url: '/brand-logos/expedia.png', aspect: 'square' },
  'Hilton Honors': { url: '/brand-logos/hilton.png', aspect: 'wide' },
  'IHG One Rewards': { url: '/brand-logos/ihg.png', aspect: 'wide' },
  'World of Hyatt': { url: '/brand-logos/hyatt.png', aspect: 'wide' },
};

export function hasWordmarkLogo(name: string): boolean {
  return BRAND_LOGOS[name]?.aspect === 'wide';
}

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
        width, height: size, borderRadius: 10, background: color || '#5B3FA6',
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
