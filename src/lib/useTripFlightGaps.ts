import { useMemo } from 'react';
import type { Trip } from '../types';
import { useHomeLocation } from './useLiveData';
import { useGlobalAirports } from './useGlobalAirports';
import { useFlightExemptTripIds } from './homeLocation';
import { AIRPORTS } from '../data/airports';
import { missingFlights, missingFlightsLabel, type Place } from './today';
import { checkTripCompleteness, tripGapDescription } from './tripCompleteness';

/**
 * For each trip still to come or under way, the flights it's missing in a
 * few words ("No flight to Helsinki or home"), judged from the flights it
 * has, or (with none logged) from its stays. Trips close enough to home
 * not to need flights are left alone.
 */
export function useTripFlightGaps(trips: Trip[], today: string): Map<string, string> {
  const airports = useGlobalAirports();
  const { data: home } = useHomeLocation();
  const exempt = useFlightExemptTripIds(trips);
  return useMemo(() => {
    const locate = (iata: string): Place | null => {
      const g = airports?.get(iata);
      if (g) return { lat: g.lat, lng: g.lng, city: g.city };
      const a = AIRPORTS[iata];
      return a ? { lat: a.lat, lng: a.lng, city: a.name } : null;
    };
    const homeAirport = airports && home?.city ? [...airports.values()].find((a) => a.city.toLowerCase() === home.city.toLowerCase()) : null;
    const homePlace = homeAirport ? { lat: homeAirport.lat, lng: homeAirport.lng } : null;
    const out = new Map<string, string>();
    for (const t of trips) {
      if (t.end < today || exempt.has(t.id)) continue;
      const missing = missingFlights(t, locate, homePlace);
      const gap = missing ? null : checkTripCompleteness(t);
      const label = missing ? missingFlightsLabel(missing) : gap ? tripGapDescription(t, gap)[0] : null;
      if (label) out.set(t.id, label);
    }
    return out;
  }, [trips, today, airports, home, exempt]);
}
