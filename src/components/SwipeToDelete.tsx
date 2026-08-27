import { useRef, useState } from 'react';

const REVEAL_WIDTH = 76; // width of the exposed delete button once fully swiped
const TAP_THRESHOLD = 8; // px of movement below which this counts as a tap, not a swipe

/**
 * Wraps any row content with swipe-left-to-reveal-delete behaviour: swiping
 * left past a small threshold reveals a red delete button behind the row;
 * releasing snaps either fully open or fully closed depending on how far
 * the swipe went. A genuine tap (movement below the threshold) still fires
 * onClick normally, so existing tap-to-edit behaviour keeps working
 * unchanged -- only a deliberate horizontal swipe exposes delete.
 */
export function SwipeToDelete({
  children, onClick, onDelete, deleteLabel = 'Delete', wrapperStyle,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  onDelete: () => void;
  deleteLabel?: string;
  wrapperStyle?: React.CSSProperties;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startOffset: number; moved: boolean } | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startOffset: offset, moved: false };
    setDragging(true);
  }
  function handlePointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > TAP_THRESHOLD) d.moved = true;
    // Only allow dragging left (negative), and clamp to the reveal width.
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, d.startOffset + dx));
    setOffset(next);
  }
  function handlePointerUp() {
    const d = drag.current;
    setDragging(false);
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // Genuine tap, not a swipe -- close if already open, otherwise treat as a normal click.
      if (offset !== 0) setOffset(0);
      else onClick?.();
      return;
    }
    // Snap open or closed based on how far past halfway the swipe went.
    setOffset(offset < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0);
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, ...wrapperStyle }}>
      <button
        onClick={() => {
          setOffset(0);
          onDelete();
        }}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: REVEAL_WIDTH,
          background: 'var(--red)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {deleteLabel}
      </button>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative', transform: `translateX(${offset}px)`, background: 'var(--card)',
          transition: dragging ? 'none' : 'transform .2s ease', touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
