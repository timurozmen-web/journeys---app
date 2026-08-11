import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon, CameraIcon } from '../components/Icons';

const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6, display: 'block' };
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
  const [text, setText] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

      if (data.type === 'hotel') {
        navigate('/log-hotel', {
          state: {
            prefill: {
              name: data.name, country: data.country, city: data.city, brand: data.brand,
              date: data.checkIn, nights: data.nights, total: data.total,
            },
            extractNote: data.currency && data.currency !== 'GBP' ? `Detected amount was in ${data.currency} — double-check the £ figure.` : undefined,
          },
        });
      } else if (data.type === 'flight') {
        navigate('/log-flight', {
          state: {
            prefill: {
              date: data.date, from: data.from, to: data.to, airline: data.airline,
              flightNo: data.flightNo, cabin: data.cabin, cost: data.cost,
            },
            extractNote: data.currency && data.currency !== 'GBP' ? `Detected amount was in ${data.currency} — double-check the £ figure.` : undefined,
          },
        });
      } else {
        setError("Couldn't tell if this was a hotel or flight confirmation — try a clearer screenshot, more of the email text, or enter it manually.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = (text.trim().length > 0 || images.length > 0) && !loading;

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Scan an email</div>
      </div>
      <p style={{ padding: '0 20px 4px', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
        Easiest way: screenshot the confirmation and attach it below — no need to copy any text. You'll get a chance to review and correct everything before it's saved.
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
