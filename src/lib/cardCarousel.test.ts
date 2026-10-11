import { describe, expect, it } from 'vitest';
import { ringLead, ringPose, settled, shortestTarget, snapTarget, springStep } from './cardCarousel';

describe('card ring', () => {
  it('shows the lead card at the front, flat and full size', () => {
    const p = ringPose(0, 0, 4);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.scale).toBe(1);
    expect(p.rotateY).toBeCloseTo(0);
    expect(p.shade).toBe(0);
    expect(p.z).toBe(100);
  });

  it('stands the others round the circle: beside it, higher, smaller and behind', () => {
    const right = ringPose(1, 0, 4);
    const left = ringPose(3, 0, 4);
    const back = ringPose(2, 0, 4);
    expect(right.x).toBeGreaterThan(0.2);
    expect(left.x).toBeCloseTo(-right.x);
    expect(right.y).toBeLessThan(0);
    expect(right.scale).toBeLessThan(1);
    expect(right.rotateY).toBeLessThan(0);
    expect(left.rotateY).toBeGreaterThan(0);
    // The card behind is centred, highest, smallest and palest, so it
    // peeks out over the top of the lead card.
    expect(back.x).toBeCloseTo(0);
    expect(back.y).toBeLessThan(right.y);
    expect(back.scale).toBeLessThan(right.scale);
    expect(back.shade).toBeGreaterThan(right.shade);
    expect(back.z).toBeLessThan(right.z);
  });

  it('turns smoothly: halfway between two cards they share the front', () => {
    const a = ringPose(0, 0.5, 4);
    const b = ringPose(1, 0.5, 4);
    expect(a.x).toBeCloseTo(-b.x);
    expect(a.scale).toBeCloseTo(b.scale);
  });

  it('wraps round, so the ring has no ends', () => {
    expect(ringLead(0, 4)).toBe(0);
    expect(ringLead(3.6, 4)).toBe(0);
    expect(ringLead(-0.6, 4)).toBe(3);
    expect(ringLead(9, 4)).toBe(1);
  });

  it('brings a tapped card forward the short way round', () => {
    expect(shortestTarget(0, 3, 4)).toBe(-1);
    expect(shortestTarget(0, 1, 4)).toBe(1);
    expect(shortestTarget(5, 0, 4)).toBe(4);
    expect(shortestTarget(0, 2, 5)).toBe(2);
  });

  it('snaps a swipe to the nearest card, carried on by a flick', () => {
    expect(snapTarget(0.3, 0)).toBe(0);
    expect(snapTarget(0.3, 8)).toBe(1);
    expect(snapTarget(0.1, -40)).toBe(-1);
  });

  it('settles on the target like a magnet, overshooting a little', () => {
    let s = { pos: 0, vel: 0 };
    let peak = 0;
    for (let i = 0; i < 240 && !settled(s.pos, s.vel, 1); i++) {
      s = springStep(s.pos, s.vel, 1, 1 / 60);
      peak = Math.max(peak, s.pos);
    }
    expect(settled(s.pos, s.vel, 1)).toBe(true);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.1);
  });

  it('keeps a single card still and stops the turn when motion is reduced', () => {
    expect(ringPose(0, 0.4, 1)).toEqual({ x: 0, y: 0, scale: 1, rotateY: 0, shade: 0, z: 100 });
    expect(ringPose(1, 0, 4, true).rotateY).toBe(0);
  });
});
