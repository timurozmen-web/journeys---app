// Real, researched rail journey times for specific city pairs -- checked
// first, before falling back to tripPlanner.ts's generic distance/speed
// formula. Rail routes are rarely straight lines and a flat average
// speed badly misjudges specific well-known corridors (the formula put
// Tokyo-Kyoto at under 1.5 hours; the real Shinkansen is ~2h20m), so a
// looked-up real figure is always preferred over the geometry-based
// guess wherever one has actually been researched.
//
// This is a starter set, not exhaustive -- currently the Tokaido/Sanyo
// Shinkansen corridor (Tokyo-Nagoya-Kyoto-Osaka-Hiroshima-Fukuoka),
// since that's the rail network this app's Japan coverage actually
// touches. Extending to other countries' rail networks (France's TGV,
// Spain's AVE, etc.) is a natural next step, not done here.
export interface RailConnection {
  cityA: string;
  cityB: string;
  minutes: number;
  source: string;
  confidence: 'High' | 'Medium';
  notes?: string;
}

export const RAIL_CONNECTIONS: RailConnection[] = [
  { cityA: 'Tokyo', cityB: 'Nagoya', minutes: 100, source: 'Multiple Shinkansen timetable sources, fastest Nozomi', confidence: 'High' },
  { cityA: 'Tokyo', cityB: 'Kyoto', minutes: 140, source: 'kyotostation.com, japantravel.com -- fastest Nozomi ~2h20m', confidence: 'High' },
  { cityA: 'Tokyo', cityB: 'Osaka', minutes: 141, source: 'Wikipedia (Nozomi train), osakastation.com -- fastest Nozomi 2h21m', confidence: 'High' },
  { cityA: 'Tokyo', cityB: 'Hiroshima', minutes: 235, source: 'japanbullettrain.com, trulytokyo.com -- fastest Nozomi ~3h50m-4h', confidence: 'High' },
  { cityA: 'Tokyo', cityB: 'Fukuoka', minutes: 285, source: 'Wikipedia (Nozomi train) -- fastest Nozomi Tokyo-Hakata 4h45m', confidence: 'High' },
  { cityA: 'Nagoya', cityB: 'Kyoto', minutes: 37, source: 'kyotostation.com -- as little as 37 minutes eastbound', confidence: 'High' },
  { cityA: 'Nagoya', cityB: 'Osaka', minutes: 48, source: 'osakastation.com -- Nozomi 47-50 minutes', confidence: 'High' },
  { cityA: 'Kyoto', cityB: 'Osaka', minutes: 14, source: 'kyotostation.com, osakastation.com -- 12-15 minutes, both directions agree', confidence: 'High' },
  { cityA: 'Osaka', cityB: 'Hiroshima', minutes: 82, source: 'japansophy.com, shinkansen-ticket.com, japanrailpassnow.com -- three independent sources agree on 1h20-25m', confidence: 'High' },
  // Derived by subtracting adjacent directly-cited segments along the
  // same continuous line (Tokyo-Kyoto-Hiroshima-Fukuoka is one route,
  // not separate journeys) rather than independently researched --
  // marked accordingly, still far more accurate than the geometry
  // formula since it's grounded in the real cited segments either side.
  { cityA: 'Kyoto', cityB: 'Hiroshima', minutes: 95, source: 'Derived: Tokyo-Hiroshima (235min) minus Tokyo-Kyoto (140min)', confidence: 'Medium' },
  { cityA: 'Kyoto', cityB: 'Fukuoka', minutes: 145, source: 'Derived: Tokyo-Fukuoka (285min) minus Tokyo-Kyoto (140min)', confidence: 'Medium' },
  { cityA: 'Osaka', cityB: 'Fukuoka', minutes: 144, source: 'Derived: Tokyo-Fukuoka (285min) minus Tokyo-Osaka (141min)', confidence: 'Medium' },
  { cityA: 'Hiroshima', cityB: 'Fukuoka', minutes: 60, source: 'Derived from Tokyo-Fukuoka minus Tokyo-Hiroshima (~50-55min); rounded to the commonly-cited ~1 hour figure for this well-known segment', confidence: 'Medium' },
];

function normalize(city: string): string {
  return city.trim().toLowerCase().replace(/^shin-/, '').replace(' station', '');
}

export function findRailConnection(cityA: string | null, cityB: string | null): RailConnection | null {
  if (!cityA || !cityB) return null;
  const a = normalize(cityA);
  const b = normalize(cityB);
  return RAIL_CONNECTIONS.find((c) => {
    const ca = normalize(c.cityA);
    const cb = normalize(c.cityB);
    return (ca === a && cb === b) || (ca === b && cb === a);
  }) ?? null;
}
