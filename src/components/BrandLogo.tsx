import { BrandMark } from './BrandMark';

// Maps a loyalty programme's exact name to its real logo asset.
// Add an entry here once a verified logo/icon is available for that
// programme -- everything else automatically falls back to the
// abstract BrandMark shape until then.
export const BRAND_LOGOS: Record<string, string> = {
  'Accor ALL': '/brand-logos/accor.jpg',
  'Marriott Bonvoy': '/brand-logos/marriott.png',
  'Qantas Points': '/brand-logos/qantas.png',
  'Singapore KrisFlyer': '/brand-logos/singapore-airlines.png',
  'Virgin Points': '/brand-logos/virgin-atlantic.png',
  'Expedia One Key Cash': '/brand-logos/expedia.png',
};

export function BrandLogo({
  name, shape, color, accent, size = 38,
}: {
  name: string; shape?: string; color?: string; accent?: string; size?: number;
}) {
  const logoUrl = BRAND_LOGOS[name];

  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: color || '#5B3FA6', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        shape && <BrandMark shape={shape} color={accent || '#fff'} size={Math.round(size * 0.47)} />
      )}
    </div>
  );
}
