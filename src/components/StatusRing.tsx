import type { ReactNode } from 'react';

// A ring of ticks, one per unit of progress (see lib/statusRing). Filled
// ticks take their segment's colour and run longer; empty ones are short
// and faint. Whatever is passed as children sits in the middle.
export function StatusRing({ ticks, size, label, children }: {
  ticks: ({ colour: string } | null)[]; size: number; label: string; children?: ReactNode;
}) {
  const c = size / 2;
  const outer = c - 2;
  const inner = c - size * 0.11;
  const heavy = size > 80;
  return (
    <div className="statusring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        {ticks.map((t, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / ticks.length;
          const r1 = t ? inner : inner + size * 0.035;
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * r1} y1={c + Math.sin(a) * r1} x2={c + Math.cos(a) * outer} y2={c + Math.sin(a) * outer}
              strokeWidth={heavy ? 3 : 2.2} strokeLinecap="round"
              style={{ stroke: t ? t.colour : 'var(--ink)', strokeOpacity: t ? 1 : 0.13 }}
            />
          );
        })}
      </svg>
      {children && <div className="statusring-c">{children}</div>}
    </div>
  );
}
