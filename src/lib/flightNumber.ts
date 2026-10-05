import { CARRIERS } from './creditingEngine';

// The airline a flight number belongs to, from its two-character IATA prefix
// ("BA866" -> British Airways). Your own past flights are checked first, so
// carriers outside the crediting list (easyJet's "U2") are learnt from use.
export function airlineFromFlightNo(flightNo: string, history: { flightNo: string | null; airline: string }[]): string | null {
  const prefix = flightNo.trim().toUpperCase().replace(/\s+/g, '').slice(0, 2);
  if (!/^[A-Z0-9]{2}$/.test(prefix) || /^\d{2}$/.test(prefix)) return null;
  const known = history.find((f) => f.flightNo && f.flightNo.trim().toUpperCase().replace(/\s+/g, '').startsWith(prefix) && f.airline);
  if (known) return known.airline;
  return CARRIERS.find((c) => c.code === prefix)?.name ?? null;
}
