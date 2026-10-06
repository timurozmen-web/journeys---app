import { describe, expect, it } from 'vitest';
import { ringTicks, spendTicks } from './statusRing';

const seg = (key: string, count: number) => ({ key, label: key, count, colour: key });

describe('ringTicks', () => {
  it('lays segments out in order and leaves the rest empty', () => {
    const t = ringTicks(10, [seg('stays', 3), seg('card', 2), seg('pending', 1)]);
    expect(t.map((x) => x?.key ?? null)).toEqual(['stays', 'stays', 'stays', 'card', 'card', 'pending', null, null, null, null]);
  });

  it('never draws more ticks than the target', () => {
    const t = ringTicks(5, [seg('stays', 4), seg('pending', 3)]);
    expect(t).toHaveLength(5);
    expect(t.filter((x) => x?.key === 'pending')).toHaveLength(1);
  });

  it('skips empty segments', () => {
    expect(ringTicks(3, [seg('promos', 0), seg('stays', 1)]).map((x) => x?.key ?? null)).toEqual(['stays', null, null]);
  });
});

describe('spendTicks', () => {
  it("shows Marriott's $9,628 of $23,000 with $312 booked as 41 ticks plus 2", () => {
    expect(spendTicks(9628, 312, 23000)).toEqual({ done: 41, pending: 2 });
  });
  it('caps at a full ring', () => {
    expect(spendTicks(30000, 500, 23000)).toEqual({ done: 100, pending: 0 });
  });
});
