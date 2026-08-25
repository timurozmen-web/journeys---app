import { useMemo, useState, useRef, useEffect } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { worldGeo } from '../data/worldGeo';
import { AIRPORTS, COUNTRY_NAME_MAP } from '../data/airports';
import type { Hotel, Flight, Review } from '../types';

const WIDTH = 360;
const HEIGHT = 200;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const geo = worldGeo;
const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], geo);
const pathGen = geoPath(projection);
const countryPaths: { name: string; d: string; centroid: [number, number]; bounds: [[number, number], [number, number]] }[] = geo.features
  .map((f: any) => ({
    name: f.properties.name as string, d: pathGen(f) || '',
    centroid: pathGen.centroid(f) as [number, number], bounds: pathGen.bounds(f) as [[number, number], [number, number]],
  }))
  .filter((c: { d: string }) => c.d);

function normalizeCountry(c: string) {
  return COUNTRY_NAME_MAP[c] ?? c;
}
function project(lat: number, lng: number): [number, number] | null {
  const p = projection([lng, lat]);
  return p as [number, number] | null;
}

export function WorldMap({
  hotels, flights, reviews, focusCountries,
}: {
  hotels: Hotel[]; flights: Flight[]; reviews: Review[]; focusCountries?: string[] | null;
}) {
  const [showRoutes, setShowRoutes] = useState(false);
  const [year, setYear] = useState<'all' | number>('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const dragState = useRef<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);
  const wasDragged = useRef(false);

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, panStartX: pan.x, panStartY: pan.y };
    wasDragged.current = false;
  }
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) wasDragged.current = true;
    if (wasDragged.current) {
      // Scale the screen-pixel delta into the SVG's own coordinate space
      // (the viewBox is a fixed 360x200 regardless of rendered size), and
      // divide by zoom so panning speed matches the current zoom level
      // rather than dragging the whole map miles per pixel when zoomed in.
      const svg = e.currentTarget;
      const scale = WIDTH / svg.getBoundingClientRect().width;
      const rawX = ds.panStartX + dx * scale / zoom;
      const rawY = ds.panStartY + dy * scale / zoom;
      // At the current zoom, the transformed content spans
      // [pan, pan + SIZE*zoom]. Clamp so the fixed viewBox [0, SIZE]
      // always stays inside that range -- never pan the content out from
      // under the visible area.
      const minX = WIDTH * (1 - zoom);
      const minY = HEIGHT * (1 - zoom);
      setPan({ x: Math.min(0, Math.max(minX, rawX)), y: Math.min(0, Math.max(minY, rawY)) });
    }
  }
  function handlePointerUp() {
    dragState.current = null;
    // wasDragged.current is deliberately NOT reset here -- pointerup fires
    // before the click event that follows it, so selectCountry (triggered
    // by that click) still needs to see whether this gesture was a drag.
    // It gets reset on the next pointerdown instead.
  }

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

  // Top-rated place logged in the selected country, from real review
  // scores -- not a separate estimate, the same ranking already used on
  // the Reviews list below.
  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    const nights = nightsByCountry.get(selected) ?? 0;
    const inCountry = reviews.filter(
      (r) => normalizeCountry(r.country.trim()) === selected && (year === 'all' || Number(r.date.slice(0, 4)) === year)
    );
    const stayCount = new Set(hotels.filter((h) => h.date && normalizeCountry(h.country.trim()) === selected && (year === 'all' || Number(h.date.slice(0, 4)) === year)).map((h) => h.id)).size;
    const topPlaces = [...inCountry].sort((a, b) => b.score - a.score).slice(0, 3);
    return { nights, stayCount, topPlaces };
  }, [selected, nightsByCountry, reviews, hotels, year]);

  function zoomBy(factor: number) {
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
  }
  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelected(null);
  }

  // Clicking a visited country zooms toward its centroid and opens the
  // detail card -- makes "zoom in on where I went" feel like one motion
  // rather than two separate steps.
  const focusCountriesKey = focusCountries?.join('|') ?? '';
  useEffect(() => {
    if (!focusCountries || focusCountries.length === 0) return;
    const normalizedFocus = focusCountries.map(normalizeCountry);
    const matched = countryPaths.filter((c) => normalizedFocus.includes(c.name));
    if (matched.length === 0) return;

    const minX = Math.min(...matched.map((c) => c.bounds[0][0]));
    const minY = Math.min(...matched.map((c) => c.bounds[0][1]));
    const maxX = Math.max(...matched.map((c) => c.bounds[1][0]));
    const maxY = Math.max(...matched.map((c) => c.bounds[1][1]));
    const regionWidth = Math.max(1, maxX - minX);
    const regionHeight = Math.max(1, maxY - minY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Fit the region's bounding box inside the viewBox with some margin,
    // rather than a fixed zoom level -- a single small country and a
    // sprawling multi-country region need very different amounts of zoom.
    const margin = 1.4;
    const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(WIDTH / (regionWidth * margin), HEIGHT / (regionHeight * margin))));
    setZoom(targetZoom);
    setPan({ x: WIDTH / 2 - centerX * targetZoom, y: HEIGHT / 2 - centerY * targetZoom });
    setSelected(null); // any previously-open country detail card no longer applies to this new view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCountriesKey]);

  function selectCountry(name: string) {
    if (wasDragged.current) { wasDragged.current = false; return; } // a drag just ended here, not a tap
    const nights = nightsByCountry.get(name);
    if (!nights) return; // only countries actually visited are interactive
    setSelected(name === selected ? null : name);
    if (name !== selected) {
      const country = countryPaths.find((c) => c.name === name);
      if (country) {
        const targetZoom = 2.5;
        setZoom(targetZoom);
        const rawX = WIDTH / 2 - country.centroid[0] * targetZoom;
        const rawY = HEIGHT / 2 - country.centroid[1] * targetZoom;
        setPan({ x: Math.min(0, Math.max(WIDTH * (1 - targetZoom), rawX)), y: Math.min(0, Math.max(HEIGHT * (1 - targetZoom), rawY)) });
      }
    }
  }

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

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', height: 'auto', display: 'block', background: '#DCE7F5', borderRadius: 12, overflow: 'hidden', touchAction: 'none', cursor: 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {countryPaths.map((c) => {
              const nights = nightsByCountry.get(c.name);
              const fill = nights ? shadeFor(nights, maxNights) : '#B9CEEC';
              const isSelected = selected === c.name;
              return (
                <path
                  key={c.name} d={c.d} fill={fill}
                  stroke={isSelected ? '#fff' : '#DCE7F5'} strokeWidth={isSelected ? 1.2 / zoom : 0.4 / zoom}
                  onClick={() => selectCountry(c.name)}
                  style={{ cursor: nights ? 'pointer' : 'default' }}
                />
              );
            })}
            {showRoutes &&
              routeLines.map((r) => (
                <path key={r.key} d={r.d} fill="none" stroke="#5B3FA6" strokeWidth={0.7 / zoom} strokeDasharray={`${2 / zoom} ${1.5 / zoom}`} opacity={0.75} />
              ))}
            {showRoutes &&
              airportDots.map((a) => <circle key={a.code} cx={a.x} cy={a.y} r={1.6 / zoom} fill="#5B3FA6" stroke="#fff" strokeWidth={0.5 / zoom} />)}
          </g>
        </svg>

        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ZoomBtn onClick={() => zoomBy(1.5)}>+</ZoomBtn>
          <ZoomBtn onClick={() => zoomBy(1 / 1.5)}>−</ZoomBtn>
          {(zoom !== 1 || selected) && <ZoomBtn onClick={resetView}>⟲</ZoomBtn>}
        </div>

        {selected && selectedDetail && (
          <div
            style={{
              position: 'absolute', left: 10, right: 10, bottom: 10, background: '#fff', borderRadius: 12,
              border: '1.5px solid var(--brand)', padding: '10px 12px', boxShadow: '0 6px 16px rgba(23,23,28,.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{selected}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 700, marginTop: 2 }}>
              {selectedDetail.nights} nights · {selectedDetail.stayCount} stay{selectedDetail.stayCount === 1 ? '' : 's'}
            </div>
            {selectedDetail.topPlaces.length > 0 ? (
              <div style={{ marginTop: 6, display: 'grid', gap: 3 }}>
                {selectedDetail.topPlaces.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                    <span style={{ color: 'var(--ink)' }}>{r.hotelName}</span>
                    <span style={{ fontWeight: 700, color: 'var(--ink2)' }}>{r.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>No reviews logged here yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ZoomBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 26, height: 26, borderRadius: 8, border: '1px solid var(--line)', background: '#fff',
        color: 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center',
        boxShadow: '0 1px 4px rgba(23,23,28,.15)',
      }}
    >
      {children}
    </button>
  );
}

function shadeFor(nights: number, max: number) {
  const t = Math.min(1, nights / max);
  const shades = ['#8797BC', '#5F71A0', '#8560D6', '#5B3FA6'];
  const idx = Math.min(shades.length - 1, Math.floor(t * shades.length));
  return shades[idx];
}
