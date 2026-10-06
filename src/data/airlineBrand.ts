// Airline codes and brand colours, for the coloured badge that stands in
// for an airline on itinerary cards (and behind its logo when the image
// can't load).

// Name -> correct IATA code, for the fallback initials badge (and as a
// secondary lookup key for the logo table above, in case the stored
// airline name doesn't exactly match). Flight numbers sometimes use an
// ICAO-style prefix (e.g. "EZY8540") that isn't the real IATA code
// ("U2" for easyJet), so name matching is used ahead of prefix-parsing.
export const AIRLINE_CODES: Record<string, string> = {
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

// Real brand colours for the fallback badge, used only when there's no
// logo image for this airline (or it's not in the name-matched table).
export const AIRLINE_COLORS: Record<string, string> = {
  BA: '#075AAA', U2: '#FF6600', IB: '#D7192D', VS: '#E10A0A', LH: '#05164D',
  QR: '#5C0632', EK: '#D71921', AF: '#002157', KL: '#00A1DE', DL: '#C8102E',
  UA: '#002244', AA: '#0078D2', TK: '#C70A0E', SQ: '#F99F1E', QF: '#E40000',
  AZ: '#009B48', FR: '#073590',
};

// The IATA code and brand colour for a flight. The stored airline name
// wins over the flight number, because numbers sometimes carry the ICAO
// prefix ("EZY8540") rather than the IATA one ("U2"). Sub-brands
// ("BA Cityflyer", "BA Euroflyer") fly under their parent's code.
export function airlineBadge(flightNo: string | null, airline: string | null): { code: string; colour: string | null } {
  const name = (airline ?? '').trim().toLowerCase();
  let code = AIRLINE_CODES[name];
  if (!code && /^ba\b|british airways/.test(name)) code = 'BA';
  if (!code && flightNo) {
    const compact = flightNo.trim().toUpperCase().replace(/\s+/g, '');
    const m = compact.match(/^([A-Z][A-Z0-9]|[0-9][A-Z])(?=\d)/);
    if (m) code = m[1];
  }
  if (!code) code = (airline ?? '').trim().slice(0, 2).toUpperCase();
  return { code, colour: AIRLINE_COLORS[code] ?? null };
}
