import { useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { worldGeo } from '../data/worldGeo';
import { AIRPORTS, COUNTRY_NAME_MAP } from '../data/airports';
import type { Hotel, Flight } from '../types';

const WIDTH = 360;
const HEIGHT = 200;

// Real country boundaries + projection math, computed once (doesn't depend
// on live data, so no reason to recompute on every render).
const geo = worldGeo;
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], geo);
const pathGen = geoPath(projection);
const countryPaths: { name: string; d: string }[] = geo.features
  .map((f: any) => ({ name: f.properties.name as string, d: pathGen(f) || '' }))
  .filter((c: { d: string }) => c.d);

function normalizeCountry(c: string) {
  return COUNTRY_NAME_MAP[c] ?? c;
}
function project(lat: number, lng: number): [number, number] | null {
  const p = projection([lng, lat]);
  return p as [number, number] | null;
}

export function WorldMap({ hotels, flights }: { hotels: Hotel[]; flights: Flight[] }) {
  const [showRoutes, setShowRoutes] = useState(false);
  const [year, setYear] = useState<'all' | number>('all');

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const h of hotels) if (h.date) set.add(Number(h.date.slice(0, 4)));
    for (const f of flights) if (f.date) set.add(Number(f.date.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [hotels, flights]);

  const nightsByCountry = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hotels) {
      if (!h.date || !h.country) continue;
      if (year !== 'all' && Number(h.date.slice(0, 4)) !== year) continue;
      const key = normalizeCountry(h.country.trim());
      m.set(key, (m.get(key) ?? 0) + (h.nights || 1));
    }
    return m;
  }, [hotels, year]);

  const maxNights = Math.max(1, ...nightsByCountry.values());

  const routeLines = useMemo(() => {
    const lines: { d: string; key: string }[] = [];
    for (const f of flights) {
      if (!f.date) continue;
      if (year !== 'all' && Number(f.date.slice(0, 4)) !== year) continue;
      const a = AIRPORTS[f.from];
      const b = AIRPORTS[f.to];
      if (!a || !b) continue;
      const p1 = project(a.lat, a.lng);
      const p2 = project(b.lat, b.lng);
      if (!p1 || !p2) continue;
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2 - Math.min(30, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.15);
      lines.push({ d: `M${p1[0]},${p1[1]} Q${mx},${my} ${p2[0]},${p2[1]}`, key: `${f.id}` });
    }
    return lines;
  }, [flights, year]);

  const airportDots = useMemo(() => {
    const used = new Set<string>();
    for (const f of flights) {
      if (!f.date) continue;
      if (year !== 'all' && Number(f.date.slice(0, 4)) !== year) continue;
      used.add(f.from);
      used.add(f.to);
    }
    const dots: { x: number; y: number; code: string }[] = [];
    for (const code of used) {
      const a = AIRPORTS[code];
      if (!a) continue;
      const p = project(a.lat, a.lng);
      if (p) dots.push({ x: p[0], y: p[1], code });
    }
    return dots;
  }, [flights, year]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px', alignItems: 'center' }}>
        <button
          onClick={() => setShowRoutes((v) => !v)}
          style={{
            padding: '6px 12px', borderRadius: 99, border: '1px solid var(--line)',
            background: showRoutes ? 'var(--brand)' : 'var(--card2)', color: showRoutes ? '#fff' : 'var(--ink2)',
            fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Routes
        </button>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          <button
            onClick={() => setYear('all')}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 99, border: '1px solid var(--line)',
              background: year === 'all' ? 'var(--brand)' : 'var(--card2)', color: year === 'all' ? '#fff' : 'var(--ink2)',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            All
          </button>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 99, border: '1px solid var(--line)',
                background: year === y ? 'var(--brand)' : 'var(--card2)', color: year === y ? '#fff' : 'var(--ink2)',
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#DCE7F5' }}>
        {countryPaths.map((c) => {
          const nights = nightsByCountry.get(c.name);
          const fill = nights ? shadeFor(nights, maxNights) : '#B9CEEC';
          return <path key={c.name} d={c.d} fill={fill} stroke="#DCE7F5" strokeWidth={0.4} />;
        })}
        {showRoutes &&
          routeLines.map((r) => (
            <path key={r.key} d={r.d} fill="none" stroke="#5B3FA6" strokeWidth={0.7} strokeDasharray="2 1.5" opacity={0.75} />
          ))}
        {showRoutes &&
          airportDots.map((a) => <circle key={a.code} cx={a.x} cy={a.y} r={1.6} fill="#5B3FA6" stroke="#fff" strokeWidth={0.5} />)}
      </svg>
    </div>
  );
}

function shadeFor(nights: number, max: number) {
  const t = Math.min(1, nights / max);
  const shades = ['#8797BC', '#5F71A0', '#8560D6', '#5B3FA6'];
  const idx = Math.min(shades.length - 1, Math.floor(t * shades.length));
  return shades[idx];
}
