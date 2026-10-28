import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CameraIcon, XIcon, BackIcon } from './Icons';
import { Confirm } from './ui';
import { PHOTO_ASPECTS } from '../lib/reviewSummary';

export interface StripPhoto { id: string; url: string }

// A row of square thumbnails and, where photos can be added, a camera tile
// first. Takes several at once from the library or one from the camera.
export function PhotoStrip({ photos, onAdd, busy, onOpen, label }: {
  photos: StripPhoto[];
  onAdd?: (files: File[]) => void;
  busy?: string | null;
  onOpen: (index: number) => void;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  if (!onAdd && photos.length === 0) return null;
  return (
    <div className="photostrip">
      {onAdd && (
        <>
          <button type="button" className="photoadd" aria-label={`Add ${label} photos`} disabled={!!busy} onClick={() => input.current?.click()}>
            {busy ? <span className="photoadd-busy">{busy}</span> : <CameraIcon size={20} color="currentColor" />}
          </button>
          <input
            ref={input} type="file" accept="image/*" multiple hidden
            onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) onAdd(files); }}
          />
        </>
      )}
      {photos.map((p, i) => (
        <button type="button" key={p.id} className="photothumb" aria-label={`${label} photo ${i + 1}`} onClick={() => onOpen(i)}>
          <img src={p.url} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  );
}

// One photo at a time over the whole screen. Swipe or the arrow keys move
// between them; deleting asks once. It's drawn on the page's body: inside
// a screen it sat under the tab bar, whatever its z-index, as the screen
// is a stacking context of its own.
export function PhotoViewer({ photos, start, title, onClose, onDelete, aspects }: {
  photos: StripPhoto[];
  start: number;
  title: string;
  onClose: () => void;
  onDelete?: (photo: StripPhoto) => Promise<void> | void;
  // The aspects the photo is filed under, as tags to move it between them.
  aspects?: { of: (photo: StripPhoto) => string[]; toggle: (photo: StripPhoto, key: string) => void };
}) {
  const [index, setIndex] = useState(start);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = photos.length;
  const at = Math.min(index, count - 1);
  const photo = photos[at];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, count - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onClose]);

  useEffect(() => { if (count === 0) onClose(); }, [count, onClose]);
  if (!photo) return null;

  async function remove() {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete(photo);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="photoviewer" role="dialog" aria-label={title}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -40) setIndex(Math.min(at + 1, count - 1));
        if (dx > 40) setIndex(Math.max(at - 1, 0));
      }}
    >
      <div className="pv-bar">
        <button type="button" className="pv-btn" aria-label="Close" onClick={onClose}><XIcon size={20} color="currentColor" /></button>
        <div className="pv-title">{title}{count > 1 ? ` · ${at + 1}/${count}` : ''}</div>
        {onDelete ? <button type="button" className="pv-text" onClick={() => setConfirming(true)}>Delete</button> : <span className="pv-btn" />}
      </div>
      <img className="pv-img" src={photo.url} alt="" />
      {aspects && (
        <div className="pv-tags">
          {PHOTO_ASPECTS.map((a) => {
            const on = aspects.of(photo).includes(a.key);
            return (
              <button key={a.key} type="button" className={on ? 'tagbtn on' : 'tagbtn'} aria-pressed={on} onClick={() => aspects.toggle(photo, a.key)}>
                {a.label}
              </button>
            );
          })}
        </div>
      )}
      {count > 1 && (
        <div className="pv-nav">
          <button type="button" className="pv-btn" aria-label="Previous" disabled={at === 0} onClick={() => setIndex(at - 1)}><BackIcon size={20} color="currentColor" /></button>
          <button type="button" className="pv-btn pv-next" aria-label="Next" disabled={at === count - 1} onClick={() => setIndex(at + 1)}><BackIcon size={20} color="currentColor" /></button>
        </div>
      )}
      {confirming && (
        <div className="pv-confirm">
          <Confirm confirmLabel="Delete" danger busy={busy} onConfirm={remove} onCancel={() => setConfirming(false)}>Delete this photo?</Confirm>
        </div>
      )}
    </div>,
    document.body,
  );
}
