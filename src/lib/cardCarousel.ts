// The cards carousel: card faces stood round a ring, seen from a little
// above, like a carousel at the fair. The lead card is at the front, full
// size; the others sit round the circle behind it, smaller, higher and
// paler the further back they are, so you can see the cards behind. These
// turn the ring's rotation (in cards: 0 = card 0 in front, 1 = card 1 ...)
// into each card's pose, and drive the drag, the magnet snap and the
// spring that settles it.

export interface RingPose {
  x: number;       // across, as a fraction of the stage width (0 = centre)
  y: number;       // up, as a fraction of a card's height (negative = higher)
  scale: number;
  rotateY: number; // degrees: turned away from the centre at the sides
  shade: number;   // 0..1, how far it fades into the page behind it
  z: number;       // stacking order, front highest
}

const RADIUS_X = 0.31;  // how far out the side cards sit, of the stage width
const LIFT = 0.46;      // how much higher the back card sits, of a card's height
const BACK_SCALE = 0.6; // the back card's size against the front one's
const TURN = 24;        // degrees a card at the side is turned away
const BACK_SHADE = 0.55;

/** Where card `index` sits when the ring has turned to `rotation`. */
export function ringPose(index: number, rotation: number, count: number, reducedMotion = false): RingPose {
  if (count <= 1) return { x: 0, y: 0, scale: 1, rotateY: 0, shade: 0, z: 100 };
  const a = (2 * Math.PI * (index - rotation)) / count;
  const front = (Math.cos(a) + 1) / 2; // 1 at the front, 0 at the back
  const side = Math.sin(a);
  return {
    x: side * RADIUS_X,
    y: -(1 - front) * LIFT,
    scale: BACK_SCALE + (1 - BACK_SCALE) * front,
    rotateY: reducedMotion ? 0 : -side * TURN,
    shade: (1 - front) * BACK_SHADE,
    z: Math.round(front * 100),
  };
}

const wrap = (n: number, count: number) => ((n % count) + count) % count;

/** The card at the front, for any rotation (it wraps round). */
export function ringLead(rotation: number, count: number): number {
  if (count <= 0) return 0;
  return wrap(Math.round(rotation), count);
}

/** The rotation that brings `index` to the front the short way round. */
export function shortestTarget(rotation: number, index: number, count: number): number {
  if (count <= 0) return rotation;
  const from = Math.round(rotation);
  let d = wrap(index - from, count);
  if (d > count / 2) d -= count;
  return from + d;
}

/**
 * Where a swipe settles: the nearest card, carried on by a flick.
 * `velocity` is in cards a second; a hard flick carries on one card more
 * at most, so a swipe never spins past the card you were reaching for.
 */
export function snapTarget(rotation: number, velocity: number): number {
  const carry = Math.max(-1, Math.min(1, velocity * 0.12));
  return Math.round(rotation + carry);
}

/**
 * One step of the spring that pulls the ring onto its target, with a
 * touch of overshoot so a card lands like it's drawn in by a magnet.
 */
export function springStep(pos: number, vel: number, target: number, dt: number, stiffness = 170, damping = 20): { pos: number; vel: number } {
  const accel = stiffness * (target - pos) - damping * vel;
  const nextVel = vel + accel * dt;
  return { pos: pos + nextVel * dt, vel: nextVel };
}

/** True once the spring has come to rest on its target. */
export function settled(pos: number, vel: number, target: number): boolean {
  return Math.abs(target - pos) < 0.0015 && Math.abs(vel) < 0.01;
}
