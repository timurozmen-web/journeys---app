// The status ring on an expanded programme: one tick per night needed for
// the next tier (or one tick per 1% of a spend requirement), coloured by
// where each night came from. Ticks past the target are dropped; anything
// not yet earned or booked is left as an empty tick.

export interface RingSegment {
  key: string;
  label: string;
  count: number;
  colour: string; // a CSS colour, usually a token: 'var(--ink)'
}

/** One entry per tick: the segment it belongs to, or null for an empty tick. */
export function ringTicks(total: number, segments: RingSegment[]): (RingSegment | null)[] {
  const n = Math.max(0, Math.round(total));
  const ticks: (RingSegment | null)[] = [];
  for (const seg of segments) {
    for (let i = 0; i < Math.max(0, Math.round(seg.count)) && ticks.length < n; i++) ticks.push(seg);
  }
  while (ticks.length < n) ticks.push(null);
  return ticks;
}

/** Spend shown on the same ring: 100 ticks, each 1% of the requirement. */
export function spendTicks(current: number, pending: number, required: number): { done: number; pending: number } {
  if (required <= 0) return { done: 0, pending: 0 };
  const done = Math.min(100, Math.floor((current / required) * 100));
  const withPending = Math.min(100, Math.floor(((current + pending) / required) * 100));
  return { done, pending: withPending - done };
}
