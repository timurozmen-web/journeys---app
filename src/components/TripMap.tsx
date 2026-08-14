import { useMemo } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { worldGeo } from '../data/worldGeo';
import { AIRPORTS } from '../data/airports';
import type { Hotel, Flight } from '../types';

const WIDTH = 360;
const HEIGHT = 220;
const PAD = 28; // leaves breathing room so points/routes aren't flush against the edge

const geo = worldGeo;

export function TripMap({ hotels, flights }: { hotels: Hotel[]; flights: Flight[] }) {
  const points = useMemo(() => {
    const pts: [number, number][] = [];
    for (const h of hotels) {
      if (h.lat != null && h.lng != null) pts.push([h.lng, h.lat]);
    }
    for (const f of flights) {
      const a = AIRPORTS[f.from];
      const b = AIRPORTS[f.to];
      if (a) pts.push([a.lng, a.lat]);
      if (b) pts.push([b.lng, b.lat]);
    }
    return pts;
  }, [hotels, flights]);

  const { countryPaths, routeLines, markers } = useMemo(() => {
    if (points.length === 0) return { countryPaths: [], routeLines: [], markers: [] };

    const lngs = points.map((pt) => pt[0]);
    const lats = points.map((pt) => pt[1]);
    const spanLng = Math.max(...lngs) - Math.min(...lngs);
    const spanLat = Math.max(...lats) - Math.min(...lats);
    // A single point, or points clustered in the same city, gives
    // fitExtent nothing meaningful to scale to -- it silently produces a
    // degenerate (zero/infinite scale) projection rather than an error.
    // Fall back to a fixed, reasonable "city level" zoom centered on the
    // average point instead.
    const isDegenerate = spanLng < 0.05 && spanLat < 0.05;

    const projection = geoNaturalEarth1();
    if (isDegenerate) {
      const centerLng = lngs.reduce((s, v) => s + v, 0) / lngs.length;
      const centerLat = lats.reduce((s, v) => s + v, 0) / lats.length;
      projection.center([centerLng, centerLat]).scale(2400).translate([WIDTH / 2, HEIGHT / 2]);
    } else {
      projection.fitExtent([[PAD, PAD], [WIDTH - PAD, HEIGHT - PAD]], { type: 'MultiPoint', coordinates: points });
    }
    const pathGen = geoPath(projection);
    const project = (lat: number, lng: number): [number, number] | null => projection([lng, lat]) as [number, number] | null;

    const countryPaths: { name: string; d: string }[] = geo.features
      .map((f: any) => ({ name: f.properties.name as string, d: pathGen(f) || '' }))
      .filter((c: { d: string }) => c.d);

    const routeLines: { d: string; key: string }[] = [];
    for (const f of flights) {
      const a = AIRPORTS[f.from];
      const b = AIRPORTS[f.to];
      if (!a || !b) continue;
      const p1 = project(a.lat, a.lng);
      const p2 = project(b.lat, b.lng);
      if (!p1 || !p2) continue;
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2 - Math.min(30, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.18);
      routeLines.push({ d: `M${p1[0]},${p1[1]} Q${mx},${my} ${p2[0]},${p2[1]}`, key: f.id });
    }

    const markers: { x: number; y: number; label: string }[] = [];
    for (const h of hotels) {
      if (h.lat == null || h.lng == null) continue;
      const p = project(h.lat, h.lng);
      if (p) markers.push({ x: p[0], y: p[1], label: h.city ?? h.name });
    }

    return { countryPaths, routeLines, markers };
  }, [points, flights, hotels]);

  if (points.length === 0) return null;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#DCE7F5', borderRadius: 16 }}>
      {countryPaths.map((c) => (
        <path key={c.name} d={c.d} fill="#B9CEEC" stroke="#DCE7F5" strokeWidth={0.5} />
      ))}
      {routeLines.map((r) => (
        <path key={r.key} d={r.d} fill="none" stroke="#5B3FA6" strokeWidth={1.1} strokeDasharray="3 2.2" opacity={0.85} />
      ))}
      {markers.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r={3.2} fill="#5B3FA6" stroke="#fff" strokeWidth={1} />
        </g>
      ))}
    </svg>
  );
}
