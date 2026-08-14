import { AIRPORTS } from '../data/airports';
import type { Flight } from '../types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Great-circle distance between two points, in km.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function flightDistanceKm(flight: Flight): number {
  const stops = [flight.from, ...flight.via, flight.to];
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = AIRPORTS[stops[i]];
    const b = AIRPORTS[stops[i + 1]];
    if (!a || !b) continue;
    total += haversineKm(a.lat, a.lng, b.lat, b.lng);
  }
  return total;
}

// Flight time is genuinely estimated, not tracked -- ~800km/h average
// cruise speed, plus a flat 40 minutes for taxi/takeoff/climb/descent per
// leg, which is what actually makes short flights feel disproportionately
// slower than pure cruise speed would suggest.
export function estimateFlightHours(flight: Flight): number {
  const legs = 1 + flight.via.length;
  const distanceKm = flightDistanceKm(flight);
  return distanceKm / 800 + legs * (40 / 60);
}
