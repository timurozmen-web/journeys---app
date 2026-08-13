import { useState } from 'react';
import { usePromotions, useLoyaltyProgrammes, usePromotionCandidates } from '../lib/useLiveData';
import { addPromotion, deletePromotion, setPromotionDiscountUsed, setPromotionStatusNightsApplied, acceptPromotionCandidate, dismissPromotionCandidate } from '../lib/queries';
import type { Promotion, PromoType } from '../types';

const TYPE_LABELS: Record<PromoType, string> = {
  multiplier: 'Earning multiplier',
  threshold_bonus: 'Spend threshold bonus',
  fixed_discount: 'Fixed discount',
  status_boost: 'Status night boost',
  airline_partner: 'Airline joint earning',
  other: 'Other',
};

function summarize(p: Promotion): string | null {
  switch (p.promoType) {
    case 'multiplier':
      return p.multiplier != null ? `${p.multiplier}x points${p.brand ? ` on ${p.brand}` : ''}` : null;
    case 'threshold_bonus':
      return p.thresholdSpend != null && p.bonusPoints != null
        ? `Spend £${p.thresholdSpend.toLocaleString()} → ${p.bonusPoints.toLocaleString()} pts`
        : null;
    case 'fixed_discount':
      return p.discountValue != null ? `£${p.discountValue.toFixed(2)} off` : null;
    case 'status_boost':
      return p.statusNightsBonus != null ? `+${p.statusNightsBonus} status nights` : null;
    case 'airline_partner':
      return p.partnerAirline ? `Joint earning: ${p.brand ?? 'hotel'} + ${p.partnerAirline}` : null;
    default:
      return null;
  }
}

