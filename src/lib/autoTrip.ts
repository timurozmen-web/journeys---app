import type { Trip, Flight } from '../types';

// Common UK airport codes -- used to detect "flew back to the UK", which
// resets trip continuity even across consecutive calendar days.
const UK_AIRPORTS = new Set([
  'LHR', 'LGW', 'LTN', 'LCY', 'STN', 'SEN', // London
  'MAN', 'BHX', 'EDI', 'GLA', 'BRS', 'NCL', 'LBA', 'LPL', 'EMA', 'ABZ', 'BFS', 'BEB', 'SOU',
]);

const GREATER_LONDON_BOROUGHS = new Set([
  'london', 'greater london', 'westminster', 'camden', 'islington', 'hackney', 'tower hamlets',
  'greenwich', 'lewisham', 'southwark', 'lambeth', 'wandsworth', 'hammersmith', 'fulham',
  'kensington', 'chelsea', 'brent', 'ealing', 'hounslow', 'richmond', 'kingston', 'merton',
  'sutton', 'croydon', 'bromley', 'bexley', 'havering', 'barking', 'dagenham', 'redbridge',
  'newham', 'waltham forest', 'haringey', 'enfield', 'barnet', 'harrow', 'hillingdon',
  'canary wharf', 'city of london', 'borehamwood', 'heathrow',
]);

export function isLondonArea(city: string | null, country: string): boolean {
  if (country !== 'United Kingdom') return false;
  if (!city) return false;
  return GREATER_LONDON_BOROUGHS.has(city.trim().toLowerCase());
}

export interface TripSuggestion {
  tripId: string | null; // an existing trip to attach to, if one fits
  tripType: 'work' | 'leisure';
  suggestedTitle: string; // used only if no existing trip fits and a new one is needed
  reason: string; // human-readable, shown to the user so the guess is checkable
}

export function suggestTripAssignment(
  date: string,
  city: string | null,
  country: string,
  trips: Trip[],
  flights: Flight[]
): TripSuggestion {
  const tripType: 'work' | 'leisure' = isLondonArea(city, country) ? 'work' : 'leisure';

  // Look for an existing trip of the same type whose known coverage ends
  // exactly when this stay begins -- i.e. genuinely back-to-back.
  const candidate = trips
    .filter((t) => t.tripType === tripType && t.end === date)
    .sort((a, b) => b.end.localeCompare(a.end))[0];

  if (candidate) {
    // Exception: a flight landing back in the UK between the trip's last
    // known day and this new stay counts as a reset, even on consecutive
    // calendar days -- a night at home breaks trip continuity.
    const resetFlight = flights.find(
      (f) => f.date && f.date >= candidate.end && f.date <= date && UK_AIRPORTS.has(f.to)
    );
    if (!resetFlight) {
      return { tripId: candidate.id, tripType, suggestedTitle: candidate.title, reason: `Extends "${candidate.title}", which was running through ${candidate.end}.` };
    }
    return {
      tripId: null, tripType,
      suggestedTitle: tripType === 'work' ? (city ?? 'London') : (city ?? country),
      reason: `A flight back to the UK (${resetFlight.to}) on ${resetFlight.date} came between -- starting a new trip instead of extending "${candidate.title}".`,
    };
  }

  return {
    tripId: null, tripType,
    suggestedTitle: tripType === 'work' ? (city ?? 'London') : (city ?? country),
    reason: tripType === 'work' ? 'London stay -- defaulting to a work trip.' : 'No ongoing trip to extend -- this will start a new one.',
  };
}
