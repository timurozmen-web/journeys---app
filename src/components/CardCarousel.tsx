import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cardPose, leadIndex, slotOffset } from '../lib/cardCarousel';

// Card faces in a horizontal rail. CSS scroll-snap pulls each card into
// the centre when a swipe ends, like a magnet; while it moves, every card
// is posed from its live distance to the centre (tilted away, smaller and
// dimmer either side), so the rail turns smoothly rather than jumping.
// Tapping a card at the side brings it to the front.
export function CardCarousel({ count, focus = null, labels, renderFace, onLeadChange }: {
  count: number;
  /** A card to bring to the front once it's in the rail (a card just added or linked). */
  focus?: string | null;
  labels: string[];
  renderFace: (index: number, isLead: boolean) => ReactNode;
  onLeadChange: (index: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const leadRef = useRef(Math.max(0, focus ? labels.indexOf(focus) : 0));
  const focused = useRef(false);
  const [lead, setLead] = useState(leadRef.current);
  const frame = useRef(0);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const slotWidth = () => {
    const [a, b] = slotRefs.current;
    if (a && b) return b.offsetLeft - a.offsetLeft;
    return a?.offsetWidth ?? 1;
  };

  const pose = useCallback(() => {
    frame.current = 0;
    const rail = railRef.current;
    if (!rail) return;
    const w = slotWidth();
    slotRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = slotOffset(i, rail.scrollLeft, w);
      const p = cardPose(d, reduced);
      el.style.transform = `perspective(1000px) rotateY(${p.rotateY}deg) scale(${p.scale})`;
      el.style.opacity = String(p.opacity);
      // The card nearer the centre sits on top while two overlap mid-turn.
      el.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
    });
    const next = leadIndex(rail.scrollLeft, w, count);
    if (next !== leadRef.current) {
      leadRef.current = next;
      setLead(next);
      onLeadChange(next);
    }
  }, [count, onLeadChange, reduced]);

  const onScroll = () => {
    if (!frame.current) frame.current = requestAnimationFrame(pose);
  };

  const goTo = (i: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const target = Math.max(0, Math.min(count - 1, i));
    rail.scrollTo({ left: target * slotWidth(), behavior: reduced ? 'auto' : 'smooth' });
  };

  // Open on the requested card, posed, before the first paint.
  useLayoutEffect(() => {
    // After a card is removed the lead may be past the end: clamp it.
    leadRef.current = Math.min(leadRef.current, Math.max(0, count - 1));
    setLead(leadRef.current);
    onLeadChange(leadRef.current);
    const rail = railRef.current;
    if (rail) rail.scrollLeft = leadRef.current * slotWidth();
    pose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // A card just added may arrive a moment after the rail first draws:
  // bring it to the front as soon as it's there (once).
  useLayoutEffect(() => {
    if (!focus || focused.current) return;
    const i = labels.indexOf(focus);
    if (i < 0) return;
    focused.current = true;
    leadRef.current = i;
    setLead(i);
    onLeadChange(i);
    const rail = railRef.current;
    if (rail) rail.scrollLeft = i * slotWidth();
    pose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, labels.join('|')]);

  useEffect(() => {
    const onResize = () => pose();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); if (frame.current) cancelAnimationFrame(frame.current); };
  }, [pose]);

  return (
    <div className="carousel">
      <div
        className="carousel-rail" ref={railRef} onScroll={onScroll} tabIndex={0} role="listbox" aria-label="Cards"
        aria-activedescendant={`card-slot-${lead}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); goTo(lead + 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(lead - 1); }
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={labels[i] ?? i} id={`card-slot-${i}`} role="option" aria-selected={i === lead} aria-label={labels[i]}
            className={i === lead ? 'carousel-slot lead' : 'carousel-slot'}
            ref={(el) => { slotRefs.current[i] = el; }}
            onClick={() => { if (i !== lead) goTo(i); }}
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
