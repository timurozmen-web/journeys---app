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
