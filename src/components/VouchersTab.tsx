import { useState, useEffect } from 'react';
import { useVouchers } from '../lib/useLiveData';
import { addVoucher, setVoucherRedeemed, syncCardVouchers } from '../lib/queries';
import { computeCardVoucherCandidates, type CardResult } from '../lib/cardMath';

export function VouchersTab({ cardResults }: { cardResults: CardResult[] }) {
  const { data: vouchers, refetch } = useVouchers();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', source: '', value: '', earnedDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  // Auto-sync any newly-hit card vouchers once, when real card results are available.
  useEffect(() => {
    if (cardResults.length === 0) return;
    const candidates = computeCardVoucherCandidates(cardResults);
    if (candidates.length === 0) return;
    syncCardVouchers(candidates)
      .then(() => refetch())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardResults.length]);

  const active = vouchers.filter((v) => !v.redeemed);
  const used = vouchers.filter((v) => v.redeemed);

  async function handleAdd() {
    if (!form.name || !form.source) return;
    setSaving(true);
    try {
      await addVoucher({
        name: form.name, source: form.source, value: form.value ? parseFloat(form.value) : null,
        earnedDate: form.earnedDate, expiryDate: null, sourceKey: null,
      });
      setForm({ name: '', source: '', value: '', earnedDate: new Date().toISOString().slice(0, 10) });
      setAdding(false);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  const rowStyle = (grayscale: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
    borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)',
    filter: grayscale ? 'grayscale(1)' : undefined, opacity: grayscale ? 0.6 : 1,
  });

  return (
    <div className="stack" style={{ display: 'grid', gap: 10 }}>
      {vouchers.length === 0 && !adding && (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
          No vouchers yet — card-earned ones sync in automatically, or add one manually below.
        </div>
      )}

      {active.map((v) => (
        <div key={v.id} style={rowStyle(false)}>
          <input
            type="checkbox"
            checked={false}
            onChange={() => setVoucherRedeemed(v.id, true).then(refetch)}
            style={{ width: 20, height: 20, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{v.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
              {v.source} · earned {v.earnedDate}{v.expiryDate ? ` · expires ${v.expiryDate}` : ''}
            </div>
          </div>
          {v.value != null && <div style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>£{v.value.toFixed(2)}</div>}
        </div>
      ))}

      {used.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 8 }}>
            Used
          </div>
          {used.map((v) => (
            <div key={v.id} style={rowStyle(true)}>
              <input
                type="checkbox"
                checked={true}
                onChange={() => setVoucherRedeemed(v.id, false).then(refetch)}
                style={{ width: 20, height: 20, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textDecoration: 'line-through' }}>{v.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                  {v.source} · used {v.redeemedDate}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: '10px 0', borderRadius: 10, border: '1px dashed var(--line)', background: 'var(--card2)',
            color: 'var(--ink2)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Add voucher manually
        </button>
      ) : (
        <div style={{ display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)' }}>
          <input
            placeholder="Voucher name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
          />
          <input
            placeholder="Source (e.g. Hilton Debit, promo)"
            value={form.source}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
          />
          <input
            placeholder="Value (£, optional)"
            type="number"
            step="0.01"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAdd}
              disabled={saving || !form.name || !form.source}
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
