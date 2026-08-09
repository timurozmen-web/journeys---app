// Original, generic marks per programme — shape + colour + brand-typeface
// do the work of telling cards apart, without tracing any brand's actual
// trademarked logo geometry.
import type { CSSProperties } from 'react';

const paths: Record<string, string> = {
  crown: 'M4 17h16l-1.4-7.5L15 13l-3-6-3 6-3.6-3.5z M4 19.5h16',
  shield: 'M12 3.5 19 6v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4',
  orbit: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  wing: 'M3 15c4-1 7-4 8-10 1 6 4 9 8 10-4 2-6 1.5-8-1-2 2.5-4 3-8 1z',
  gem: 'M6 4h12l3 5-9 11L3 9z M3 9h18M9 4l-1.5 5L12 20l4.5-11L15 4',
  compass: 'M12 12m-8.5 0a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0 M14.8 9.2 13 13l-3.8 1.8L11 11z',
  arrowUp: 'M12 19V6M6 11l6-6 6 6',
  bird: 'M2 14c3 1 5 0 6.5-2 1.5 2 3.5 3 6.5 2 3-1 5.5-3 7-6-3 .5-5 2-6.5 4-1-2.5-2.5-4-4.5-4.5-2 .5-3.5 2-4.5 4.5C5 10 3 8.5 0 8c1.5 3 4 5 7 6',
  starCompass: 'M12 2.5 14 10l7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z',
};

export function BrandMark({ shape, color, size = 20, style }: { shape: string; color: string; size?: number; style?: CSSProperties }) {
  const d = paths[shape];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" style={style}>
      <path d={d} />
    </svg>
  );
}
