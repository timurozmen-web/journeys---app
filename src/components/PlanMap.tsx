import { useMemo } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { worldGeo } from '../data/worldGeo';
import type { PlanningAirport } from '../data/planningAirports';
import type { TransportMode } from '../lib/tripPlanner';

const WIDTH = 360;
const HEIGHT = 320;
const PAD = 34;

interface PlanCity {
  city: string;
  lat: number;
  lng: number;
}
interface MapLegInfo {
  mode: TransportMode;
  distanceKm: number;
  hours: number;
}

// Small SVG-native icon paths, scaled to sit inside an 12x12 badge slot.
// Kept as plain paths (not the app's icon components) since these render
// inside an SVG document, not the HTML tree.
const MODE_ICON_PATH: Record<TransportMode, string> = {
  flight: 'M1 6h3l2-3.5 1 .5-1 3h2.5l1-1.5h1l-.75 2L11 8h-1l-1-1.5H6.5l1 3-1 .5-2-3.5H1z',
  rail: 'M2.5 1.5h7v7a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 2.5 8.5zM2.5 6.5h7M4 10l-1 2M8 10l1 2',
  road: 'M2 9V6.5l1-2.5h6l1 2.5V9M2 9h8M2.7 9v1M9.3 9v1',
};

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins === 0 ? `${hours}h` : `${hours}h${mins}m`;
}

function LegBadge({ x, y, info }: { x: number; y: number; info: MapLegInfo }) {
  const label = `${Math.round(info.distanceKm)}km · ${formatHours(info.hours)}`;
  const badgeWidth = 15 + label.length * 3.6;
  return (
    <g transform={`translate(${x - badgeWidth / 2}, ${y - 8})`}>
      <rect width={badgeWidth} height={16} rx={8} fill="#fff" stroke="#5B3FA6" strokeWidth={1} />
      <g transform="translate(4, 3)" fill="none" stroke="#5B3FA6" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round">
        <path d={MODE_ICON_PATH[info.mode]} />
      </g>
      <text x={16} y={11} fontSize={6.2} fontWeight={700} fill="#17171C">
        {label}
      </text>
    </g>
  );
}

export function PlanMap({
  home, cities, domesticLegs, internationalLeg, onCityTap,
}: {
  home: PlanningAirport | null;
  cities: PlanCity[];
  domesticLegs: MapLegInfo[]; // one per consecutive city pair, same order as cities
  internationalLeg: MapLegInfo | null; // home -> first city
  onCityTap?: (index: number) => void;
}) {
  const { countryPaths, homePoint, cityPoints, internationalPath, domesticSegments } = useMemo(() => {
    const points: [number, number][] = cities.map((c) => [c.lng, c.lat]);
    if (home) points.push([home.lng, home.lat]);
    if (points.length === 0) {
      return { countryPaths: [], homePoint: null, cityPoints: [], internationalPath: '', domesticSegments: [] };
    }

    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const degenerate = Math.max(...lngs) - Math.min(...lngs) < 0.05 && Math.max(...lats) - Math.min(...lats) < 0.05;

    const projection = geoNaturalEarth1();
    if (degenerate) {
      projection.center([lngs[0], lats[0]]).scale(2400).translate([WIDTH / 2, HEIGHT / 2]);
    } else {
      projection.fitExtent([[PAD, PAD], [WIDTH - PAD, HEIGHT - PAD]], { type: 'MultiPoint', coordinates: points });
    }
    const pathGen = geoPath(projection);
    const project = (lat: number, lng: number) => projection([lng, lat]) as [number, number] | null;

    const countryPaths: { name: string; d: string }[] = worldGeo.features
      .map((f: any) => ({ name: f.properties.name as string, d: pathGen(f) || '' }))
      .filter((c: { d: string }) => c.d);

    const projectedCities = cities
      .map((c) => {
        const p = project(c.lat, c.lng);
        return p ? { city: c.city, x: p[0], y: p[1] } : null;
      })
      .filter((c): c is { city: string; x: number; y: number } => c !== null);

    const homeProjected = home ? project(home.lat, home.lng) : null;

    let internationalPath = '';
    let internationalMid: { x: number; y: number } | null = null;
    if (homeProjected && projectedCities.length > 0) {
      const [x1, y1] = homeProjected;
      const { x: x2, y: y2 } = projectedCities[0];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - Math.min(40, Math.hypot(x2 - x1, y2 - y1) * 0.2);
      internationalPath = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
      internationalMid = { x: mx, y: my };
    }

    // Each domestic segment kept separate (not one combined path) so a
    // badge can be placed at each individual leg's own midpoint.
    const domesticSegments = projectedCities.slice(0, -1).map((c, i) => {
      const next = projectedCities[i + 1];
      return { d: `M${c.x},${c.y} L${next.x},${next.y}`, mid: { x: (c.x + next.x) / 2, y: (c.y + next.y) / 2 } };
    });

    return { countryPaths, homePoint: homeProjected ? { x: homeProjected[0], y: homeProjected[1] } : null, cityPoints: projectedCities, internationalPath, domesticSegments, internationalMid };
  }, [home, cities]);

  if (cityPoints.length === 0) return null;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#DCE7F5', borderRadius: 16 }}>
      {countryPaths.map((c) => (
        <path key={c.name} d={c.d} fill="#B9CEEC" stroke="#DCE7F5" strokeWidth={0.5} />
      ))}
      {internationalPath && (
        <path d={internationalPath} fill="none" stroke="#5B3FA6" strokeWidth={1.2} strokeDasharray="3 2.2" opacity={0.8} />
      )}
      {domesticSegments.map((seg, i) => (
        <path key={i} d={seg.d} fill="none" stroke="#5B3FA6" strokeWidth={1.4} strokeDasharray="3 2.2" opacity={0.85} />
      ))}
      {homePoint && (
        <circle cx={homePoint.x} cy={homePoint.y} r={3.4} fill="#fff" stroke="#5B3FA6" strokeWidth={1.6} />
      )}
      {cityPoints.map((c, i) => (
        <g key={c.city} onClick={() => onCityTap?.(i)} style={{ cursor: onCityTap ? 'pointer' : 'default' }}>
          <circle cx={c.x} cy={c.y} r={9} fill="transparent" />
          <circle cx={c.x} cy={c.y} r={4.2} fill="#5B3FA6" stroke="#fff" strokeWidth={1.3} />
          <text x={c.x} y={c.y + 1.5} fontSize={5.5} fontWeight={800} fill="#fff" textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
      {internationalLeg && homePoint && cityPoints[0] && (
        <LegBadge
          x={(homePoint.x + cityPoints[0].x) / 2}
          y={(homePoint.y + cityPoints[0].y) / 2 - Math.min(40, Math.hypot(cityPoints[0].x - homePoint.x, cityPoints[0].y - homePoint.y) * 0.2)}
          info={internationalLeg}
        />
      )}
      {domesticSegments.map((seg, i) =>
        domesticLegs[i] ? <LegBadge key={`badge-${i}`} x={seg.mid.x} y={seg.mid.y} info={domesticLegs[i]} /> : null
      )}
    </svg>
  );
}
