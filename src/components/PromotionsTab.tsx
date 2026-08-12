import { useState } from 'react';
import { usePromotions } from '../lib/useLiveData';
import { addPromotion, deletePromotion } from '../lib/queries';

export function PromotionsTab() {
  const { data: promotions, refetch } = usePromotions();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', brand: '', startDate: '', endDate: '' });

  const today = new Date().toISOString().slice(0, 10);

  async function handleAdd() {
    if (!form.title) return;
    setSaving(true);
    try {
      await addPromotion({
        title: form.title, description: form.description || null, brand: form.brand || null,
        startDate: form.startDate || null, endDate: form.endDate || null,
      });
      setForm({ title: '', description: '', brand: '', startDate: '', endDate: '' });
      setAdding(false);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack" style={{ display: 'grid', gap: 10 }}>
      {promotions.length === 0 && !adding && (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
          No promotions logged yet.
        </div>
      )}

      {promotions.map((p) => {
        const isActive = (!p.startDate || p.startDate <= today) && (!p.endDate || p.endDate >= today);
        return (
          <div
            key={p.id}
            style={{
              padding: '12px 14px', borderRadius: 12, background: 'var(--card)',
              border: `1px solid ${isActive ? 'var(--brand)' : 'var(--line)'}`, position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.title}</div>
              {isActive && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand)', background: 'rgba(19,34,71,.08)', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>
                  ACTIVE
                </span>
              )}
            </div>
            {p.brand && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>{p.brand}</div>}
            {p.description && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 6 }}>{p.description}</div>}
            {(p.startDate || p.endDate) && (
              <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 6 }}>
                {p.startDate ?? '…'} – {p.endDate ?? '…'}
              </div>
            )}
            <button
              onClick={() => deletePromotion(p.id).then(refetch)}
              style={{ position: 'absolute', top: 10, right: isActive ? 68 : 10, background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 12, cursor: 'pointer' }}
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
          <input
            placeholder="Brand (optional)"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
          />
          <textarea
            placeholder="What it offers (optional)"
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
