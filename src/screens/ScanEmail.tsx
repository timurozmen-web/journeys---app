import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackIcon, CameraIcon } from '../components/Icons';
import { normalizeBrand } from '../data/brandMap';
import { useAllHotels, useAllFlights } from '../lib/useLiveData';
import { findLikelyDuplicateHotel, findLikelyDuplicateFlight } from '../lib/duplicateDetection';

const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6, display: 'block' };
const MAX_IMAGES = 4;

interface PickedImage {
  file: File;
  previewUrl: string;
}

interface ExtractedBooking {
  type: 'hotel' | 'flight';
  [key: string]: unknown;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
}

function summarize(b: ExtractedBooking): string {
  if (b.type === 'hotel') return `${b.name ?? 'Hotel'} · ${b.checkIn ?? 'date unknown'}${b.nights ? ` · ${b.nights}n` : ''}`;
  return `${b.airline ?? 'Flight'} ${b.from ?? '?'} → ${b.to ?? '?'} · ${b.date ?? 'date unknown'}`;
}

export function ScanEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const [text, setText] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<ExtractedBooking[] | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<number>>(new Set());

  useEffect(() => {
    const resume = location.state as { resumeBookings?: ExtractedBooking[]; resumeSaved?: number[] } | null;
    if (resume?.resumeBookings) {
      setBookings(resume.resumeBookings);
      setSavedKeys(new Set(resume.resumeSaved ?? []));
    }
  }, [location.state]);
  const fileInput = useRef<HTMLInputElement>(null);

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

  function openBooking(b: ExtractedBooking, index: number) {
    const returnTo = { pathname: '/scan-email', state: { resumeBookings: bookings, resumeSaved: [...savedKeys, index] } };
    if (b.type === 'hotel') {
      navigate('/log-hotel', {
        state: {
          prefill: {
            name: b.name, country: b.country, city: b.city, brand: b.brand ? normalizeBrand(b.brand as string) : null,
            date: b.checkIn, nights: b.nights, total: b.total,
            roomType: b.roomType ?? null, rateType: b.rateType ?? 'Standard',
          },
          extractNote: b.currency && b.currency !== 'GBP' ? `Detected amount was in ${b.currency} — double-check the £ figure.` : undefined,
          returnTo,
        },
      });
    } else {
      navigate('/log-flight', {
        state: {
          prefill: { date: b.date, from: b.from, to: b.to, airline: b.airline, flightNo: b.flightNo, cabin: b.cabin, cost: b.cost },
          extractNote: b.currency && b.currency !== 'GBP' ? `Detected amount was in ${b.currency} — double-check the £ figure.` : undefined,
          returnTo,
        },
      });
    }
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
        openBooking(found[0], 0);
      } else {
        setBookings(found);
        setSavedKeys(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = (text.trim().length > 0 || images.length > 0) && !loading;

  if (bookings) {
    return (
      <div>
        <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setBookings(null)} style={{ background: 'none', border: 'none', padding: 0 }}>
            <BackIcon size={20} color="var(--ink)" />
          </button>
          <div className="h1" style={{ fontSize: 21 }}>Found {bookings.length} bookings</div>
        </div>
        <p style={{ padding: '0 20px 4px', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
          Tap each one to review and save it — you can check and correct the details before anything's added.
        </p>
        <div className="stack" style={{ marginTop: 8 }}>
          {bookings.map((b, i) => {
            const saved = savedKeys.has(i);
            const dup = b.type === 'hotel'
              ? findLikelyDuplicateHotel({ name: (b.name as string) ?? '', brand: (b.brand as string) ?? null, checkIn: (b.checkIn as string) ?? null }, hotels)
              : findLikelyDuplicateFlight({ date: (b.date as string) ?? null, from: (b.from as string) ?? null, to: (b.to as string) ?? null }, flights);
            return (
              <button
                key={i}
                onClick={() => openBooking(b, i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 14,
                  background: saved ? 'rgba(12,122,66,.06)' : 'var(--card)', border: `1px solid ${saved ? 'rgba(12,122,66,.25)' : 'var(--line)'}`,
                  cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--ink)',
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{b.type === 'hotel' ? '🏨' : '✈️'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{summarize(b)}</span>
                  {dup && !saved && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--amber)', fontWeight: 600, marginTop: 2 }}>
                      ⚠ Might already be logged — check before saving again
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: saved ? 'var(--green)' : 'var(--brand)', flexShrink: 0 }}>
                  {saved ? '✓ Saved' : 'Review →'}
                </span>
              </button>
            );
          })}
        </div>
        {savedKeys.size === bookings.length && (
          <div style={{ padding: '16px 20px' }}>
            <button
              onClick={() => navigate('/trips')}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Done — go to trips
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Scan an email</div>
      </div>
      <p style={{ padding: '0 20px 4px', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
        Easiest way: screenshot the confirmation and attach it below — no need to copy any text. Multiple bookings in one confirmation (like a flight plus a hotel) are all picked up together. You'll get a chance to review and correct everything before it's saved.
      </p>

      <div style={{ padding: '14px 20px 0' }}>
        <label style={labelStyle}>Screenshots</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
              <img src={img.previewUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />
              <button
                onClick={() => removeImage(i)}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--ink)', color: '#fff', border: '2px solid var(--bg)', fontSize: 12, fontWeight: 700,
                  display: 'grid', placeItems: 'center', cursor: 'pointer', lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              onClick={() => fileInput.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: 10, border: '1px dashed var(--line)', background: 'var(--card)',
                display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink3)',
              }}
            >
              <CameraIcon size={22} color="var(--ink3)" />
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {images.length > 0 && (
          <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 6 }}>
            Long email? Attach a few screenshots covering different parts of it — up to {MAX_IMAGES}.
          </div>
        )}
      </div>

      <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700 }}>OR PASTE TEXT</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>

      <div style={{ padding: '10px 20px' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the confirmation email here…"
          rows={6}
          style={{
            width: '100%', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
            color: 'var(--ink)', fontSize: 13.5, padding: '11px 12px', outline: 'none', resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
        <button
          onClick={handleExtract}
          disabled={!canSubmit}
          style={{
            width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 12, border: 'none',
            background: canSubmit ? 'var(--brand)' : 'var(--card2)',
            color: canSubmit ? '#fff' : 'var(--ink3)',
            fontSize: 15, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default',
          }}
        >
          {loading ? 'Reading…' : 'Extract details'}
        </button>
      </div>
    </div>
  );
}
