export interface GlobalAirport {
  iata: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  large?: boolean;
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
