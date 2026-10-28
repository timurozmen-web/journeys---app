// One key per country, for matching data sets that spell some names
// differently. The planner's country list (from the airports data) says
// "United Arab Emirates" and "Turkey" while the climate, crowd and hotel
// price tables say "UAE" and "Türkiye", so planning Dubai or Turkey from
// the full list found no weather, crowds or prices at all.
const SAME: Record<string, string> = {
  'united arab emirates': 'uae',
  'türkiye': 'turkey',
  turkiye: 'turkey',
  'united states of america': 'united states',
  usa: 'united states',
  czechia: 'czech republic',
  'great britain': 'united kingdom',
  uk: 'united kingdom',
};

export function countryKey(name: string): string {
  const n = name.trim().toLowerCase();
  return SAME[n] ?? n;
}

export function sameCountry(a: string, b: string): boolean {
  return countryKey(a) === countryKey(b);
}

// Cities, likewise. A stop named "Bogotá" or "Cancún", the way the agent
// writes them, found none of the hotel prices logged as "Bogota" and
// "Cancun", and a local name ("Lisboa", "München") none at all. Accents are
// dropped and local names mapped; one name may contain the other ("New York
// City" is New York).
const CITY: Record<string, string> = {
  'ciudad de mexico': 'mexico city',
  cdmx: 'mexico city',
  nyc: 'new york',
  lisboa: 'lisbon',
  roma: 'rome',
  milano: 'milan',
  munchen: 'munich',
  wien: 'vienna',
  praha: 'prague',
  kobenhavn: 'copenhagen',
};

function cityKey(name: string): string {
  // NFD splits "á" into "a" and its accent; "ø" and "æ" have no such split.
  const n = name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae');
  return CITY[n] ?? n;
}

export function sameCity(a: string, b: string): boolean {
  const x = cityKey(a);
  const y = cityKey(b);
  return x.includes(y) || y.includes(x);
}
