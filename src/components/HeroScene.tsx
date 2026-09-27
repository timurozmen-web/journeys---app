// A trip without a real uploaded photo gets an original gradient scene
// instead of a blank row -- not real destination photography (which would
// mean sourcing copyrighted images), just a way to make the list feel
// alive until a real photo is added via the camera icon on Trip Detail.
const PALETTES = [
  ['#2B3A67', '#F0B27A', '#1D2F4A'], // coastal, golden hour
  ['#1A1F3A', '#C77D5A', '#141522'], // dusk city
  ['#12344A', '#E7B98F', '#0E2A33'], // tropical, sunset
  ['#0F1D3A', '#B88FA8', '#26304A'], // mountains, blue hour
  ['#3A2A3F', '#F0B27A', '#5A3320'], // desert, late sun
  ['#1C2B33', '#D9B77C', '#1E3328'], // forest, dusk
];

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function HeroScene({ seed, height = 120 }: { seed: string; height?: number }) {
  const palette = PALETTES[hashString(seed) % PALETTES.length];
  const gradId = `hs-${hashString(seed)}`;
  return (
    <svg viewBox="0 0 390 120" preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette[0]} />
          <stop offset="100%" stopColor={palette[1]} />
        </linearGradient>
      </defs>
      <rect width="390" height="120" fill={`url(#${gradId})`} />
      <circle cx={70 + (hashString(seed) % 250)} cy="30" r="13" fill="#FFE9C4" opacity="0.9" />
      <path
        d={`M0 84 Q98 ${62 + (hashString(seed) % 20)} 196 84 T390 82 V120 H0Z`}
        fill={palette[2]}
        opacity="0.55"
      />
      <path
        d={`M0 100 Q98 ${84 + (hashString(seed) % 15)} 196 100 T390 98 V120 H0Z`}
        fill={palette[2]}
        opacity="0.75"
      />
    </svg>
  );
}
