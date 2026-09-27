// Night Flight map colours as literal hex, for the places CSS variables
// can't reach: Leaflet layer options, marker HTML strings and SVG
// attributes. Keep in step with --map-* and --brand in tokens.css.
export const MAP = {
  sea: '#11141A',
  land: '#252A35',
  landBorder: '#11141A',
  route: '#D9B77C',
  stop: '#D9B77C',
  stopRing: '#0B0D12',
  home: '#F4F2EE',
  text: '#F4F2EE',
  textSub: '#B3B0AA',
  panel: '#14171E',
  // Visited-country fill, fewest nights to most: dim bronze up to gold.
  visitedShades: ['#4A4234', '#6E5E43', '#9E8455', '#D9B77C'],
} as const;
