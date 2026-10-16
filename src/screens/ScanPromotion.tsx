import { useState, useRef } from 'react';
import { useFinish } from '../lib/useFinish';
import { CameraIcon, XIcon } from '../components/Icons';
import { addPromotion, type NewPromotionInput } from '../lib/queries';
import { useLoyaltyProgrammes } from '../lib/useLiveData';
import { normalizeBrand } from '../data/brandMap';
import { Button, ErrorText, Field, ScreenHeader } from '../components/ui';


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
  const finish = useFinish();
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
      finish.done('/promotions');
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
      <ScreenHeader title="New promotion" />

      {!result ? (
        <>
          <div className="page-body form">
            <div>
              <div className="field-label">Screenshots</div>
              <div className="shotgrid">
                {images.map((img, i) => (
                  <div key={i} className="shot">
                    <img src={img.previewUrl} alt="" />
                    <button type="button" className="shot-remove" aria-label="Remove screenshot" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>
                      <XIcon size={12} strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
                {images.length < 4 && (
                  <button type="button" className="shot shot-add" aria-label="Add screenshots" onClick={() => fileInput.current?.click()}>
                    <CameraIcon size={22} color="var(--ink3)" />
                  </button>
                )}
              </div>
              <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </div>
            <Field label="Promotion text">
              <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the offer" rows={5} />
            </Field>
            {error && <ErrorText>{error}</ErrorText>}
            <Button block onClick={handleExtract} disabled={loading || (!text.trim() && images.length === 0)}>
              {loading ? 'Reading…' : 'Read promotion'}
            </Button>
          </div>
        </>
      ) : (
        <div className="page-body form">
          <label className="field">
            <span className="field-label">Classified as</span>
            <select className="input" value={result.promoType ?? 'other'} onChange={(e) => set('promoType', e.target.value as NewPromotionInput['promoType'])}>
              {Object.entries(TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Title</span>
            <input className="input" value={result.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Brand</span>
            <select className="input" value={result.brand ?? ''} onChange={(e) => set('brand', e.target.value || null)}>
              <option value="">No specific brand</option>
              {loyaltyProgrammes.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>

          {result.promoType === 'multiplier' && (
            <label className="field">
              <span className="field-label">Multiplier (e.g. 2 for 2x points)</span>
              <input className="input" type="number" step="0.1" value={result.multiplier ?? ''} onChange={(e) => set('multiplier', e.target.value ? parseFloat(e.target.value) : null)} />
            </label>
          )}
          {result.promoType === 'threshold_bonus' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
              <label className="field">
                <span className="field-label">Spend threshold (£)</span>
                <input className="input" type="number" value={result.thresholdSpend ?? ''} onChange={(e) => set('thresholdSpend', e.target.value ? parseFloat(e.target.value) : null)} />
              </label>
              <label className="field">
                <span className="field-label">Bonus points</span>
                <input className="input" type="number" value={result.bonusPoints ?? ''} onChange={(e) => set('bonusPoints', e.target.value ? parseFloat(e.target.value) : null)} />
              </label>
            </div>
          )}
          {result.promoType === 'fixed_discount' && (
            <label className="field">
              <span className="field-label">Discount value (£)</span>
              <input className="input" type="number" step="0.01" value={result.discountValue ?? ''} onChange={(e) => set('discountValue', e.target.value ? parseFloat(e.target.value) : null)} />
            </label>
          )}
          {result.promoType === 'status_boost' && (
            <label className="field">
              <span className="field-label">Bonus status nights</span>
              <input className="input" type="number" value={result.statusNightsBonus ?? ''} onChange={(e) => set('statusNightsBonus', e.target.value ? parseInt(e.target.value, 10) : null)} />
            </label>
          )}
          {result.promoType === 'airline_partner' && (
            <label className="field">
              <span className="field-label">Partner airline programme</span>
              <input className="input" value={result.partnerAirline ?? ''} onChange={(e) => set('partnerAirline', e.target.value || null)} />
            </label>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <label className="field">
              <span className="field-label">Start date</span>
              <input className="input" type="date" value={result.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
            </label>
            <label className="field">
              <span className="field-label">End date</span>
              <input className="input" type="date" value={result.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} />
            </label>
          </div>

          {result.promoType === 'multiplier' && (
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', background: 'rgba(217,183,124,.1)', padding: '10px 12px', borderRadius: 'var(--r-control)' }}>
              This one actually affects your points: any matching, active stay at this brand will show the multiplier applied in Trip Detail.
            </div>
          )}
          {result.promoType !== 'multiplier' && result.promoType !== 'other' && (
            <div className="formnote">Not counted in points or status yet</div>
          )}

          {error && <ErrorText>{error}</ErrorText>}
          <Button block onClick={handleSave} disabled={saving || !result.title}>{saving ? 'Saving…' : 'Save promotion'}</Button>
        </div>
      )}
    </div>
  );
}
