import { BrandMark } from './BrandMark';

// Maps a loyalty programme's exact name to its real logo asset.
// Add an entry here once a verified logo/icon is available for that
// programme -- everything else automatically falls back to the
// abstract BrandMark shape until then.
export const BRAND_LOGOS: Record<string, string> = {
  'Accor ALL': '/brand-logos/accor.jpg',
};

export function BrandLogo({
  name, shape, color, accent, size = 38,
}: {
  name: string; shape?: string; color?: string; accent?: string; size?: number;
}) {
  const logoUrl = BRAND_LOGOS[name];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0, display: 'block' }}
      />
    );
  }

  return (
    <div style={{ width: size, height: size, borderRadius: 10, background: color || '#5B3FA6', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      {shape && <BrandMark shape={shape} color={accent || '#fff'} size={Math.round(size * 0.47)} />}
    </div>
  );
}
