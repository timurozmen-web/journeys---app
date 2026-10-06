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

// Paper, faint latitude/longitude lines and land drawn like a pencil
// sketch: a sand fill, light hatching and a second, offset outline so the
// coast looks gone over twice by hand.
export function MapBackdrop({ projection, width, height, countries }: {
  projection: GeoProjection; width: number; height: number; countries: { key: string; d: string; fill?: string; stroke?: string; strokeWidth?: number; onClick?: () => void }[];
}) {
  const id = useId().replace(/:/g, '');
  const grat = geoPath(projection)(geoGraticule10()) ?? '';
  return (
    <>
      <defs>
        <pattern id={`hatch${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={MAP.hatch} strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={-width} y={-height} width={width * 3} height={height * 3} fill={MAP.sea} />
      <path d={grat} fill="none" stroke={MAP.graticule} strokeWidth={0.4} />
      {countries.map((c) => (
        <path
          key={c.key} d={c.d}
          fill={c.fill ?? MAP.land} stroke={c.stroke ?? MAP.landBorder} strokeWidth={c.strokeWidth ?? 0.6} strokeOpacity={c.stroke ? 1 : 0.7} strokeLinejoin="round"
          onClick={c.onClick} style={c.onClick ? { cursor: 'pointer' } : undefined}
        />
      ))}
      <g transform="translate(1.1 0.9)" pointerEvents="none">
        {countries.map((c) => (
          <path key={`${c.key}-sketch`} d={c.d} fill={`url(#hatch${id})`} stroke={MAP.landBorder} strokeOpacity={0.28} strokeWidth={0.5} />
        ))}
      </g>
    </>
  );
}

// Nose points along +x, so rotating by the heading angle aims it.
const PLANE = 'M8,0 C8,.9 7,1.2 6,1.2 L2,1.2 L-2,7 L-4,7 L-1.5,1.2 L-5,1.2 L-6.5,3.5 L-8,3.5 L-7,0 L-8,-3.5 L-6.5,-3.5 L-5,-1.2 L-1.5,-1.2 L-4,-7 L-2,-7 L2,-1.2 L6,-1.2 C7,-1.2 8,-.9 8,0 Z';

// Routes: orange dashed great-circle path, hollow ring at the origin,
// orange dot at the destination, small ink dot at a stopover, typewriter
// airport codes, and a plane at the midpoint facing the way it flies
// (with the date).
// `k` is the current zoom, so marks stay the same size on screen.
export function RouteLayer({ legs, k = 1, showPlanes = true, showDates = true, showCodes = true }: {
  legs: DrawnLeg[]; k?: number; showPlanes?: boolean; showDates?: boolean; showCodes?: boolean;
}) {
  const s = 1 / k;
  const label = (x: number, y: number, text: string, anchor: 'start' | 'end' | 'middle' = 'middle') => (
    <text
      x={x} y={y} textAnchor={anchor} fontSize={7.5 * s} fontWeight={700} letterSpacing={0.2 * s} fill={MAP.text}
      stroke={MAP.sea} strokeWidth={2.6 * s} paintOrder="stroke" style={{ fontFamily: MAP.font }}
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
        <path key={`${l.key}-${i}`} d={d} fill="none" stroke={MAP.route} strokeWidth={1.6 * s} strokeDasharray={`${4.5 * s} ${3.5 * s}`} strokeLinecap="round" />
      )))}
      {legs.map((l) => (
        <g key={`${l.key}-pts`}>
          {l.startsJourney && <circle cx={l.start[0]} cy={l.start[1]} r={3.4 * s} fill={MAP.sea} stroke={MAP.route} strokeWidth={1.3 * s} />}
          {l.endsJourney ? (
            <>
              <circle cx={l.end[0]} cy={l.end[1]} r={7 * s} fill={MAP.route} opacity={0.15} />
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
                <rect x={-w / 2} y={-6.5 * s} width={w} height={11 * s} rx={2 * s} fill={MAP.panel} stroke={MAP.text} strokeWidth={0.6 * s} transform="rotate(-3)" />
                <text y={1.6 * s} textAnchor="middle" fontSize={6.4 * s} fontWeight={700} fill={MAP.text} transform="rotate(-3)" style={{ fontFamily: MAP.font }}>{text}</text>
              </g>
            );
          })()}
        </g>
      ))}
    </g>
  );
}
