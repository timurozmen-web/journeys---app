import { useState } from 'react';

// Best-effort IATA code from the flight number's leading characters
// (e.g. "BA7029" -> "BA", "U2 2554" -> "U2"), falling back to the first
// two letters of the airline name if there's no flight number.
export function airlineCode(flightNo: string | null, airline: string): string {
  const fromNo = flightNo?.trim().split(/\s+/)[0]?.slice(0, 2);
  return (fromNo || airline.slice(0, 2)).toUpperCase();
}

// Square airline logos via Airhex's public logo endpoint, referenced by
// IATA code. These are the airlines' own trademarks -- shown here purely
// for identification (which airline this flight is), the same way the
// wallet already shows real hotel-brand logos. Falls back to a plain
// initials badge if the specific code has no logo or the request fails,
// so a missing image never breaks the layout.
export function AirlineLogo({ flightNo, airline, size = 28 }: { flightNo: string | null; airline: string; size?: number }) {
  const code = airlineCode(flightNo, airline);
  const [failed, setFailed] = useState(false);

  if (failed || !code) {
    return (
      <span style={{ width: size, height: size, borderRadius: size * 0.3, background: 'var(--ink)', color: '#fff', fontSize: size * 0.38, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {code || '✈'}
      </span>
    );
  }

  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.3, background: '#fff', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
      <img
        src={`https://content.airhex.com/content/logos/airlines_${code}_400_400_s.png`}
        alt={airline}
        onError={() => setFailed(true)}
        style={{ width: '82%', height: '82%', objectFit: 'contain' }}
      />
    </span>
  );
}
