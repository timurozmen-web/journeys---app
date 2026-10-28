import type { Flight, LoyaltyProgramme } from '../types';
import { CARRIERS, runAdvisor, type Cabin, type ProgramId } from './creditingEngine';
import { airlineBadge } from '../data/airlineBrand';
import { haversineKm } from './travelStats';

// "Credit to" on a flight card: the crediting advisor's answer for a
// flight already logged, so it no longer needs its own screen to ask.

const KM_TO_MI = 0.621371;

const PROGRAMME_SHORT: Record<ProgramId, string> = { BA: 'BA Club', QR: 'Privilege Club', QF: 'Qantas', KF: 'KrisFlyer' };

/** Great-circle miles along a flight's legs (from, any stops, to), or null if an airport can't be placed. */
export function flightMiles(f: Pick<Flight, 'from' | 'via' | 'to'>, locate: (iata: string) => { lat: number; lng: number } | null): number | null {
  const stops = [f.from, ...(f.via ?? []), f.to].map((c) => locate(c.trim().toUpperCase()));
  if (stops.some((s) => !s)) return null;
  let km = 0;
  for (let i = 1; i < stops.length; i++) km += haversineKm(stops[i - 1]!.lat, stops[i - 1]!.lng, stops[i]!.lat, stops[i]!.lng);
  return Math.round(km * KM_TO_MI);
}

// Elite tiers the wallet already records, by the names programmes are
// stored under ("KrisFlyer / PPS Club" holds the Elite Gold).
const TIER_SOURCES: Record<ProgramId, RegExp> = { BA: /executive club|^ba club/i, QR: /privilege club/i, QF: /qantas/i, KF: /krisflyer/i };
export function tiersFrom(programmes: Pick<LoyaltyProgramme, 'name' | 'tier'>[]): Partial<Record<ProgramId, string>> {
  const out: Partial<Record<ProgramId, string>> = {};
  for (const id of Object.keys(TIER_SOURCES) as ProgramId[]) {
    const tier = programmes.find((p) => TIER_SOURCES[id].test(p.name) && p.tier)?.tier;
    if (tier) out[id] = tier;
  }
  return out;
}

export interface CreditPick {
  programme: ProgramId;
  label: string; // "KrisFlyer"
  amount: number;
  unit: string; // "miles", "Avios"
}

/**
 * Where a flight earns most, valued at each programme's redeemable rate:
 * the advisor's best-value programme. The fare level isn't logged, so a
 * standard fare is assumed (the figure is shown as approximate). Null for
 * an award seat (it earns nothing), a carrier none of the four programmes
 * partners with, or an own-metal flight with no price logged: BA, Qatar
 * and Qantas earn on what was paid there, so without a price the answer
 * would be decided by the gap rather than the flight.
 */
export function creditPick(f: Flight, miles: number | null, tiers: Partial<Record<ProgramId, string>>, ukDeparture: boolean): CreditPick | null {
  if (f.award || !miles) return null;
  const code = airlineBadge(f.flightNo, f.airline).code;
  const carrier = CARRIERS.some((c) => c.code === code) ? code : 'OTHER';
  const advice = runAdvisor({
    operatingCarrier: carrier, cabin: f.cabin as Cabin, fareLevel: 'standard',
    price: f.cost ?? undefined, distanceMiles: miles, ukDeparture, tiers,
  });
  if (f.cost == null && advice.results.some((r) => r.relationship === 'own')) return null;
  const best = advice.bestValue;
  if (!best?.redeemable || best.redeemable.amount <= 0) return null;
  const label = PROGRAMME_SHORT[best.program];
  // "KrisFlyer miles" under a KrisFlyer label reads as "miles".
  return { programme: best.program, label, amount: best.redeemable.amount, unit: best.redeemable.name.replace(label, '').trim() || best.redeemable.name };
}
