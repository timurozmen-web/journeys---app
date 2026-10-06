import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getDestinationPhoto } from '../lib/unsplash';
import type { PlanningAirport } from '../data/planningAirports';
import type { TransportMode } from '../lib/tripPlanner';
import { MAP } from '../data/mapTheme';
import { greatCircle, midpointAndHeading, PLANE_AT } from '../lib/flightPath';
import { dayMonth } from '../lib/format';

interface PlanCity {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  nights?: number;
  why?: string;
}
interface MapLegInfo {
  mode: TransportMode;
  distanceKm: number;
  hours: number;
}

const MODE_ICON_SVG: Record<TransportMode, string> = {
  flight: '<path d="M2 12h6l4-7 2 1-2 6h5l2-3h2l-1.5 4L21 16h-2l-2-3h-5l2 6-2 1-4-7H2z"/>',
  rail: '<rect x="5" y="3" width="14" height="14" rx="4"/><path d="M5 13h14M9 17l-2 4M15 17l2 4"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/>',
  road: '<path d="M4 16V11l2-5h12l2 5v5"/><path d="M4 16h16M6 16v2M18 16v2"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>',
};

// Same rounding rule as the rest of the app's duration displays (see
// Plan.tsx's formatHours): a formula estimate has no business claiming
// false precision, and this map label was a separate, un-rounded
// implementation of the same thing.
function formatHours(h: number): string {
  const totalMins = h * 60;
  const rounded = totalMins > 60 ? Math.round(totalMins / 15) * 15 : Math.round(totalMins);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins === 0 ? `${hours}h` : `${hours}h${mins}m`;
}

function legBadgeIcon(info: MapLegInfo): L.DivIcon {
  const label = `${Math.round(info.distanceKm)}km · ${formatHours(info.hours)}`;
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;align-items:center;gap:4px;background:${MAP.panel};border:1.5px solid ${MAP.route};border-radius:99px;padding:4px 9px;box-shadow:0 3px 8px rgba(40,30,20,.2);white-space:nowrap;font-family:inherit;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${MAP.route}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${MODE_ICON_SVG[info.mode]}</svg>
        <span style="font-size:11.5px;font-weight:700;color:${MAP.text};">${label}</span>
      </div>`,
    iconSize: undefined,
    iconAnchor: [30, 12],
  });
}

// Great-circle points as Leaflet lat/lngs, with longitudes unwrapped so
// a route over the date line stays one continuous line.
function gcLatLngs(a: { lat: number; lng: number }, b: { lat: number; lng: number }): L.LatLng[] {
  const pts = greatCircle(a, b, 64);
  const out: L.LatLng[] = [];
  let offset = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const d = pts[i][0] - pts[i - 1][0];
      if (d > 180) offset -= 360;
      else if (d < -180) offset += 360;
    }
    out.push(L.latLng(pts[i][1], pts[i][0] + offset));
  }
  return out;
}

// Midpoint of a route and its heading on screen. Mercator only scales
// uniformly with zoom, so the angle worked out at one zoom holds at all.
function routeMid(map: L.Map, lls: L.LatLng[]): { at: L.LatLng; angle: number } {
  const pts = lls.map((ll) => { const p = map.project(ll, 4); return [p.x, p.y] as [number, number]; });
  const m = midpointAndHeading(pts, PLANE_AT)!;
  return { at: map.unproject(L.point(m.x, m.y), 4), angle: m.angle };
}

const PLANE_PATH = 'M8,0 C8,.9 7,1.2 6,1.2 L2,1.2 L-2,7 L-4,7 L-1.5,1.2 L-5,1.2 L-6.5,3.5 L-8,3.5 L-7,0 L-8,-3.5 L-6.5,-3.5 L-5,-1.2 L-1.5,-1.2 L-4,-7 L-2,-7 L2,-1.2 L6,-1.2 C7,-1.2 8,-.9 8,0 Z';

// Plane facing the way the route flies, with an optional date chip.
// The return plane's chip hangs below it, so it can't collide with the
// outbound chip when the two routes run close together.
function planeIcon(angle: number, date: string | null, dim = false): L.DivIcon {
  const chip = date
    ? `<div style="position:absolute;left:50%;${dim ? 'top:24px' : 'bottom:22px'};transform:translateX(-50%);white-space:nowrap;background:${MAP.panel};border:1px solid ${MAP.route};color:${MAP.route};border-radius:99px;padding:2px 8px;font:700 10.5px/1.3 var(--font-display);">${date}</div>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:26px;height:26px;opacity:${dim ? 0.75 : 1}">
      ${chip}
      <svg width="26" height="26" viewBox="-10 -10 20 20" style="transform:rotate(${angle}deg);filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))">
        <path d="${PLANE_PATH}" fill="${MAP.home}" stroke="${MAP.sea}" stroke-width=".8"/>
      </svg></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// Home airport: a hollow gold ring with its code.
function originIcon(code: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:16px;height:16px;border-radius:50%;background:${MAP.sea};border:2.5px solid ${MAP.route};box-sizing:border-box">
      <div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);font:700 11px/1 var(--font-display);color:${MAP.text};text-shadow:0 0 3px #FBF9F4">${code}</div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const { day, month } = dayMonth(iso);
  return `${day} ${month}`;
}

