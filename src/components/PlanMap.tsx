import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getDestinationPhoto } from '../lib/unsplash';
import type { PlanningAirport } from '../data/planningAirports';
import type { TransportMode } from '../lib/tripPlanner';

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

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins === 0 ? `${hours}h` : `${hours}h${mins}m`;
}

function midpoint(a: L.LatLngExpression, b: L.LatLngExpression): L.LatLng {
  const la = L.latLng(a), lb = L.latLng(b);
  return L.latLng((la.lat + lb.lat) / 2, (la.lng + lb.lng) / 2);
}

function legBadgeIcon(info: MapLegInfo): L.DivIcon {
  const label = `${Math.round(info.distanceKm)}km · ${formatHours(info.hours)}`;
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;align-items:center;gap:4px;background:#fff;border:1.5px solid #1E3A8F;border-radius:99px;padding:4px 9px;box-shadow:0 3px 8px rgba(23,23,28,.18);white-space:nowrap;font-family:inherit;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1E3A8F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${MODE_ICON_SVG[info.mode]}</svg>
        <span style="font-size:11.5px;font-weight:700;color:#17171C;">${label}</span>
      </div>`,
    iconSize: undefined,
    iconAnchor: [30, 12],
  });
}

function cityMarkerIcon(rank: number, active: boolean): L.DivIcon {
  const size = active ? 30 : 26;
  return L.divIcon({
    className: '',
    html: `
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:#1E3A8F;border:2.5px solid #fff;
        box-shadow:0 2px 6px rgba(23,23,28,.3);display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:800;font-size:${active ? 13 : 11.5}px;font-family:inherit;">
        ${rank}
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function PlanMap({
  home, cities, domesticLegs, internationalLeg,
}: {
  home: PlanningAirport | null;
  cities: PlanCity[];
  domesticLegs: MapLegInfo[];
  internationalLeg: MapLegInfo | null;
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

    // Carto Voyager: real OSM road/city data underneath, but with a
    // clearer road hierarchy and much less visual clutter than raw OSM's
    // default style -- closer to the requested Apple Maps middle ground.
    // Free, no API key required. Labels are still in each place's local
    // language, same as raw OSM -- that's a genuine limitation of free
    // pre-rendered raster tiles generally (the label language is baked in
    // by whoever renders the tile), not something fixable by picking a
    // different free style.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
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

    if (homePoint && cities.length > 0) {
      const line = L.polyline([homePoint, points[0]], { color: '#1E3A8F', weight: 2.5, dashArray: '2 8', opacity: 0.75 });
      layerGroup.addLayer(line);
      L.circleMarker(homePoint, { radius: 6, color: '#1E3A8F', weight: 2, fillColor: '#fff', fillOpacity: 1 }).addTo(layerGroup);
      if (internationalLeg) {
        L.marker(midpoint(homePoint, points[0]), { icon: legBadgeIcon(internationalLeg), interactive: false }).addTo(layerGroup);
      }
    }

    for (let i = 0; i < points.length - 1; i++) {
      const line = L.polyline([points[i], points[i + 1]], { color: '#1E3A8F', weight: 3, dashArray: '2 8', opacity: 0.85 });
      layerGroup.addLayer(line);
      if (domesticLegs[i]) {
        L.marker(midpoint(points[i], points[i + 1]), { icon: legBadgeIcon(domesticLegs[i]), interactive: false }).addTo(layerGroup);
      }
    }

    cities.forEach((c, i) => {
      const marker = L.marker([c.lat, c.lng], { icon: cityMarkerIcon(i + 1, false) });
      const buildPopupHtml = (photoUrl?: string) => `
        <div style="font-family:inherit;min-width:170px;">
          ${photoUrl ? `<img src="${photoUrl}" alt="${c.city}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px;display:block;" />` : ''}
          <div style="font-size:13px;font-weight:800;color:#17171C;">${i + 1}. ${c.city}</div>
          ${c.nights != null ? `<div style="font-size:11px;font-weight:700;color:#1E3A8F;margin-top:2px;">${c.nights} nights</div>` : ''}
          ${c.why ? `<div style="font-size:11px;color:#5C5C6E;margin-top:3px;line-height:1.4;">${c.why}</div>` : ''}
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

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 11);
    } else {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [36, 36] });
    }
  }, [home, cities, domesticLegs, internationalLeg]);

  if (cities.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 320, borderRadius: 16, overflow: 'hidden', background: '#DCE7F5' }}
    />
  );
}
