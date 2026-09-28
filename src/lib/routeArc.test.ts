import { describe, expect, test } from 'vitest';
import { ARC, arcPoint, tripProgress } from './routeArc';

describe('arcPoint', () => {
  test('starts at the origin and ends at the destination', () => {
    expect(arcPoint(0)).toEqual({ x: ARC.x0, y: ARC.y0 });
    expect(arcPoint(1)).toEqual({ x: ARC.x1, y: ARC.y1 });
  });

  test('the middle is the top of the arc, halfway across', () => {
    const mid = arcPoint(0.5);
    expect(mid.x).toBeCloseTo((ARC.x0 + ARC.x1) / 2);
    expect(mid.y).toBeLessThan(ARC.y0);
  });

  test('clamps outside 0-1', () => {
    expect(arcPoint(-1)).toEqual(arcPoint(0));
    expect(arcPoint(2)).toEqual(arcPoint(1));
  });
});

describe('tripProgress', () => {
  test('upcoming trips sit at the origin', () => {
    expect(tripProgress(1, 21, false)).toBe(0);
  });

  test('under way: day 1 is just past the start, the last day is the end', () => {
    expect(tripProgress(1, 21, true)).toBeCloseTo(1 / 21);
    expect(tripProgress(21, 21, true)).toBe(1);
  });
});