function cityMarkerIcon(rank: number, active: boolean): L.DivIcon {
  const size = active ? 30 : 26;
  return L.divIcon({
    className: '',
    html: `
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${MAP.stop};border:2.5px solid ${MAP.stopRing};
        box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;
        color:${MAP.stopRing};font-weight:700;font-size:${active ? 13 : 11.5}px;font-family:inherit;">
        ${rank}
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function PlanMap({
  home, cities, domesticLegs, internationalLeg, departDate, returnDate,
}: {
  home: PlanningAirport | null;
  cities: PlanCity[];
  domesticLegs: MapLegInfo[];
  internationalLeg: MapLegInfo | null;
  departDate?: string | null;
  returnDate?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Map instance created once and cleaned up on unmount -- Leaflet owns
  // the DOM inside containerRef directly, so this stays outside React's
  // normal render cycle rather than being recreated every render.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true, attributionControl: true, scrollWheelZoom: true,
    }).setView([20, 0], 2);

    // Carto Positron: real OSM road/city data underneath, with a muted,
    // near-monochrome palette that actually sits with this app's warm,
    // minimal off-white theme -- Voyager's more saturated colours (bright
    // blue water, busy road/label colour-coding) clashed with it,
    // especially at world zoom where that saturation and label density
    // is most visible. Free, no API key required. Labels are still in
    // each place's local language, same as raw OSM -- that's a genuine
    // limitation of free pre-rendered raster tiles generally (the label
    // language is baked in by whoever renders the tile), not something
    // fixable by picking a different free style.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Markers/routes rebuilt whenever the itinerary changes -- cheap
  // relative to a full map teardown, and keeps zoom/pan state (the user's
  // own exploration of the map) untouched across itinerary edits.
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;
    layerGroup.clearLayers();

    if (cities.length === 0) return;

    const points: L.LatLngExpression[] = cities.map((c) => [c.lat, c.lng]);
    const homePoint: L.LatLngExpression | null = home ? [home.lat, home.lng] : null;
    const allPoints = homePoint ? [...points, homePoint] : points;

    // Outbound: home airport to the first place you chose, on the real
    // great-circle path, ending exactly on that city/region. Return: the
    // last place back home, drawn fainter so the two read as out and back.
    if (home && cities.length > 0) {
      const first = cities[0];
      const last = cities[cities.length - 1];
      const out = gcLatLngs(home, first);
      layerGroup.addLayer(L.polyline(out, { color: MAP.route, weight: 2.5, dashArray: '2 7', lineCap: 'round', opacity: 0.95 }));
      const outMid = routeMid(map, out);
      // The long-haul leg's flying time rides on the plane's chip rather
      // than a separate badge that could cover the city markers.
      const outChip = [shortDate(departDate), internationalLeg ? formatHours(internationalLeg.hours) : null].filter(Boolean).join(' · ') || null;
      L.marker(outMid.at, { icon: planeIcon(outMid.angle, outChip), interactive: false }).addTo(layerGroup);
      const back = gcLatLngs(last, home);
      layerGroup.addLayer(L.polyline(back, { color: MAP.route, weight: 1.6, dashArray: '2 7', lineCap: 'round', opacity: 0.45 }));
      const backMid = routeMid(map, back);
      L.marker(backMid.at, { icon: planeIcon(backMid.angle, shortDate(returnDate), true), interactive: false }).addTo(layerGroup);
      L.marker([home.lat, home.lng], { icon: originIcon(home.iata), interactive: false }).addTo(layerGroup);
    }

    // Leg badges only appear once the leg is long enough on screen to
    // hold one without covering the numbered city markers.
    const badges: { marker: L.Marker; a: L.LatLng; b: L.LatLng }[] = [];
    for (let i = 0; i < cities.length - 1; i++) {
      const seg = gcLatLngs(cities[i], cities[i + 1]);
      layerGroup.addLayer(L.polyline(seg, { color: MAP.route, weight: 2.5, dashArray: '2 7', lineCap: 'round', opacity: 0.9 }));
      if (domesticLegs[i]) {
        const mid = routeMid(map, seg);
        const badge = L.marker(mid.at, { icon: legBadgeIcon(domesticLegs[i]), interactive: false });
        badges.push({ marker: badge, a: seg[0], b: seg[seg.length - 1] });
      }
    }

    cities.forEach((c, i) => {
      const marker = L.marker([c.lat, c.lng], { icon: cityMarkerIcon(i + 1, false) });
      const buildPopupHtml = (photoUrl?: string) => `
        <div style="font-family:inherit;min-width:170px;">
          ${photoUrl ? `<img src="${photoUrl}" alt="${c.city}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px;display:block;" />` : ''}
          <div style="font-size:13px;font-weight:700;color:${MAP.text};">${i + 1}. ${c.city}</div>
          ${c.nights != null ? `<div style="font-size:11px;font-weight:700;color:${MAP.route};margin-top:2px;">${c.nights} nights</div>` : ''}
          ${c.why ? `<div style="font-size:11px;color:${MAP.textSub};margin-top:3px;line-height:1.4;">${c.why}</div>` : ''}
        </div>`;
      marker.bindPopup(buildPopupHtml(), { closeButton: true, className: 'planmap-popup', maxWidth: 200 });

      // Fetch the photo only once the popup is actually opened, not
      // upfront for every city -- most plans have cities the user never
      // taps, so this avoids wasting Unsplash's rate-limited API calls.
      let photoRequested = false;
      marker.on('popupopen', () => {
        if (photoRequested) return;
        photoRequested = true;
        getDestinationPhoto(`${c.city} ${c.country ?? ''}`.trim()).then((photo) => {
          if (photo) marker.getPopup()?.setContent(buildPopupHtml(photo.url));
        });
      });
      marker.addTo(layerGroup);
    });

    const showBadges = () => {
      for (const b of badges) {
        const px = map.latLngToLayerPoint(b.a).distanceTo(map.latLngToLayerPoint(b.b));
        if (px > 150) { if (!layerGroup.hasLayer(b.marker)) layerGroup.addLayer(b.marker); }
        else if (layerGroup.hasLayer(b.marker)) layerGroup.removeLayer(b.marker);
      }
    };
    map.on('zoomend', showBadges);

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 11);
    } else {
      const bounds = L.latLngBounds(allPoints);
      if (home && cities.length > 0) gcLatLngs(home, cities[0]).forEach((ll) => bounds.extend(ll));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    showBadges();
    return () => { map.off('zoomend', showBadges); };
  }, [home, cities, domesticLegs, internationalLeg, departDate, returnDate]);

  if (cities.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 320, borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--map-bg)' }}
    />
  );
}