export function PromotionsTab() {
  const { data: promotions, refetch } = usePromotions();
  const { data: candidates, refetch: refetchCandidates } = usePromotionCandidates();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', brand: '', startDate: '', endDate: '',
    promoType: 'multiplier' as PromoType,
    multiplier: '', thresholdSpend: '', bonusPoints: '', discountValue: '', statusNightsBonus: '', partnerAirline: '',
  });

  const today = new Date().toISOString().slice(0, 10);

  async function handleAdd() {
    if (!form.title) return;
    setSaving(true);
    try {
      await addPromotion({
        title: form.title, description: form.description || null, brand: form.brand || null,
        startDate: form.startDate || null, endDate: form.endDate || null, promoType: form.promoType,
        multiplier: form.multiplier ? parseFloat(form.multiplier) : null,
        thresholdSpend: form.thresholdSpend ? parseFloat(form.thresholdSpend) : null,
        bonusPoints: form.bonusPoints ? parseFloat(form.bonusPoints) : null,
        discountValue: form.discountValue ? parseFloat(form.discountValue) : null,
        statusNightsBonus: form.statusNightsBonus ? parseInt(form.statusNightsBonus, 10) : null,
        partnerAirline: form.partnerAirline || null,
      });
      setForm({ title: '', description: '', brand: '', startDate: '', endDate: '', promoType: 'multiplier', multiplier: '', thresholdSpend: '', bonusPoints: '', discountValue: '', statusNightsBonus: '', partnerAirline: '' });
      setAdding(false);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack" style={{ display: 'grid', gap: 10 }}>
      {candidates.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Detected ({candidates.length})
          </div>
          {candidates.map((c) => (
            <div key={c.id} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(19,34,71,.15)', background: 'rgba(19,34,71,.04)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.title}</div>
              {c.brand && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{c.brand}</div>}
              {c.description && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{c.description}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={async () => {
                    await acceptPromotionCandidate(c);
                    refetchCandidates();
                    refetch();
                  }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Add
                </button>
                <button
                  onClick={async () => {
                    await dismissPromotionCandidate(c.id);
                    refetchCandidates();
                  }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {promotions.length === 0 && !adding && (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
          No promotions logged yet. Scan one from Capture, or add manually below.
        </div>
      )}

      {promotions.map((p) => {
        const isActive = (!p.startDate || p.startDate <= today) && (!p.endDate || p.endDate >= today);
        const summary = summarize(p);
        return (
          <div
            key={p.id}
            style={{
              padding: '12px 14px', borderRadius: 12, background: 'var(--card)',
              border: `1px solid ${isActive ? 'var(--brand)' : 'var(--line)'}`, position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingRight: 20 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.title}</div>
              {isActive && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'rgba(19,34,71,.08)', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>
                  ACTIVE
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.brand && <span>{p.brand}</span>}
              {p.promoType && <span>· {TYPE_LABELS[p.promoType]}</span>}
            </div>
            {summary && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginTop: 6 }}>{summary}</div>}
            {p.description && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 6 }}>{p.description}</div>}
            {(p.startDate || p.endDate) && (
              <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 6 }}>
                {p.startDate ?? '…'} – {p.endDate ?? '…'}
              </div>
            )}

            {p.promoType === 'fixed_discount' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, fontWeight: 600, color: p.discountUsed ? 'var(--ink3)' : 'var(--ink2)' }}>
                <input type="checkbox" checked={p.discountUsed} onChange={(e) => setPromotionDiscountUsed(p.id, e.target.checked).then(refetch)} />
                {p.discountUsed ? 'Used' : 'Mark as used'}
              </label>
            )}
            {p.promoType === 'status_boost' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, fontWeight: 600, color: p.statusNightsApplied ? 'var(--ink3)' : 'var(--ink2)' }}>
                <input type="checkbox" checked={p.statusNightsApplied} onChange={(e) => setPromotionStatusNightsApplied(p.id, e.target.checked).then(refetch)} />
                {p.statusNightsApplied ? 'Applied to status' : 'Mark qualifying stay complete'}
              </label>
            )}

            <button
              onClick={() => deletePromotion(p.id).then(refetch)}
              style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 12, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        );
      })}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: '10px 0', borderRadius: 10, border: '1px dashed var(--line)', background: 'var(--card2)',
            color: 'var(--ink2)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Add promotion manually
        </button>
      ) : (
        <div style={{ display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)' }}>
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
          />
          <select
            value={form.promoType}
            onChange={(e) => setForm((f) => ({ ...f, promoType: e.target.value as PromoType }))}
            style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
          >
            {(Object.keys(TYPE_LABELS) as PromoType[]).filter((t) => t !== 'other').map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
          >
            <option value="">No specific brand</option>
            {loyaltyProgrammes.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>

          {form.promoType === 'multiplier' && (
            <input placeholder="Multiplier (e.g. 2 for 2x)" type="number" step="0.1" value={form.multiplier}
              onChange={(e) => setForm((f) => ({ ...f, multiplier: e.target.value }))}
              style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }} />
          )}
          {form.promoType === 'threshold_bonus' && (
            <>
              <input placeholder="Spend required (£)" type="number" step="0.01" value={form.thresholdSpend}
                onChange={(e) => setForm((f) => ({ ...f, thresholdSpend: e.target.value }))}
                style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }} />
              <input placeholder="Bonus points" type="number" value={form.bonusPoints}
                onChange={(e) => setForm((f) => ({ ...f, bonusPoints: e.target.value }))}
                style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }} />
            </>
          )}
          {form.promoType === 'fixed_discount' && (
            <input placeholder="Discount amount (£)" type="number" step="0.01" value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }} />
          )}
          {form.promoType === 'status_boost' && (
            <input placeholder="Bonus status nights" type="number" value={form.statusNightsBonus}
              onChange={(e) => setForm((f) => ({ ...f, statusNightsBonus: e.target.value }))}
              style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }} />
          )}
          {form.promoType === 'airline_partner' && (
            <input placeholder="Airline programme (e.g. Virgin Points)" value={form.partnerAirline}
              onChange={(e) => setForm((f) => ({ ...f, partnerAirline: e.target.value }))}
              style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }} />
          )}

          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5, minWidth: 0, boxSizing: 'border-box' }}
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5, minWidth: 0, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAdd}
              disabled={saving || !form.title}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setAdding(false)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--ink2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
