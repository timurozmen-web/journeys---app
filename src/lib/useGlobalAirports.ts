import { useEffect, useState } from 'react';
import { loadGlobalAirports, type GlobalAirport } from '../data/globalAirportsLoader';

// The full airport list, keyed by IATA code, loaded on first use (it's a
// separate chunk). null until it arrives -- maps draw curated airports
// straight away and fill in any others a moment later.
let shared: Map<string, GlobalAirport> | null = null;

export function useGlobalAirports(): Map<string, GlobalAirport> | null {
  const [map, setMap] = useState(shared);
  useEffect(() => {
    if (shared) return;
    let cancelled = false;
    loadGlobalAirports().then((list) => {
      shared = new Map(list.map((a) => [a.iata, a]));
      if (!cancelled) setMap(shared);
    });
    return () => { cancelled = true; };
  }, []);
  return map;
}
