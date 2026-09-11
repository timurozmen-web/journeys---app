import { useEffect, useState } from 'react';
import { loadWorldCities } from '../data/worldCitiesLoader';
import { haversineKm } from './travelStats';
import { useHomeLocation } from './useLiveData';
import type { Trip } from '../types';

// Threshold picked to match the two examples given directly: Birmingham
// (~163km from London, no flight needed -- train/car is the obvious
// choice) should be excluded, Paris (~344km, and separated by sea) should
// still be flagged. 250km sits cleanly between the two.
const NO_FLIGHT_NEEDED_KM = 250;

function findCityCoords(cities: { name: string; lat: number; lng: number }[], name: string) {
  const target = name.trim().toLowerCase();
  return cities.find((c) => c.name.toLowerCase() === target) ?? null;
}

// A trip's "destination city" for this purpose -- the featured
// destination (most nights), same rule the destination photo uses, so
// this stays consistent with what the trip visually represents.
function tripDestinationCity(trip: Trip): string | null {
  if (trip.hotels.length === 0) return null;
  const byCity = new Map<string, number>();
  for (const h of trip.hotels) {
    if (!h.city) continue;
    byCity.set(h.city, (byCity.get(h.city) ?? 0) + h.nights);
  }
  let best: string | null = null;
  let bestNights = -1;
  for (const [city, nights] of byCity) {
    if (nights > bestNights) { best = city; bestNights = nights; }
  }
  return best;
}

// Returns the set of trip ids close enough to home that missing flights
// shouldn't be flagged as incomplete -- computed once per home-location/
// trip-list change rather than per render per trip. Cities not found in
// the dataset are left un-exempt (can't confirm proximity, so the
// existing "needs flights" behaviour stays the safe default).
export function useFlightExemptTripIds(trips: Trip[]): Set<string> {
  const { data: home } = useHomeLocation();
  const [exempt, setExempt] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!home?.city) { setExempt(new Set()); return; }
      const cities = await loadWorldCities();
      const homeCoords = findCityCoords(cities, home.city);
      if (!homeCoords) { setExempt(new Set()); return; }
      const result = new Set<string>();
      for (const trip of trips) {
        const destCity = tripDestinationCity(trip);
        if (!destCity) continue;
        const destCoords = findCityCoords(cities, destCity);
        if (!destCoords) continue;
        const km = haversineKm(homeCoords.lat, homeCoords.lng, destCoords.lat, destCoords.lng);
        if (km <= NO_FLIGHT_NEEDED_KM) result.add(trip.id);
      }
      if (!cancelled) setExempt(result);
    })();
    return () => { cancelled = true; };
  }, [home?.city, trips]);

  return exempt;
}
