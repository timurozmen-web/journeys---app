import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraIcon } from '../components/Icons';
import { addPromotion, type NewPromotionInput } from '../lib/queries';
import { useLoyaltyProgrammes } from '../lib/useLiveData';
import { normalizeBrand } from '../data/brandMap';
import { ErrorText, ScreenHeader } from '../components/ui';


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
      <ScreenHeader title="Scan a promotion" />

      {!result ? (
        <>
          <p style={{ padding: '0 20px 4px', fontSize: 'var(--fs-body)', color: 'var(--ink2)', lineHeight: 1.5 }}>
            Screenshot a promotion (a rate boost, bonus offer, status boost, or airline partnership) and it'll be classified automatically.
          </p>
          <div style={{ padding: '14px 20px 0' }}>
            <label className="field-label">Screenshots</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {images.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img src={img.previewUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-control)', border: '1px solid var(--line)' }} />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--ink)', color: 'var(--on-dark)', border: '2px solid var(--bg)', fontSize: 'var(--fs-small)', fontWeight: 700, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {images.length < 4 && (
                <button
                  onClick={() => fileInput.current?.click()}
                  style={{ width: 72, height: 72, borderRadius: 'var(--r-control)', border: '1px dashed var(--line)', background: 'var(--card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                >
                  <CameraIcon size={22} color="var(--ink3)" />
                </button>
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
          <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', fontWeight: 700 }}>OR PASTE TEXT</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
          <div style={{ padding: '10px 20px' }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the promotion text here…"
              rows={5}
              className="input compact" style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            {error && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-small)', marginTop: 10 }}>{error}</div>}
            <button
              onClick={handleExtract}
              disabled={loading || (!text.trim() && images.length === 0)}
              style={{
                width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 'var(--r-sm)', border: 'none',
                background: loading ? 'var(--card2)' : 'var(--brand)', color: loading ? 'var(--ink3)' : 'var(--on-dark)',
                fontSize: 'var(--fs-input)', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {loading ? 'Reading…' : 'Extract & classify'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ padding: '10px 20px', display: 'grid', gap: 14 }}>
          <div>
            <label className="field-label">Classified as</label>
            <select className="input compact" value={result.promoType ?? 'other'} onChange={(e) => set('promoType', e.target.value as NewPromotionInput['promoType'])}>
              {Object.entries(TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Title</label>
            <input className="input compact" value={result.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="field-label">Brand</label>
            <select className="input compact" value={result.brand ?? ''} onChange={(e) => set('brand', e.target.value || null)}>
              <option value="">No specific brand</option>
              {loyaltyProgrammes.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {result.promoType === 'multiplier' && (
            <div>
              <label className="field-label">Multiplier (e.g. 2 for 2x points)</label>
              <input className="input compact" type="number" step="0.1" value={result.multiplier ?? ''} onChange={(e) => set('multiplier', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          )}
          {result.promoType === 'threshold_bonus' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
              <div>
                <label className="field-label">Spend threshold (£)</label>
                <input className="input compact" type="number" value={result.thresholdSpend ?? ''} onChange={(e) => set('thresholdSpend', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div>
                <label className="field-label">Bonus points</label>
                <input className="input compact" type="number" value={result.bonusPoints ?? ''} onChange={(e) => set('bonusPoints', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
            </div>
          )}
          {result.promoType === 'fixed_discount' && (
            <div>
              <label className="field-label">Discount value (£)</label>
              <input className="input compact" type="number" step="0.01" value={result.discountValue ?? ''} onChange={(e) => set('discountValue', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          )}
          {result.promoType === 'status_boost' && (
            <div>
              <label className="field-label">Bonus status nights</label>
              <input className="input compact" type="number" value={result.statusNightsBonus ?? ''} onChange={(e) => set('statusNightsBonus', e.target.value ? parseInt(e.target.value, 10) : null)} />
            </div>
          )}
          {result.promoType === 'airline_partner' && (
            <div>
              <label className="field-label">Partner airline programme</label>
              <input className="input compact" value={result.partnerAirline ?? ''} onChange={(e) => set('partnerAirline', e.target.value || null)} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <div>
              <label className="field-label">Start date</label>
              <input className="input compact" type="date" value={result.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
            </div>
            <div>
              <label className="field-label">End date</label>
              <input className="input compact" type="date" value={result.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} />
            </div>
          </div>

          {result.promoType === 'multiplier' && (
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', background: 'rgba(19,34,71,.06)', padding: '10px 12px', borderRadius: 'var(--r-control)' }}>
              This one actually affects your points: any matching, active stay at this brand will show the multiplier applied in Trip Detail.
            </div>
          )}
          {result.promoType !== 'multiplier' && result.promoType !== 'other' && (
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', background: 'var(--amber-soft)', padding: '10px 12px', borderRadius: 'var(--r-control)' }}>
              This is tracked and shown in Promotions, but isn't yet applied automatically to your points or status calculations.
            </div>
          )}

          {error && <ErrorText>{error}</ErrorText>}
          <button
            onClick={handleSave}
            disabled={saving || !result.title}
            style={{ padding: '13px 0', borderRadius: 'var(--r-sm)', border: 'none', background: saving ? 'var(--card2)' : 'var(--brand)', color: saving ? 'var(--ink3)' : 'var(--on-dark)', fontSize: 'var(--fs-input)', fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save promotion'}
          </button>
        </div>
      )}
    </div>
  );
}
