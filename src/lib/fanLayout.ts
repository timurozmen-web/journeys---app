// Positions for the + button's fan menu: n items spread evenly along an
// arc above the button, left to right. Angles are in degrees measured
// from the positive x-axis, so 180 is straight left and 90 straight up.
// Returns offsets from the button's centre, with y negative = upwards
// (screen coordinates).
export function fanPositions(n: number, radius: number, fromDeg = 162, toDeg = 18): { x: number; y: number }[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: -radius }];
  return Array.from({ length: n }, (_, i) => {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / (n - 1);
    const rad = (deg * Math.PI) / 180;
    return { x: Math.round(Math.cos(rad) * radius), y: -Math.round(Math.sin(rad) * radius) };
  });
}
