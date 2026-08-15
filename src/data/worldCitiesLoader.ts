import { haversineKm } from '../lib/travelStats';
import { PLANNING_AIRPORTS } from './planningAirports';
import { loadGlobalAirports, type GlobalAirport } from './globalAirportsLoader';

export interface WorldCity {
  name: string;
  lat: number;
  lng: number;
  country: string;
  pop: number;
}

let cached: WorldCity[] | null = null;

export async function loadWorldCities(): Promise<WorldCity[]> {
  if (cached) return cached;
  const mod = await import('./worldCities.json');
  cached = mod.default as WorldCity[];
  return cached;
}

export async function citiesForCountry(country: string, limit = 20): Promise<WorldCity[]> {
  const cities = await loadWorldCities();
  return cities.filter((c) => c.country === country).slice(0, limit);
}

export interface NearestAirportResult {
  airport: { iata: string; name: string; lat: number; lng: number; city: string; country: string; large?: boolean };
  distanceKm: number;
}

const LARGE_AIRPORT_SEARCH_RADIUS_KM = 100;

/**
 * Finds the genuinely closest airport to a city, preferring large/primary
 * airports and only falling back to a medium one when no large airport is
 * within reasonable range. A pure nearest-distance search sometimes picks
 * a small military or joint-use airfield over the real primary commercial
 * airport a traveller would actually use (verified against Japan's top 20
 * cities -- e.g. Nagoya's genuinely nearest point is a JASDF base, not the
 * real Chubu Centrair most travellers fly into).
 */
export async function nearestAirportToCity(cityLat: number, cityLng: number): Promise<NearestAirportResult | null> {
  const global = await loadGlobalAirports();
  const combined: GlobalAirport[] = [...PLANNING_AIRPORTS.map((a) => ({ ...a, large: true })), ...global];
  if (combined.length === 0) return null;

  const distTo = (a: GlobalAirport) => haversineKm(cityLat, cityLng, a.lat, a.lng);

  const largeOnes = combined.filter((a) => a.large !== false);
  let best: GlobalAirport | null = null;
  let bestDist = Infinity;
  for (const a of largeOnes) {
    const d = distTo(a);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  if (best && bestDist <= LARGE_AIRPORT_SEARCH_RADIUS_KM) {
    return { airport: best, distanceKm: bestDist };
  }

  // No large airport nearby -- fall back to the full set, including medium.
  best = null;
  bestDist = Infinity;
  for (const a of combined) {
    const d = distTo(a);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  if (!best) return null;
  return { airport: best, distanceKm: bestDist };
}
