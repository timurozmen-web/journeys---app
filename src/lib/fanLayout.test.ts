import { describe, expect, test } from 'vitest';
import { fanPositions } from './fanLayout';

describe('fanPositions', () => {
  test('spreads items left to right, all above the button', () => {
    const p = fanPositions(4, 140);
    expect(p).toHaveLength(4);
    expect(p[0].x).toBeLessThan(p[1].x);
    expect(p[2].x).toBeLessThan(p[3].x);
    for (const pt of p) expect(pt.y).toBeLessThan(0);
  });

  test('is symmetric about the button', () => {
    const p = fanPositions(4, 140);
    expect(p[0].x).toBe(-p[3].x);
    expect(p[0].y).toBe(p[3].y);
    expect(p[1].y).toBeLessThan(p[0].y); // inner items sit higher
  });

  test('one item goes straight up; none gives nothing', () => {
    expect(fanPositions(1, 100)).toEqual([{ x: 0, y: -100 }]);
    expect(fanPositions(0, 100)).toEqual([]);
  });
});
