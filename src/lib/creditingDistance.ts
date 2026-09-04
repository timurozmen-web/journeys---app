import { AIRPORTS } from '../data/airports';
import { loadGlobalAirports } from '../data/globalAirportsLoader';
import { haversineKm } from './travelStats';

const KM_TO_MI = 0.621371;

// Looks up an IATA code against the curated set first (already in memory),
// falling back to the full ~3,270-airport dataset used by Plan/Discover.
export async function distanceMilesBetween(fromCode: string, toCode: string): Promise<number | null> {
  const from = fromCode.trim().toUpperCase();
  const to = toCode.trim().toUpperCase();
  if (!from || !to || from === to) return null;

  const lookup = async (code: string) => {
    const local = AIRPORTS[code];
    if (local) return local;
    const global = await loadGlobalAirports();
    const match = global.find((a) => a.iata === code);
    return match ? { lat: match.lat, lng: match.lng } : null;
  };

  const [a, b] = await Promise.all([lookup(from), lookup(to)]);
  if (!a || !b) return null;
  return Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng) * KM_TO_MI);
}
