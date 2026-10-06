import { useMemo, useState, useRef, useEffect, useId } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { worldGeo } from '../data/worldGeo';
import { COUNTRY_NAME_MAP } from '../data/airports';
import { flightLegs, projectLegs } from '../lib/flightPath';
import { useGlobalAirports } from '../lib/useGlobalAirports';
import { MapBackdrop, RouteLayer, type DrawnLeg } from './MapLayers';
import type { Hotel, Flight, Review } from '../types';
import { MAP } from '../data/mapTheme';

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
  hotels, flights, reviews, focusCountries, scratch = false,
}: {
  hotels: Hotel[]; flights: Flight[]; reviews: Review[]; focusCountries?: string[] | null;
  /** Draw visited countries scratched off (Then) rather than shaded by nights. */
  scratch?: boolean;
}) {
  const scratchId = `scratch${useId().replace(/:/g, '')}`;
  const [showRoutes, setShowRoutes] = useState(false);
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

  const nightsByCountry = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hotels) {
      if (!h.date || !h.country) continue;
      const key = normalizeCountry(h.country.trim());
      m.set(key, (m.get(key) ?? 0) + (h.nights || 1));
    }
    return m;
  }, [hotels]);

  const maxNights = Math.max(1, ...nightsByCountry.values());

  const globalAirports = useGlobalAirports();
  const routeLegs: DrawnLeg[] = useMemo(
    () => projectLegs(
      flights.filter((f) => f.date).flatMap((f) => flightLegs(f, globalAirports)),
      (lng, lat) => project(lat, lng), WIDTH,
    ),
    [flights, globalAirports],
  );

  // Top-rated place logged in the selected country, from real review
  // scores -- not a separate estimate, the same ranking already used on
  // the Reviews list below.
  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    const nights = nightsByCountry.get(selected) ?? 0;
    const inCountry = reviews.filter((r) => normalizeCountry(r.country.trim()) === selected);
    const stayCount = new Set(hotels.filter((h) => h.date && normalizeCountry(h.country.trim()) === selected).map((h) => h.id)).size;
    const topPlaces = [...inCountry].sort((a, b) => b.score - a.score).slice(0, 3);
    return { nights, stayCount, topPlaces };
  }, [selected, nightsByCountry, reviews, hotels]);

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
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 10px', alignItems: 'center' }}>
        <button
          onClick={() => setShowRoutes((v) => !v)}
          style={{
            padding: '6px 12px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line)',
            background: showRoutes ? 'var(--brand)' : 'var(--card2)', color: showRoutes ? 'var(--on-brand)' : 'var(--ink2)',
            fontSize: 'var(--fs-caption)', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Routes
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--map-bg)', borderRadius: 'var(--r-sm)', overflow: 'hidden', touchAction: 'none', cursor: 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {scratch && (
            <defs>
              <pattern id={scratchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
                <rect width="5" height="5" fill={MAP.scratch} />
                <path d="M0 0L5 5M5 0L0 5" stroke={MAP.scratchMark} strokeWidth="0.7" strokeOpacity="0.55" />
              </pattern>
            </defs>
          )}
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            <MapBackdrop
              projection={projection} width={WIDTH} height={HEIGHT}
              countries={countryPaths.map((c) => {
                const nights = nightsByCountry.get(c.name);
                const isSelected = selected === c.name;
                return {
                  key: c.name, d: c.d,
                  fill: nights ? (scratch ? `url(#${scratchId})` : shadeFor(nights, maxNights)) : undefined,
                  stroke: isSelected ? MAP.text : MAP.landBorder, strokeWidth: isSelected ? 1.2 / zoom : 0.4 / zoom,
                  onClick: () => selectCountry(c.name),
                };
              })}
            />
            {showRoutes && <RouteLayer legs={routeLegs} k={zoom} showPlanes={zoom >= 2} showDates={false} showCodes={zoom >= 2} />}
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
              position: 'absolute', left: 10, right: 10, bottom: 10, background: 'var(--card)', borderRadius: 'var(--r-sm)',
              border: '1.5px solid var(--brand)', padding: '10px 12px', boxShadow: '0 6px 16px rgba(0,0,0,.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink)' }}>{selected}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer', fontSize: 'var(--fs-body)', padding: 0, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--brand)', fontWeight: 700, marginTop: 2 }}>
              {selectedDetail.nights} nights · {selectedDetail.stayCount} stay{selectedDetail.stayCount === 1 ? '' : 's'}
            </div>
            {selectedDetail.topPlaces.length > 0 ? (
              <div style={{ marginTop: 6, display: 'grid', gap: 3 }}>
                {selectedDetail.topPlaces.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-caption)' }}>
                    <span style={{ color: 'var(--ink)' }}>{r.hotelName}</span>
                    <span style={{ fontWeight: 700, color: 'var(--ink2)' }}>{r.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 4 }}>No reviews logged here yet.</div>
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
        width: 26, height: 26, borderRadius: 'var(--r-xs)', border: '1px solid var(--line)', background: 'var(--card)',
        color: 'var(--ink)', fontSize: 'var(--fs-body-lg)', fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,.4)',
      }}
    >
      {children}
    </button>
  );
}

function shadeFor(nights: number, max: number) {
  const t = Math.min(1, nights / max);
  const shades = MAP.visitedShades;
  const idx = Math.min(shades.length - 1, Math.floor(t * shades.length));
  return shades[idx];
}
