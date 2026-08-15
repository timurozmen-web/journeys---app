export interface GlobalAirport {
  iata: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
}

let cached: GlobalAirport[] | null = null;

// Dynamic import keeps this ~140KB dataset out of the main bundle --
// only fetched when planning actually needs country/airport coverage
// beyond the curated set.
export async function loadGlobalAirports(): Promise<GlobalAirport[]> {
  if (cached) return cached;
  const mod = await import('./globalAirports.json');
  cached = mod.default as GlobalAirport[];
  return cached;
}

export async function allPlanningCountries(): Promise<string[]> {
  const airports = await loadGlobalAirports();
  return [...new Set(airports.map((a) => a.country))].sort();
}

export async function airportsForCountryGlobal(country: string): Promise<GlobalAirport[]> {
  const airports = await loadGlobalAirports();
  return airports.filter((a) => a.country === country);
}

export async function nearestAirportGlobal(lat: number, lng: number, country?: string): Promise<GlobalAirport | null> {
  const airports = await loadGlobalAirports();
  const pool = country ? airports.filter((a) => a.country === country) : airports;
  if (pool.length === 0) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dist = (a: GlobalAirport) => {
    const dLat = toRad(a.lat - lat);
    const dLng = toRad(a.lng - lng);
    return dLat * dLat + dLng * dLng; // relative comparison only -- no need for true haversine here
  };
  return pool.reduce((best, a) => (dist(a) < dist(best) ? a : best), pool[0]);
}
