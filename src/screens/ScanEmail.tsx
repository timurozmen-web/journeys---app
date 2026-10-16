import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BedIcon, CameraIcon, ChevronRightIcon, PlaneIcon, XIcon } from '../components/Icons';
import { bookingRoute, summarizeBooking } from '../lib/bookingPrefill';
import type { ExtractedBooking } from '../lib/bookingPrefill';
import { useAllHotels, useAllFlights, useTrips } from '../lib/useLiveData';
import { findLikelyDuplicateHotel, findLikelyDuplicateFlight } from '../lib/duplicateDetection';
import { Button, ErrorText, Field, ScreenHeader } from '../components/ui';

const MAX_IMAGES = 4;

interface PickedImage {
  file: File;
  previewUrl: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
}

export function ScanEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as { tripId?: string; back?: boolean; files?: File[]; scanId?: string; resumeBookings?: ExtractedBooking[] } | null;
  const tripId = state?.tripId;
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const { data: trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const [text, setText] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Found bookings live in this screen's history entry, so coming back
  // from saving one shows the list again (not a re-read of the images),
  // with the saved ones ticked from their marks.
  const bookings = state?.resumeBookings ?? null;
  const scanId = state?.scanId ?? '';
  const savedMark = (i: number) => `scan:${scanId}:${i}`;
  const isSaved = (i: number) => { try { return sessionStorage.getItem(savedMark(i)) === '1'; } catch { return false; } };
  const fileInput = useRef<HTMLInputElement>(null);

  // Screenshots picked from the + sheet arrive with the navigation and are
  // read straight away: choosing them was the tap.
  const autoRead = useRef(false);
  useEffect(() => {
    if (!state?.files?.length || bookings) return;
    autoRead.current = true;
    setImages(state.files.slice(0, MAX_IMAGES).map((file) => ({ file, previewUrl: URL.createObjectURL(file) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.files]);
  useEffect(() => {
    if (!autoRead.current || images.length === 0) return;
    autoRead.current = false;
    handleExtract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, MAX_IMAGES - images.length)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleExtract() {
    if (!text.trim() && images.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const encodedImages = await Promise.all(
        images.map(async (img) => ({ mediaType: img.file.type, data: await fileToBase64(img.file) }))
      );

      const res = await fetch('/.netlify/functions/extract-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText: text || undefined, images: encodedImages.length ? encodedImages : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');

      const found: ExtractedBooking[] = data.bookings ?? [];
      if (found.length === 0) {
        setError("Couldn't find a booking in this — try a clearer screenshot, more of the email text, or enter it manually.");
      } else if (found.length === 1) {
        // One booking: its form takes this screen's place.
        const r = bookingRoute(found[0], { tripId });
        navigate(r.to, { replace: true, state: { ...r.state, back: state?.back } });
      } else {
        navigate('/scan-email', { replace: true, state: { tripId, back: state?.back, scanId: crypto.randomUUID(), resumeBookings: found } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = (text.trim().length > 0 || images.length > 0) && !loading;

  if (bookings) {
    const allSaved = bookings.every((_, i) => isSaved(i));
    return (
      <div>
        <ScreenHeader title={`Found ${bookings.length} bookings`} sub={trip?.title} />
        <div className="page-body">
          <div className="listcard">
            {bookings.map((b, i) => {
              const saved = isSaved(i);
              const dup = b.type === 'hotel'
                ? findLikelyDuplicateHotel({ name: (b.name as string) ?? '', brand: (b.brand as string) ?? null, checkIn: (b.checkIn as string) ?? null }, hotels)
                : findLikelyDuplicateFlight({ date: (b.date as string) ?? null, from: (b.from as string) ?? null, to: (b.to as string) ?? null }, flights);
              const line = summarizeBooking(b);
              const r = bookingRoute(b, { tripId });
              return (
                <button key={i} className="nextrow" onClick={() => navigate(r.to, { state: { ...r.state, back: true, savedMark: savedMark(i) } })}>
                  <span className="badge-sq" style={{ background: 'var(--ink)' }} aria-hidden="true">
                    {b.type === 'hotel' ? <BedIcon size={16} color="var(--on-dark)" /> : <PlaneIcon size={16} color="var(--on-dark)" />}
                  </span>
                  <span className="nextrow-main">
                    <span className="rowtitle">{line.title}</span>
                    <span className="rowsub">{dup && !saved ? 'Might already be logged' : line.sub}</span>
                  </span>
                  {saved ? <span className="tag solid">Saved</span> : <ChevronRightIcon size={18} color="var(--ink3)" />}
                </button>
              );
            })}
          </div>
          {allSaved && <Button block onClick={() => navigate(tripId ? `/trips/${tripId}` : '/trips', { replace: true })}>Done</Button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Import a booking" sub={trip?.title} />
      <div className="page-body form">
        <div>
          <div className="field-label">Screenshots</div>
          <div className="shotgrid">
            {images.map((img, i) => (
              <div key={i} className="shot">
                <img src={img.previewUrl} alt="" />
                <button type="button" className="shot-remove" aria-label="Remove screenshot" onClick={() => removeImage(i)}><XIcon size={12} strokeWidth={2.4} /></button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" className="shot shot-add" aria-label="Add screenshots" onClick={() => fileInput.current?.click()}>
                <CameraIcon size={22} color="var(--ink3)" />
              </button>
            )}
          </div>
          <input
            ref={fileInput} type="file" accept="image/*" multiple hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
        <Field label="Email text">
          <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the confirmation email" rows={6} />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button block onClick={handleExtract} disabled={!canSubmit}>{loading ? 'Reading…' : 'Read booking'}</Button>
      </div>
    </div>
  );
}
