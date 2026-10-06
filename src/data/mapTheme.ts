// Map colours as literal hex, for the places CSS variables can't reach:
// Leaflet layer options, marker HTML strings and SVG attributes. Keep in
// step with --map-* and --brand2 in tokens.css. The look is a pencil
// sketch on paper: hatched land with a doubled ink outline, orange
// dashed routes, typewriter labels.
export const MAP = {
  sea: '#FBF9F4',
  seaLight: '#FBF9F4',
  land: '#ECE5D6',
  landLight: '#EFE9DC',
  graticule: 'rgba(18,18,18,.05)',
  landBorder: '#121212',
  hatch: 'rgba(18,18,18,.10)',
  route: '#F2551D',
  stop: '#F2551D',
  stopRing: '#121212',
  home: '#121212',
  text: '#121212',
  textSub: '#5E5A54',
  panel: '#FFFFFF',
  // Visited-country fill, fewest nights to most: pale sand up to orange.
  visitedShades: ['#E8D9C4', '#EDB99A', '#F28B5E', '#F2551D'],
  font: "'Space Mono', ui-monospace, Menlo, monospace",
  // Then's scratch map: a visited country is scratched off to orange,
  // with darker cross-hatched scratch marks over it.
  scratch: '#F2551D',
  scratchMark: '#A8360B',
} as const;
