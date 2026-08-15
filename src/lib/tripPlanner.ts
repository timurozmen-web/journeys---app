import { haversineKm } from './travelStats';
import { PLANNING_AIRPORTS_BY_IATA, type PlanningAirport } from '../data/planningAirports';

export type TransportMode = 'flight' | 'rail' | 'road';

export interface LegPlan {
  fromCity: string;
  toCity: string;
  distanceKm: number; // exact, computed from real coordinates
  recommendedMode: TransportMode;
  rationale: string;
  estimatedHours: number; // estimated, not looked up
  estimatedCostGBP: number; // estimated, not looked up
}

// Rough average speeds including the real overheads that dominate short
// journeys -- airport check-in/security/transfers, or station access.
// These are estimates and presented as such in the UI.
const FLIGHT_CRUISE_KMH = 800;
const FLIGHT_FIXED_OVERHEAD_H = 3; // check-in, security, boarding, taxi, baggage, both-end transfers
// High-speed rail (Shinkansen, TGV, Eurostar-class) genuinely averages
// ~250km/h door-to-door on its core routes -- a single blended figure
// underestimates these badly, so strong-rail countries use this instead.
const HIGH_SPEED_RAIL_KMH = 250;
const CONVENTIONAL_RAIL_KMH = 110;
const RAIL_FIXED_OVERHEAD_H = 0.75;
const ROAD_AVG_KMH = 80;

export function recommendMode(distanceKm: number, railLikely: boolean): { mode: TransportMode; rationale: string } {
  if (distanceKm < 150) {
    return { mode: 'road', rationale: 'Short hop — driving or a local train is usually quicker door-to-door than flying.' };
  }
  if (distanceKm < 700 && railLikely) {
    return { mode: 'rail', rationale: 'Rail is typically competitive with flying at this distance once airport time is counted.' };
  }
  if (distanceKm < 400) {
    return { mode: 'road', rationale: 'Too short to be worth flying; road or rail will be faster overall.' };
  }
  return { mode: 'flight', rationale: 'Long enough that flying wins clearly, even allowing for airport overhead.' };
}

export function estimateHours(distanceKm: number, mode: TransportMode, highSpeedRail = false): number {
  if (mode === 'flight') return distanceKm / FLIGHT_CRUISE_KMH + FLIGHT_FIXED_OVERHEAD_H;
  if (mode === 'rail') {
    return distanceKm / (highSpeedRail ? HIGH_SPEED_RAIL_KMH : CONVENTIONAL_RAIL_KMH) + RAIL_FIXED_OVERHEAD_H;
  }
  return distanceKm / ROAD_AVG_KMH;
}

// Very rough per-km costs. Real fares vary enormously by route, timing and
// class -- these are a planning starting point, not a quote.
const COST_PER_KM_GBP: Record<TransportMode, number> = {
  flight: 0.11,
  rail: 0.18,
  road: 0.14,
};
const FLIGHT_MIN_COST_GBP = 60;

export function estimateCostGBP(distanceKm: number, mode: TransportMode): number {
  const raw = distanceKm * COST_PER_KM_GBP[mode];
  return mode === 'flight' ? Math.max(FLIGHT_MIN_COST_GBP, raw) : raw;
}

export interface TransferInfo {
  airport: PlanningAirport;
  distanceToCityKm: number; // exact
  estimatedTransferMinutes: number; // estimated
}

// Airport-to-city transfer, computed from real coordinates for the distance,
// with time estimated at a conservative average speed that accounts for
// urban approach rather than open road.
export function transferForAirport(iata: string): TransferInfo | null {
  const airport = PLANNING_AIRPORTS_BY_IATA[iata];
  if (!airport) return null;
  const distanceToCityKm = haversineKm(airport.lat, airport.lng, airport.cityLat, airport.cityLng);
  return {
    airport,
    distanceToCityKm,
    estimatedTransferMinutes: Math.round((distanceToCityKm / 45) * 60 + 10),
  };
}

export function planLeg(
  from: { city: string; lat: number; lng: number },
  to: { city: string; lat: number; lng: number },
  railLikely: boolean
): LegPlan {
  const distanceKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const { mode, rationale } = recommendMode(distanceKm, railLikely);
  return {
    fromCity: from.city,
    toCity: to.city,
    distanceKm,
    recommendedMode: mode,
    rationale,
    estimatedHours: estimateHours(distanceKm, mode, railLikely),
    estimatedCostGBP: estimateCostGBP(distanceKm, mode),
  };
}

// Countries with genuinely strong intercity rail, where rail is a real
// alternative to flying at medium distances. Deliberately conservative --
// only listing places where this is unambiguously true.
export const STRONG_RAIL_COUNTRIES = new Set([
  'Japan', 'France', 'Germany', 'Spain', 'Italy', 'United Kingdom',
  'Netherlands', 'Austria', 'Czechia', 'Sweden', 'Portugal', 'South Korea',
]);
