import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon, CameraIcon } from '../components/Icons';
import { addPromotion, type NewPromotionInput } from '../lib/queries';
import { useLoyaltyProgrammes } from '../lib/useLiveData';
import { normalizeBrand } from '../data/brandMap';

const inputStyle: React.CSSProperties = {
  padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5,
  width: '100%', boxSizing: 'border-box', minWidth: 0,
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 5, display: 'block' };

const TYPE_LABELS: Record<string, string> = {
  multiplier: 'Rate multiplier', threshold_bonus: 'Spend threshold bonus', fixed_discount: 'Fixed discount',
  status_boost: 'Status/tier boost', airline_partner: 'Airline joint-earning', other: 'Other',
};

interface PickedImage { file: File; previewUrl: string }
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
}

export function ScanPromotion() {
  const navigate = useNavigate();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const [text, setText] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<NewPromotionInput | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, 4 - images.length)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...picked].slice(0, 4));
  }

  async function handleExtract() {
    if (!text.trim() && images.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const encodedImages = await Promise.all(images.map(async (img) => ({ mediaType: img.file.type, data: await fileToBase64(img.file) })));
      const res = await fetch('/.netlify/functions/extract-promotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoText: text || undefined, images: encodedImages.length ? encodedImages : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      if (data.title === 'Unrecognized') {
        setError("Couldn't recognize this as a promotion — try a clearer screenshot, or enter it manually below.");
        setResult({
          title: '', description: null, brand: null, startDate: null, endDate: null, promoType: 'other',
          multiplier: null, thresholdSpend: null, bonusPoints: null, discountValue: null, statusNightsBonus: null, partnerAirline: null,
        });
        return;
      }
      setResult({
        title: data.title, description: data.description,
        brand: data.brand && loyaltyProgrammes.some((p) => p.name === normalizeBrand(data.brand)) ? normalizeBrand(data.brand) : null,
        startDate: data.startDate, endDate: data.endDate, promoType: data.promoType,
        multiplier: data.multiplier, thresholdSpend: data.thresholdSpend, bonusPoints: data.bonusPoints,
        discountValue: data.discountValue, statusNightsBonus: data.statusNightsBonus, partnerAirline: data.partnerAirline,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result || !result.title) return;
    setSaving(true);
    try {
      await addPromotion(result);
      navigate('/wallet');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  function set<K extends keyof NewPromotionInput>(key: K, value: NewPromotionInput[K]) {
    setResult((r) => (r ? { ...r, [key]: value } : r));
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Scan a promotion</div>
      </div>

      {!result ? (
        <>
          <p style={{ padding: '0 20px 4px', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
            Screenshot a promotion — a rate boost, bonus offer, status boost, or airline partnership — and it'll be classified automatically.
          </p>
          <div style={{ padding: '14px 20px 0' }}>
            <label style={labelStyle}>Screenshots</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {images.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img src={img.previewUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--ink)', color: '#fff', border: '2px solid var(--bg)', fontSize: 12, fontWeight: 700, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {images.length < 4 && (
                <button
                  onClick={() => fileInput.current?.click()}
                  style={{ width: 72, height: 72, borderRadius: 10, border: '1px dashed var(--line)', background: 'var(--card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                >
                  <CameraIcon size={22} color="var(--ink3)" />
                </button>
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
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
              placeholder="Paste the promotion text here…"
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
            <button
              onClick={handleExtract}
              disabled={loading || (!text.trim() && images.length === 0)}
              style={{
                width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 12, border: 'none',
                background: loading ? 'var(--card2)' : 'var(--brand)', color: loading ? 'var(--ink3)' : '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {loading ? 'Reading…' : 'Extract & classify'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ padding: '10px 20px', display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Classified as</label>
            <select style={inputStyle} value={result.promoType ?? 'other'} onChange={(e) => set('promoType', e.target.value as NewPromotionInput['promoType'])}>
              {Object.entries(TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={result.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Brand</label>
            <select style={inputStyle} value={result.brand ?? ''} onChange={(e) => set('brand', e.target.value || null)}>
              <option value="">No specific brand</option>
              {loyaltyProgrammes.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {result.promoType === 'multiplier' && (
            <div>
              <label style={labelStyle}>Multiplier (e.g. 2 for 2x points)</label>
              <input style={inputStyle} type="number" step="0.1" value={result.multiplier ?? ''} onChange={(e) => set('multiplier', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          )}
          {result.promoType === 'threshold_bonus' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
              <div>
                <label style={labelStyle}>Spend threshold (£)</label>
                <input style={inputStyle} type="number" value={result.thresholdSpend ?? ''} onChange={(e) => set('thresholdSpend', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div>
                <label style={labelStyle}>Bonus points</label>
                <input style={inputStyle} type="number" value={result.bonusPoints ?? ''} onChange={(e) => set('bonusPoints', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
            </div>
          )}
          {result.promoType === 'fixed_discount' && (
            <div>
              <label style={labelStyle}>Discount value (£)</label>
              <input style={inputStyle} type="number" step="0.01" value={result.discountValue ?? ''} onChange={(e) => set('discountValue', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          )}
          {result.promoType === 'status_boost' && (
            <div>
              <label style={labelStyle}>Bonus status nights</label>
              <input style={inputStyle} type="number" value={result.statusNightsBonus ?? ''} onChange={(e) => set('statusNightsBonus', e.target.value ? parseInt(e.target.value, 10) : null)} />
            </div>
          )}
          {result.promoType === 'airline_partner' && (
            <div>
              <label style={labelStyle}>Partner airline programme</label>
              <input style={inputStyle} value={result.partnerAirline ?? ''} onChange={(e) => set('partnerAirline', e.target.value || null)} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>Start date</label>
              <input style={inputStyle} type="date" value={result.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>End date</label>
              <input style={inputStyle} type="date" value={result.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} />
            </div>
          </div>

          {result.promoType === 'multiplier' && (
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', background: 'rgba(19,34,71,.06)', padding: '10px 12px', borderRadius: 10 }}>
              This one actually affects your points: any matching, active stay at this brand will show the multiplier applied in Trip Detail.
            </div>
          )}
          {result.promoType !== 'multiplier' && result.promoType !== 'other' && (
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', background: 'rgba(156,95,8,.08)', padding: '10px 12px', borderRadius: 10 }}>
              This is tracked and shown in Promotions, but isn't yet applied automatically to your points or status calculations.
            </div>
          )}

          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
          <button
            onClick={handleSave}
            disabled={saving || !result.title}
            style={{ padding: '13px 0', borderRadius: 12, border: 'none', background: saving ? 'var(--card2)' : 'var(--brand)', color: saving ? 'var(--ink3)' : '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save promotion'}
          </button>
        </div>
      )}
    </div>
  );
}
