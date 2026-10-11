import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ringLead, ringPose, settled, shortestTarget, snapTarget, springStep } from '../lib/cardCarousel';

// Card faces stood round a ring, the lead card at the front and the rest
// visible behind it. Dragging sideways turns the ring with your finger;
// letting go hands it to a spring that pulls the nearest card to the
// front like a magnet (a flick carries it on a card or two). Tapping a
// card behind brings it forward the short way round.
export function CardCarousel({ count, focus = null, labels, renderFace, onLeadChange }: {
  count: number;
  /** A card to bring to the front once it's in the ring (a card just added or linked). */
  focus?: string | null;
  labels: string[];
  renderFace: (index: number, isLead: boolean) => ReactNode;
  onLeadChange: (index: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const start = Math.max(0, focus ? labels.indexOf(focus) : 0);
  const rot = useRef(start);
  const vel = useRef(0);
  const target = useRef(start);
  const leadRef = useRef(start);
  const [lead, setLead] = useState(start);
  const frame = useRef(0);
  const focused = useRef(false);
  const drag = useRef<{ id: number; x0: number; r0: number; lastX: number; lastT: number; v: number; moved: boolean } | null>(null);
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // The parent passes a new callback on every render (and re-renders when
  // the lead changes); held in a ref so a turn in progress isn't torn down
  // and restarted, which stopped the spring halfway between two cards.
  const onLeadRef = useRef(onLeadChange);
  useLayoutEffect(() => { onLeadRef.current = onLeadChange; });

  const layout = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const w = stage.clientWidth;
    const h = slotRefs.current[0]?.offsetHeight ?? 0;
    slotRefs.current.forEach((el, i) => {
      if (!el) return;
      const p = ringPose(i, rot.current, count, reduced);
      el.style.transform = `translate3d(${(p.x * w).toFixed(1)}px, ${(p.y * h).toFixed(1)}px, 0) rotateY(${p.rotateY.toFixed(2)}deg) scale(${p.scale.toFixed(4)})`;
      el.style.zIndex = String(p.z);
      el.style.setProperty('--shade', p.shade.toFixed(3));
    });
    const next = ringLead(rot.current, count);
    if (next !== leadRef.current) {
      leadRef.current = next;
      setLead(next);
      onLeadRef.current(next);
    }
  }, [count, reduced]);

  const stop = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  // Let the spring carry the ring onto `target`.
  const animate = useCallback(() => {
    stop();
    if (reduced) {
      rot.current = target.current;
      vel.current = 0;
      layout();
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = springStep(rot.current, vel.current, target.current, dt);
      rot.current = s.pos;
      vel.current = s.vel;
      if (settled(s.pos, s.vel, target.current)) {
        // Keep the numbers small: the ring has no ends.
        const home = ((target.current % count) + count) % count;
        rot.current = target.current = home;
        vel.current = 0;
        frame.current = 0;
        layout();
        return;
      }
      layout();
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [count, layout, reduced]);

  const goTo = (i: number) => {
    if (count < 2) return;
    target.current = shortestTarget(rot.current, i, count);
    animate();
  };
  const turn = (by: number) => {
    if (count < 2) return;
    target.current = Math.round(target.current) + by;
    animate();
  };

  // How far a drag must go to turn the ring one card.
  const cardStep = () => Math.max(1, (stageRef.current?.clientWidth ?? 300) * 0.55);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (count < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stop();
    drag.current = { id: e.pointerId, x0: e.clientX, r0: rot.current, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      d.moved = true;
      stageRef.current?.setPointerCapture(e.pointerId);
    }
    const dt = Math.max(1, e.timeStamp - d.lastT) / 1000;
    const v = -((e.clientX - d.lastX) / cardStep()) / dt;
    d.v = d.v * 0.6 + v * 0.4;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    rot.current = d.r0 - dx / cardStep();
    layout();
  };
  const endDrag = (e: ReactPointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.moved || cancelled) {
      // A pause before letting go is not a flick.
      const v = e.timeStamp - d.lastT > 80 ? 0 : d.v;
      target.current = snapTarget(rot.current, cancelled ? 0 : v);
      vel.current = cancelled ? 0 : v;
      animate();
      return;
    }
    // A tap: bring a card from round the back to the front.
    const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    const i = slot ? Number(slot.dataset.slot) : -1;
    if (i >= 0 && i !== leadRef.current) goTo(i);
  };

  // Desktop trackpads: a sideways scroll turns the ring, then it snaps.
  const wheelTimer = useRef(0);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || count < 2) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      stop();
      rot.current += e.deltaX / cardStep();
      layout();
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => { target.current = Math.round(rot.current); animate(); }, 90);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => { stage.removeEventListener('wheel', onWheel); window.clearTimeout(wheelTimer.current); };
  }, [count, layout, animate]);

  // Open on the requested card, posed, before the first paint. After a
  // card is removed the lead may be past the end: clamp it.
  useLayoutEffect(() => {
    stop();
    const l = Math.min(leadRef.current, Math.max(0, count - 1));
    rot.current = target.current = l;
    vel.current = 0;
    leadRef.current = l;
    setLead(l);
    onLeadRef.current(l);
    layout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // A card just added may arrive a moment after the ring first draws:
  // bring it to the front as soon as it's there (once).
  useLayoutEffect(() => {
    if (!focus || focused.current) return;
    const i = labels.indexOf(focus);
    if (i < 0) return;
    focused.current = true;
    stop();
    rot.current = target.current = i;
    layout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, labels.join('|')]);

  useEffect(() => {
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layout]);
  useEffect(() => stop, []);

  return (
    <div className="carousel">
      <div
        className={count > 1 ? 'carousel-stage ring' : 'carousel-stage'} ref={stageRef} tabIndex={0} role="listbox" aria-label="Cards"
        aria-activedescendant={`card-slot-${lead}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)} onPointerCancel={(e) => endDrag(e, true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={labels[i] ?? i} id={`card-slot-${i}`} role="option" aria-selected={i === lead} aria-label={labels[i]}
            data-slot={i}
            className={i === lead ? 'carousel-slot lead' : 'carousel-slot'}
            ref={(el) => { slotRefs.current[i] = el; }}
          >
            {renderFace(i, i === lead)}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="carousel-dots">
          {labels.map((l, i) => (
            <button key={l} className={i === lead ? 'on' : ''} aria-label={`Show ${l}`} onClick={() => goTo(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
