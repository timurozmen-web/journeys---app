import { useMemo } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { worldGeo } from '../data/worldGeo';
import type { PlanningAirport } from '../data/planningAirports';

const WIDTH = 360;
const HEIGHT = 240;
const PAD = 30;

interface PlanCity {
  city: string;
  lat: number;
  lng: number;
}

export function PlanMap({ home, cities }: { home: PlanningAirport | null; cities: PlanCity[] }) {
  const { countryPaths, homePoint, cityPoints, internationalPath, domesticPath } = useMemo(() => {
    const points: [number, number][] = cities.map((c) => [c.lng, c.lat]);
    if (home) points.push([home.lng, home.lat]);
    if (points.length === 0) {
      return { countryPaths: [], homePoint: null, cityPoints: [], internationalPath: '', domesticPath: '' };
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

    // International leg drawn as a curve, so it reads as a flight rather
    // than being confused with the domestic ground legs.
    let internationalPath = '';
    if (homeProjected && projectedCities.length > 0) {
      const [x1, y1] = homeProjected;
      const { x: x2, y: y2 } = projectedCities[0];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - Math.min(40, Math.hypot(x2 - x1, y2 - y1) * 0.2);
      internationalPath = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
    }

    const domesticPath = projectedCities.length > 1
      ? projectedCities.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
      : '';

    return {
      countryPaths,
      homePoint: homeProjected ? { x: homeProjected[0], y: homeProjected[1] } : null,
      cityPoints: projectedCities,
      internationalPath,
      domesticPath,
    };
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
      {domesticPath && (
        <path d={domesticPath} fill="none" stroke="#5B3FA6" strokeWidth={1.6} opacity={0.9} />
      )}
      {homePoint && (
        <circle cx={homePoint.x} cy={homePoint.y} r={3.4} fill="#fff" stroke="#5B3FA6" strokeWidth={1.6} />
      )}
      {cityPoints.map((c, i) => (
        <g key={c.city}>
          <circle cx={c.x} cy={c.y} r={3.6} fill="#5B3FA6" stroke="#fff" strokeWidth={1.2} />
          <text x={c.x} y={c.y - 7} fontSize={7.5} fontWeight={700} fill="#17171C" textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
