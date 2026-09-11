import type { Trip } from '../types';

export interface TripGap {
  missingOutbound: boolean;
  missingReturn: boolean;
}

// A trip with somewhere to stay needs a way there and a way back. This is
// deliberately a simple heuristic (hotel present + fewer than 2 flights),
// not real airport/date matching against each hotel -- good enough to
// catch the real case ("Budapest has a hotel, no flights at all") without
// false-flagging trips that genuinely don't need flights logged (a single
// local hotel stay with no travel tracked isn't "incomplete").
export function checkTripCompleteness(trip: Trip): TripGap | null {
  if (trip.hotels.length === 0) return null; // nothing to anchor a journey to -- not flaggable
  const flightCount = trip.flights.length;
  const gap: TripGap = { missingOutbound: flightCount === 0, missingReturn: flightCount < 2 };
  return gap.missingOutbound || gap.missingReturn ? gap : null;
}

export function isTripIncomplete(trip: Trip): boolean {
  return checkTripCompleteness(trip) !== null;
}

// Google Flights parses a plain-language "q=" query reasonably reliably,
// and doesn't need an API key or documented deep-link params (which are
// undocumented/fragile) the way a fully prefilled search would.
function friendlyDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function flightSearchUrl(destination: string, dateOut: string, dateBack?: string): string {
  const q = dateBack
    ? `Flights to ${destination} on ${friendlyDate(dateOut)} returning ${friendlyDate(dateBack)}`
    : `Flights to ${destination} on ${friendlyDate(dateOut)}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export function returnFlightSearchUrl(origin: string, date: string): string {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${origin} on ${friendlyDate(date)}`)}`;
}

export function tripGapDescription(trip: Trip, gap: TripGap): string[] {
  const destination = trip.title.split(/[·+]/)[0].trim();
  const notes: string[] = [];
  if (gap.missingOutbound && gap.missingReturn) notes.push(`No flights logged to or from ${destination}`);
  else if (gap.missingOutbound) notes.push(`No outbound flight logged to ${destination}`);
  else if (gap.missingReturn) notes.push(`No return flight logged from ${destination}`);
  return notes;
}
