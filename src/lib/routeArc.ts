// Geometry for the gold route arc on the Home hero: a dotted curve from
// origin to destination, with a marker showing how far through the trip
// today is.

// The arc's curve, in a 342 x 54 viewBox (ends low, peak in the middle).
export const ARC = { x0: 8, y0: 46, c1x: 110, c1y: -8, c2x: 232, c2y: -8, x1: 334, y1: 46 } as const;
export const ARC_PATH = `M${ARC.x0} ${ARC.y0} C ${ARC.c1x} ${ARC.c1y}, ${ARC.c2x} ${ARC.c2y}, ${ARC.x1} ${ARC.y1}`;

// Point on the arc at t (0 = origin, 1 = destination), clamped.
export function arcPoint(t: number): { x: number; y: number } {
  const u = Math.max(0, Math.min(1, t));
  const v = 1 - u;
  const b0 = v * v * v, b1 = 3 * v * v * u, b2 = 3 * v * u * u, b3 = u * u * u;
  return {
    x: b0 * ARC.x0 + b1 * ARC.c1x + b2 * ARC.c2x + b3 * ARC.x1,
    y: b0 * ARC.y0 + b1 * ARC.c1y + b2 * ARC.c2y + b3 * ARC.y1,
  };
}

// How far through a trip today is: 0 before it starts, 1 on the last
// day. Day 1 of 21 sits just past the origin, not on it, so a trip
// that's under way always looks under way.
export function tripProgress(dayIndex: number, totalDays: number, underway: boolean): number {
  if (!underway || totalDays <= 0) return 0;
  return Math.max(0, Math.min(1, dayIndex / totalDays));
}
