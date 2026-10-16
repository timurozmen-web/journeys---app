import { useState } from 'react';
import { usePromotions, useLoyaltyProgrammes } from '../lib/useLiveData';
import { addPromotion, deletePromotion, setPromotionDiscountUsed, setPromotionStatusNightsApplied } from '../lib/queries';
import type { Promotion, PromoType } from '../types';
import { promoArchiveReason } from '../lib/promoArchive';
import { formatDate } from '../lib/format';
import { SwipeToDelete } from './SwipeToDelete';
import { Button, EmptyState, SectionLabel } from './ui';

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

// Every promotion, or with `brand` just one programme's (on its page under
// Status), with a form to add one by hand and the archive of spent ones.
export function PromotionsTab({ brand = null }: { brand?: string | null }) {
  const { data: allPromotions, refetch } = usePromotions();
  const promotions = brand ? allPromotions.filter((p) => p.brand === brand) : allPromotions;
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const [adding, setAdding] = useState(false);
  const [openArchived, setOpenArchived] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', brand: brand ?? '', startDate: '', endDate: '',
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
      setForm({ title: '', description: '', brand: brand ?? '', startDate: '', endDate: '', promoType: 'multiplier', multiplier: '', thresholdSpend: '', bonusPoints: '', discountValue: '', statusNightsBonus: '', partnerAirline: '' });
      setAdding(false);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  // Promotions that have served their purpose (ended, used or applied)
  // move to Archived, like closed cards: compact rows, swipe to delete.
  const current = promotions.filter((p) => !promoArchiveReason(p, today));
  const archived = promotions
    .filter((p) => promoArchiveReason(p, today))
    .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));
  const reasonLabel = (p: Promotion) => {
    const r = promoArchiveReason(p, today);
    if (r === 'applied') return 'Applied to status';
    if (r === 'used') return 'Used';
    return p.endDate ? `Ended ${formatDate(p.endDate)}` : 'Ended';
  };

  // A promotion's details: what it gives, when it runs, and the tick that
  // records it being used.
  function renderPromo(p: Promotion) {
    const isActive = (!p.startDate || p.startDate <= today) && (!p.endDate || p.endDate >= today) && !promoArchiveReason(p, today);
    const summary = summarize(p);
    return (
      <div
        style={{
          padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--card)',
          border: '1px solid var(--line)', position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700 }}>{p.title}</div>
          {isActive && <span className="tag solid">Active</span>}
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {p.brand && <span>{p.brand}</span>}
          {p.promoType && <span>· {TYPE_LABELS[p.promoType]}</span>}
        </div>
        {summary && <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--brand)', marginTop: 6 }}>{summary}</div>}
        {p.description && <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', marginTop: 6 }}>{p.description}</div>}
        {(p.startDate || p.endDate) && (
          <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink3)', marginTop: 6 }}>
            {p.startDate ? formatDate(p.startDate) : '…'} – {p.endDate ? formatDate(p.endDate) : '…'}
          </div>
        )}

        {p.promoType === 'fixed_discount' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 'var(--fs-small)', fontWeight: 600, color: p.discountUsed ? 'var(--ink3)' : 'var(--ink2)' }}>
            <input type="checkbox" checked={p.discountUsed} onChange={(e) => setPromotionDiscountUsed(p.id, e.target.checked).then(refetch)} />
            {p.discountUsed ? 'Used' : 'Mark as used'}
          </label>
        )}
        {p.promoType === 'status_boost' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 'var(--fs-small)', fontWeight: 600, color: p.statusNightsApplied ? 'var(--ink3)' : 'var(--ink2)' }}>
            <input type="checkbox" checked={p.statusNightsApplied} onChange={(e) => setPromotionStatusNightsApplied(p.id, e.target.checked).then(refetch)} />
            {p.statusNightsApplied ? 'Applied to status' : 'Mark qualifying stay complete'}
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ display: 'grid', gap: 10 }}>

      {promotions.length === 0 && !adding && (
        <EmptyState>No promotions yet</EmptyState>
      )}

      {current.map((p) => (
        <SwipeToDelete key={p.id} itemLabel={p.title} surface="var(--bg)" wrapperStyle={{ borderRadius: 'var(--r-sm)' }} onDelete={() => deletePromotion(p.id).then(refetch)}>
          {renderPromo(p)}
        </SwipeToDelete>
      ))}

      {!adding ? (
        <Button variant="secondary" block onClick={() => setAdding(true)}>Add a promotion</Button>
      ) : (
        <div className="listcard pad" style={{ gap: 8 }}>
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="input"
          />
          <select
            value={form.promoType}
            onChange={(e) => setForm((f) => ({ ...f, promoType: e.target.value as PromoType }))}
            className="input"
          >
            {(Object.keys(TYPE_LABELS) as PromoType[]).filter((t) => t !== 'other').map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            className="input"
          >
            <option value="">No specific brand</option>
            {loyaltyProgrammes.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>

          {form.promoType === 'multiplier' && (
            <input placeholder="Multiplier (e.g. 2 for 2x)" type="number" step="0.1" value={form.multiplier}
              onChange={(e) => setForm((f) => ({ ...f, multiplier: e.target.value }))}
              className="input" />
          )}
          {form.promoType === 'threshold_bonus' && (
            <>
              <input placeholder="Spend required (£)" type="number" step="0.01" value={form.thresholdSpend}
                onChange={(e) => setForm((f) => ({ ...f, thresholdSpend: e.target.value }))}
                className="input" />
              <input placeholder="Bonus points" type="number" value={form.bonusPoints}
                onChange={(e) => setForm((f) => ({ ...f, bonusPoints: e.target.value }))}
                className="input" />
            </>
          )}
          {form.promoType === 'fixed_discount' && (
            <input placeholder="Discount amount (£)" type="number" step="0.01" value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              className="input" />
          )}
          {form.promoType === 'status_boost' && (
            <input placeholder="Bonus status nights" type="number" value={form.statusNightsBonus}
              onChange={(e) => setForm((f) => ({ ...f, statusNightsBonus: e.target.value }))}
              className="input" />
          )}
          {form.promoType === 'airline_partner' && (
            <input placeholder="Airline programme (e.g. Virgin Points)" value={form.partnerAirline}
              onChange={(e) => setForm((f) => ({ ...f, partnerAirline: e.target.value }))}
              className="input" />
          )}

          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="input" style={{fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="input" style={{minWidth: 0, boxSizing: 'border-box' }}
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className="input" style={{minWidth: 0, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button small style={{ flex: 1 }} onClick={handleAdd} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button small variant="secondary" style={{ flex: 1 }} onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {archived.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 10 }}>Archived</SectionLabel>
          <div style={{ display: 'grid', gap: 8 }}>
            {archived.map((p) => {
              const isOpen = openArchived === p.id;
              return (
                <div key={p.id} className="archslot">
                  <SwipeToDelete itemLabel={p.title} wrapperStyle={{ borderRadius: 'var(--r-md)' }} onClick={() => setOpenArchived(isOpen ? null : p.id)} onDelete={() => deletePromotion(p.id).then(refetch)}>
                    <div role="button" tabIndex={0} className="archrow" aria-expanded={isOpen} aria-label={p.title}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenArchived(isOpen ? null : p.id); } }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                        <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 2 }}>{[p.brand, reasonLabel(p)].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span aria-hidden="true" style={{ color: 'var(--ink3)' }}>{isOpen ? '⌃' : '⌄'}</span>
                    </div>
                  </SwipeToDelete>
                  {isOpen && <div style={{ marginTop: 8 }}>{renderPromo(p)}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
