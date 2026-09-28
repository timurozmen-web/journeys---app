// Shared SVG layers for the app's maps, so the trip map and the world
// map draw routes, stops and the "real map" backdrop identically.
import { useId } from 'react';
import type { GeoProjection } from 'd3-geo';
import { geoGraticule10, geoPath } from 'd3-geo';
import { MAP } from '../data/mapTheme';
import { dayMonth } from '../lib/format';

export interface DrawnLeg {
  key: string;
  parts: string[];                  // path "d" strings (split at the map edge)
  start: [number, number];
  end: [number, number];
  fromCode: string;
  toCode: string;
  mid: { x: number; y: number; angle: number } | null;
  date: string | null;
  startsJourney: boolean;          // first leg of a flight: draw the origin ring
  endsJourney: boolean;            // last leg: draw the destination dot; otherwise it's a stopover
  index: number;                   // which leg of its flight (the date shows on the first)
}

// Ocean shading, faint latitude/longitude lines and softly lit land.
export function MapBackdrop({ projection, width, height, countries }: {
  projection: GeoProjection; width: number; height: number; countries: { key: string; d: string; fill?: string; stroke?: string; strokeWidth?: number; onClick?: () => void }[];
}) {
  const id = useId().replace(/:/g, '');
  const grat = geoPath(projection)(geoGraticule10()) ?? '';
  return (
    <>
      <defs>
        <radialGradient id={`sea${id}`} cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor={MAP.seaLight} />
          <stop offset="100%" stopColor={MAP.sea} />
        </radialGradient>
        <linearGradient id={`land${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={MAP.landLight} />
          <stop offset="100%" stopColor={MAP.land} />
        </linearGradient>
      </defs>
      <rect x={-width} y={-height} width={width * 3} height={height * 3} fill={`url(#sea${id})`} />
      <path d={grat} fill="none" stroke={MAP.graticule} strokeWidth={0.4} />
      {countries.map((c) => (
        <path
          key={c.key} d={c.d}
          fill={c.fill ?? `url(#land${id})`} stroke={c.stroke ?? MAP.landBorder} strokeWidth={c.strokeWidth ?? 0.5}
          onClick={c.onClick} style={c.onClick ? { cursor: 'pointer' } : undefined}
        />
      ))}
    </>
  );
}

// Nose points along +x, so rotating by the heading angle aims it.
const PLANE = 'M8,0 C8,.9 7,1.2 6,1.2 L2,1.2 L-2,7 L-4,7 L-1.5,1.2 L-5,1.2 L-6.5,3.5 L-8,3.5 L-7,0 L-8,-3.5 L-6.5,-3.5 L-5,-1.2 L-1.5,-1.2 L-4,-7 L-2,-7 L2,-1.2 L6,-1.2 C7,-1.2 8,-.9 8,0 Z';

// Routes: dotted great-circle path, hollow ring at the origin, glowing
// dot at the destination, small white dot at a stopover, airport codes,
// and a plane at the midpoint facing the way it flies (with the date).
// `k` is the current zoom, so marks stay the same size on screen.
export function RouteLayer({ legs, k = 1, showPlanes = true, showDates = true, showCodes = true }: {
  legs: DrawnLeg[]; k?: number; showPlanes?: boolean; showDates?: boolean; showCodes?: boolean;
}) {
  const s = 1 / k;
  const label = (x: number, y: number, text: string, anchor: 'start' | 'end' | 'middle' = 'middle') => (
    <text
      x={x} y={y} textAnchor={anchor} fontSize={7 * s} fontWeight={600} letterSpacing={0.6 * s} fill={MAP.text}
      stroke={MAP.sea} strokeWidth={2.4 * s} paintOrder="stroke" style={{ fontFamily: 'var(--font-body)' }}
    >{text}</text>
  );
  // Each airport is labelled once even when several legs share it, and a
  // label that would sit on top of a nearby one (LGW next to LTN) is
  // lifted above its dot instead.
  const labelled = new Set<string>();
  const placed: [number, number][] = [];
  const labelY = (x: number, y: number) => {
    const below = y + 12 * s;
    const clash = placed.some(([px, py]) => Math.abs(px - x) < 22 * s && Math.abs(py - below) < 9 * s);
    const ly = clash ? y - 7 * s : below;
    placed.push([x, ly]);
    return ly;
  };
  return (
    <g>
      {legs.map((l) => l.parts.map((d, i) => (
        <path key={`${l.key}-${i}`} d={d} fill="none" stroke={MAP.route} strokeWidth={1.3 * s} strokeDasharray={`${1.5 * s} ${3.5 * s}`} strokeLinecap="round" />
      )))}
      {legs.map((l) => (
        <g key={`${l.key}-pts`}>
          {l.startsJourney && <circle cx={l.start[0]} cy={l.start[1]} r={3.4 * s} fill={MAP.sea} stroke={MAP.route} strokeWidth={1.3 * s} />}
          {l.endsJourney ? (
            <>
              <circle cx={l.end[0]} cy={l.end[1]} r={7 * s} fill={MAP.route} opacity={0.18} />
              <circle cx={l.end[0]} cy={l.end[1]} r={3.6 * s} fill={MAP.route} stroke={MAP.stopRing} strokeWidth={1 * s} />
            </>
          ) : (
            <circle cx={l.end[0]} cy={l.end[1]} r={2.6 * s} fill={MAP.home} stroke={MAP.stopRing} strokeWidth={1 * s} />
          )}
        </g>
      ))}
      {showCodes && legs.flatMap((l) => {
        const out = [];
        for (const [code, p] of [[l.fromCode, l.start], [l.toCode, l.end]] as const) {
          if (labelled.has(code)) continue;
          labelled.add(code);
          out.push(<g key={`${l.key}-${code}`}>{label(p[0], labelY(p[0], p[1]), code)}</g>);
        }
        return out;
      })}
      {showPlanes && legs.map((l) => l.mid && (
        <g key={`${l.key}-plane`} transform={`translate(${l.mid.x},${l.mid.y})`}>
          <g transform={`rotate(${l.mid.angle}) scale(${0.95 * s})`}>
            <path d={PLANE} fill={MAP.home} stroke={MAP.sea} strokeWidth={0.8} />
          </g>
          {showDates && l.date && l.index === 0 && (() => {
            const { day, month } = dayMonth(l.date);
            const text = `${day} ${month}`;
            const w = (text.length * 4.6 + 8) * s;
            return (
              <g transform={`translate(0,${-12 * s})`}>
                <rect x={-w / 2} y={-6.5 * s} width={w} height={11 * s} rx={5.5 * s} fill={MAP.panel} stroke={MAP.route} strokeWidth={0.6 * s} />
                <text y={1.6 * s} textAnchor="middle" fontSize={6.6 * s} fontWeight={600} letterSpacing={0.5 * s} fill={MAP.route} style={{ fontFamily: 'var(--font-body)' }}>{text}</text>
              </g>
            );
          })()}
        </g>
      ))}
    </g>
  );
}
