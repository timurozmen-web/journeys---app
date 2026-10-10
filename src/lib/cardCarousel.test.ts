import { describe, expect, it } from 'vitest';
import { cardPose, leadIndex, slotOffset } from './cardCarousel';

describe('card carousel', () => {
  it('puts the card nearest the centre in front', () => {
    expect(leadIndex(0, 300, 4)).toBe(0);
    expect(leadIndex(440, 300, 4)).toBe(1);
    expect(leadIndex(460, 300, 4)).toBe(2);
    expect(leadIndex(5000, 300, 4)).toBe(3);
  });

  it('measures each card from the centre in slots', () => {
    expect(slotOffset(2, 300, 300)).toBe(1);
    expect(slotOffset(0, 150, 300)).toBe(-0.5);
  });

  it('shows the lead card flat and full size, neighbours tilted away and dimmed', () => {
    expect(cardPose(0)).toEqual({ rotateY: -0, scale: 1, opacity: 1 });
    const right = cardPose(1);
    expect(right.rotateY).toBe(-16);
    expect(right.scale).toBeCloseTo(0.88);
    expect(right.opacity).toBeCloseTo(0.55);
    expect(cardPose(-1).rotateY).toBe(16);
  });

  it('stops tilting when motion is reduced', () => {
    expect(cardPose(1, true).rotateY).toBe(0);
  });
});
