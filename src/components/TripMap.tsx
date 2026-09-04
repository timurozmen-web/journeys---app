import { useMemo, useState, useRef, useEffect } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { worldGeo } from '../data/worldGeo';
import { AIRPORTS } from '../data/airports';
import type { Hotel, Flight } from '../types';
import type { TripPhoto } from '../lib/queries';

const WIDTH = 360;
const HEIGHT = 220;
const PAD = 28; // leaves breathing room so points/routes aren't flush against the edge
const STEP_MS = 1400; // time spent on each stop before advancing

const geo = worldGeo;

// One chronological stop in the playback sequence -- a hotel stay, or a
// geotagged photo. Flights don't get their own stop (they're the lines
// between stops), keeping the sequence to places actually visited.
interface Stop {
  x: number;
  y: number;
  date: string;
  label: string;
  photoUrl: string | null;
}

export function TripMap({ hotels, flights, photos = [] }: { hotels: Hotel[]; flights: Flight[]; photos?: TripPhoto[] }) {
  const [playing, setPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const points = useMemo(() => {
    const pts: [number, number][] = [];
    for (const h of hotels) {
      if (h.lat != null && h.lng != null) pts.push([h.lng, h.lat]);
    }
    for (const p of photos) {
      if (p.lat != null && p.lng != null) pts.push([p.lng, p.lat]);
    }
    for (const f of flights) {
      const a = AIRPORTS[f.from];
      const b = AIRPORTS[f.to];
      if (a) pts.push([a.lng, a.lat]);
      if (b) pts.push([b.lng, b.lat]);
    }
    return pts;
  }, [hotels, flights, photos]);

  const { countryPaths, routeLines, markers, photoMarkers, stops } = useMemo(() => {
    if (points.length === 0) {
      return { countryPaths: [], routeLines: [], markers: [], photoMarkers: [], stops: [] as Stop[] };
    }

    const lngs = points.map((pt) => pt[0]);
    const lats = points.map((pt) => pt[1]);
    const spanLng = Math.max(...lngs) - Math.min(...lngs);
    const spanLat = Math.max(...lats) - Math.min(...lats);
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

    const photoMarkers: { x: number; y: number; url: string }[] = [];
    for (const ph of photos) {
      if (ph.lat == null || ph.lng == null) continue;
      const p = project(ph.lat, ph.lng);
      if (p) photoMarkers.push({ x: p[0], y: p[1], url: ph.url });
    }

    // Real chronological sequence for playback -- hotels by check-in date,
    // geotagged photos by their own real EXIF capture time, merged and
    // sorted so the animation follows the trip in the order it actually
    // happened, not the order things were logged.
    const stops: Stop[] = [];
    for (const h of hotels) {
      if (h.lat == null || h.lng == null) continue;
      const p = project(h.lat, h.lng);
      if (p) stops.push({ x: p[0], y: p[1], date: h.date, label: h.city ?? h.name, photoUrl: null });
    }
    for (const ph of photos) {
      if (ph.lat == null || ph.lng == null || !ph.takenAt) continue;
      const p = project(ph.lat, ph.lng);
      if (p) stops.push({ x: p[0], y: p[1], date: ph.takenAt, label: 'Photo', photoUrl: ph.url });
    }
    stops.sort((a, b) => a.date.localeCompare(b.date));

    return { countryPaths, routeLines, markers, photoMarkers, stops };
  }, [points, flights, hotels, photos]);

  // Advance through stops on a timer while playing, stopping cleanly at
  // the end rather than looping unexpectedly.
  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= stops.length - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => setStepIndex((i) => i + 1), STEP_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, stepIndex, stops.length]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (stepIndex >= stops.length - 1) setStepIndex(0); // restart from the beginning if already at the end
    setPlaying(true);
  }

  if (points.length === 0) return null;

  const activeStop = playing ? stops[stepIndex] : null;
  const traveledPath = playing && stops.length > 1
    ? `M${stops.slice(0, stepIndex + 1).map((s) => `${s.x},${s.y}`).join(' L')}`
    : '';

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#DCE7F5', borderRadius: 16 }}>
        {countryPaths.map((c) => (
          <path key={c.name} d={c.d} fill="#B9CEEC" stroke="#DCE7F5" strokeWidth={0.5} />
        ))}
        {routeLines.map((r) => (
          <path key={r.key} d={r.d} fill="none" stroke="#1E3A8F" strokeWidth={1.1} strokeDasharray="3 2.2" opacity={0.85} />
        ))}
        {markers.map((m, i) => (
          <circle key={`h${i}`} cx={m.x} cy={m.y} r={3.2} fill="#1E3A8F" stroke="#fff" strokeWidth={1} />
        ))}
        {photoMarkers.map((p, i) => (
          <g key={`p${i}`}>
            <circle cx={p.x} cy={p.y} r={4} fill="#FF9962" stroke="#fff" strokeWidth={1} />
            <circle cx={p.x} cy={p.y} r={1.4} fill="#fff" />
          </g>
        ))}
        {playing && traveledPath && (
          <path d={traveledPath} fill="none" stroke="#1E3A8F" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
        )}
        {playing && activeStop && (
          <circle cx={activeStop.x} cy={activeStop.y} r={5.5} fill="#1E3A8F" stroke="#fff" strokeWidth={1.6}>
            <animate attributeName="r" values="5.5;8;5.5" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>

      {stops.length > 1 && (
        <button
          onClick={togglePlay}
          style={{
            position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 99, border: 'none', background: 'rgba(255,255,255,.92)',
            color: 'var(--brand)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(23,23,28,.18)',
          }}
        >
          {playing ? '⏸ Pause' : '▶ Play trip'}
        </button>
      )}

      {playing && activeStop && (
        <div
          style={{
            position: 'absolute', left: 10, right: 10, bottom: 10, background: '#fff', borderRadius: 10,
            border: '1px solid var(--line)', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(23,23,28,.15)',
          }}
        >
          {activeStop.photoUrl && (
            <img src={activeStop.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeStop.label}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{activeStop.date.slice(0, 10)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
