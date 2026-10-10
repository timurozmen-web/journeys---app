// The cards carousel: card faces in a horizontal rail that snaps each one
// to the centre. These turn the rail's scroll position into which card is
// in front and how far every other card sits from the centre, which drives
// the tilt, shrink and fade as the rail spins.

/** How many card slots each card is from the centre (0 = in front, ±1 = either side). */
export function slotOffset(index: number, scrollLeft: number, slotWidth: number): number {
  if (slotWidth <= 0) return index;
  return index - scrollLeft / slotWidth;
}

/** The card nearest the centre, clamped to the cards there are. */
export function leadIndex(scrollLeft: number, slotWidth: number, count: number): number {
  if (count <= 0 || slotWidth <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / slotWidth)));
}

/** The look of a card at a given offset: tilted away, smaller and dimmer the further out. */
export function cardPose(offset: number, reducedMotion = false): { rotateY: number; scale: number; opacity: number } {
  const d = Math.max(-1.5, Math.min(1.5, offset));
  const near = Math.min(1, Math.abs(d));
  return {
    rotateY: reducedMotion ? 0 : -d * 16,
    scale: 1 - near * 0.12,
    opacity: 1 - near * 0.45,
  };
}
