// Airline identification badge. Originally hotlinked Airhex's public
// logo endpoint, but those come back with a diagonal "unlicensed use"
// watermark without a paid API key -- not something to ship. Clean
// colour-coded initials badge instead: reliable (no third-party network
// call that can fail or watermark), and the colours are the airlines'
// real brand colours, not invented ones.

// Name -> correct IATA code, from the airline brand reference pack.
// Matched by name first (reliable) with flight-number parsing only as a
// fallback for airlines not in this list -- flight numbers sometimes use
// an ICAO-style prefix (e.g. "EZY8540") that isn't the real IATA code
// ("U2" for easyJet), so name matching avoids mislabelling those.
const AIRLINE_CODES: Record<string, string> = {
  'british airways': 'BA', 'virgin atlantic': 'VS', 'singapore airlines': 'SQ', qantas: 'QF',
  ryanair: 'FR', easyjet: 'U2', lufthansa: 'LH', 'qatar airways': 'QR', 'cathay pacific': 'CX',
  'etihad airways': 'EY', emirates: 'EK', 'turkish airlines': 'TK', 'ita airways': 'AZ', iberia: 'IB',
  'wizz air': 'W6', 'japan airlines': 'JL', ana: 'NH', 'air france': 'AF', 'delta air lines': 'DL',
  klm: 'KL', 'united airlines': 'UA', 'american airlines': 'AA', 'latam airlines': 'LA', norwegian: 'DY',
  vueling: 'VY', 'royal jordanian': 'RJ', 'oman air': 'WY', 'gulf air': 'GF', 'air india': 'AI',
  'korean air': 'KE', 'tap air portugal': 'TP', 'aer lingus': 'EI', 'norse atlantic': 'N0', swiss: 'LX',
  'air canada': 'AC', 'air new zealand': 'NZ', sas: 'SK', finnair: 'AY', avianca: 'AV', indigo: '6E',
  'ethiopian airlines': 'ET', egyptair: 'MS', 'thai airways': 'TG', 'malaysia airlines': 'MH',
  'air china': 'CA', 'china eastern': 'MU', 'china southern': 'CZ', 'kenya airways': 'KQ',
  'philippine airlines': 'PR', 'royal air maroc': 'AT', icelandair: 'FI', 'alaska airlines': 'AS',
  jetblue: 'B6', 'southwest airlines': 'WN',
};

// Real brand colours for the airlines actually likely to show up here;
// everything else gets a neutral ink badge rather than a guessed colour.
const AIRLINE_COLORS: Record<string, string> = {
  BA: '#075AAA', U2: '#FF6600', IB: '#D7192D', VS: '#E10A0A', LH: '#05164D',
  QR: '#5C0632', EK: '#D71921', AF: '#002157', KL: '#00A1DE', DL: '#C8102E',
  UA: '#002244', AA: '#0078D2', TK: '#C70A0E', SQ: '#F99F1E', QF: '#E40000',
  AZ: '#009B48', FR: '#073590',
};

export function airlineCode(flightNo: string | null, airline: string): string {
  const byName = AIRLINE_CODES[airline.trim().toLowerCase()];
  if (byName) return byName;
  const fromNo = flightNo?.trim().split(/\s+/)[0]?.replace(/[0-9]/g, '').slice(0, 2);
  return (fromNo || airline.slice(0, 2)).toUpperCase();
}

export function AirlineLogo({ flightNo, airline, size = 28 }: { flightNo: string | null; airline: string; size?: number }) {
  const code = airlineCode(flightNo, airline);
  const bg = AIRLINE_COLORS[code] ?? 'var(--ink)';
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.3, background: bg, color: '#fff', fontSize: size * 0.36, fontWeight: 800, letterSpacing: '-.2px', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      {code || '✈'}
    </span>
  );
}
