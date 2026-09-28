// Route geometry shared by every map: which airports a flight really
// touches (including stopovers), the true great-circle path between
// them, and where to put the plane icon and which way it should face.
import { geoInterpolate } from 'd3-geo';
import { AIRPORTS } from '../data/airports';
import type { GlobalAirport } from '../data/globalAirportsLoader';
import type { Flight } from '../types';

export interface AirportPoint { code: string; lat: number; lng: number; name: string }

// The curated table covers the airports in logged flights; the global
// list (3,000+ airports, loaded on demand) catches everything else, so a
// route is never silently dropped just because its airport is rare.
export function lookupAirport(code: string, global?: Map<string, GlobalAirport> | null): AirportPoint | null {
  const c = code.trim().toUpperCase();
  const curated = AIRPORTS[c];
  if (curated) return { code: c, lat: curated.lat, lng: curated.lng, name: curated.name };
  const g = global?.get(c);
  return g ? { code: c, lat: g.lat, lng: g.lng, name: g.name } : null;
}

export interface Leg { from: AirportPoint; to: AirportPoint; flightId: string; date: string | null; index: number; of: number }

// A flight is one or more legs: LHR -> DOH -> BKK on Qatar is two, with
// Doha as a real stop. Legs whose airports can't be located are skipped
// individually rather than losing the whole flight.
export function flightLegs(f: Pick<Flight, 'id' | 'from' | 'to' | 'via' | 'date'>, global?: Map<string, GlobalAirport> | null): Leg[] {
  const codes = [f.from, ...(f.via ?? []), f.to].map((c) => c.trim().toUpperCase()).filter(Boolean);
  const out: Leg[] = [];
  for (let i = 0; i < codes.length - 1; i++) {
    const from = lookupAirport(codes[i], global);
    const to = lookupAirport(codes[i + 1], global);
    if (from && to) out.push({ from, to, flightId: f.id, date: f.date, index: i, of: codes.length - 1 });
  }
  return out;
}

// Points along the shortest path over the globe, as [lng, lat] -- the
// line an actual flight follows, which bows toward the pole on a flat
// map rather than being a hand-drawn curve.
export function greatCircle(a: { lat: number; lng: number }, b: { lat: number; lng: number }, samples = 48): [number, number][] {
  const interp = geoInterpolate([a.lng, a.lat], [b.lng, b.lat]);
  return Array.from({ length: samples + 1 }, (_, i) => interp(i / samples) as [number, number]);
}

// The point a given fraction of the way along a polyline (by length,
// not by vertex count; halfway by default), and the direction of travel
// there in degrees (0 = east, 90 = south in screen coordinates) -- used
// to place and rotate the plane icon.
export function midpointAndHeading(pts: [number, number][], fraction = 0.5): { x: number; y: number; angle: number } | null {
  if (pts.length < 2) return null;
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  if (total === 0) return { x: pts[0][0], y: pts[0][1], angle: 0 };
  let target = total * Math.max(0, Math.min(1, fraction));
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const t = seg[i] === 0 ? 0 : target / seg[i];
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI };
    }
    target -= seg[i];
  }
  return null;
}

// Splits a projected path wherever it jumps across the map's edge (a
// route over the Pacific on a Europe-centred map), so it isn't drawn as
// a line straight back across the whole world.
export function splitAtAntimeridian(pts: [number, number][], width: number): [number, number][][] {
  const parts: [number, number][][] = [[]];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && Math.abs(pts[i][0] - pts[i - 1][0]) > width / 2) parts.push([]);
    parts[parts.length - 1].push(pts[i]);
  }
  return parts.filter((p) => p.length > 1);
}

export function toPathD(pts: [number, number][]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

export const PLANE_AT = 0.42;

// Legs projected onto a map, ready to draw: the great-circle path (split
// if it crosses the map's edge), end points, and the plane's position
// and heading halfway along.
export function projectLegs(
  legs: Leg[], project: (lng: number, lat: number) => [number, number] | null, width: number,
): {
  key: string; parts: string[]; start: [number, number]; end: [number, number]; fromCode: string; toCode: string;
  mid: { x: number; y: number; angle: number } | null; date: string | null; startsJourney: boolean; endsJourney: boolean; index: number;
}[] {
  const out = [];
  for (const l of legs) {
    const pts = greatCircle(l.from, l.to).map(([lng, lat]) => project(lng, lat)).filter((p): p is [number, number] => p != null);
    if (pts.length < 2) continue;
    const parts = splitAtAntimeridian(pts, width);
    const longest = parts.reduce((a, b) => (b.length > a.length ? b : a), parts[0] ?? []);
    out.push({
      key: `${l.flightId}-${l.index}`,
      parts: parts.map(toPathD),
      start: pts[0], end: pts[pts.length - 1],
      fromCode: l.from.code, toCode: l.to.code,
      // Slightly before halfway: an outbound and return pair then sit
      // apart rather than on top of each other mid-route.
      mid: midpointAndHeading(longest, PLANE_AT),
      date: l.date, startsJourney: l.index === 0, endsJourney: l.index === l.of - 1, index: l.index,
    });
  }
  return out;
}
