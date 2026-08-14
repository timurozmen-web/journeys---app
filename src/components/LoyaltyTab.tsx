import { useState } from 'react';
import { BrandMark } from './BrandMark';
import { useVouchers } from '../lib/useLiveData';
import { setVoucherRedeemed } from '../lib/queries';
import { computeStatusProgress } from '../lib/statusProgress';
import type { LoyaltyProgramme, Hotel, Promotion, PaymentCard } from '../types';

type Category = 'hotel' | 'airline';

function moneyPrecise(n: number): string {
  if (n === 0) return '£0';
  if (Math.abs(n) < 100) return `£${n.toFixed(2)}`;
  return `£${Math.round(n).toLocaleString()}`;
}

export function LoyaltyTab({
  programmes, hotels, promotions, paymentCards,
}: {
  programmes: LoyaltyProgramme[]; hotels: Hotel[]; promotions: Promotion[]; paymentCards: PaymentCard[];
}) {
  const { data: vouchers, refetch: refetchVouchers } = useVouchers();
  const [category, setCategory] = useState<Category>('hotel');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = programmes.filter((p) => p.category === category);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="catchip" style={{ margin: '0 0 4px' }}>
        {(['hotel', 'airline'] as Category[]).map((c) => (
          <button key={c} className={category === c ? 'won' : ''} onClick={() => { setCategory(c); setOpen(null); }}>
            {c === 'hotel' ? 'Hotels' : 'Airlines'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
          No {category} programmes yet.
        </div>
      )}

      {filtered.map((p) => {
        const isOpen = open === p.name;
        const value = (p.points * p.ptValue) / 100;
        const hasStatus = !!p.nextTier && p.nights != null && p.nightsNeeded != null;
        const progress = hasStatus ? computeStatusProgress(p, hotels, promotions) : null;

        // Vouchers relevant to this programme: match by the issuing
        // card's own programme brand where possible (auto-synced
        // vouchers store the card id as source), falling back to a
        // fuzzy name match for manually-added ones.
        const relevantCardIds = new Set(paymentCards.filter((c) => c.programmeBrand === p.name).map((c) => c.id));
        const relevantVouchers = vouchers.filter(
          (v) => !v.redeemed && (relevantCardIds.has(v.source) || v.source.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]))
        );

        return (
          <div key={p.name} style={{ borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(isOpen ? null : p.name)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: p.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <BrandMark shape={p.shape} color="#fff" size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 1 }}>{p.tier ?? '—'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.points.toLocaleString()} pts</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 1 }}>{moneyPrecise(value)}</div>
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: '0 14px 16px', display: 'grid', gap: 14 }}>
                <div className="dd-row">
                  <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>Rate</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.ptValue}p per point</span>
                </div>

                {progress && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>
                        {progress.currentNights} of {progress.total} nights
                        {progress.bookedNights + progress.pendingNights > 0 && (
                          <span style={{ color: 'var(--amber)', fontWeight: 700 }}> (+{progress.bookedNights + progress.pendingNights} pending)</span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>{p.nextTier}</span>
                    </div>
                    <div className="hbar" style={{ position: 'relative' }}>
                      {progress.pct3 != null && (
                        <i style={{ width: `${Math.max(0, Math.min(100, progress.pct3))}%`, background: 'rgba(156,95,8,.35)', position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                      )}
                      {progress.pct2 != null && (
                        <i style={{ width: `${Math.max(0, Math.min(100, progress.pct2))}%`, background: 'var(--card2)', position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                      )}
                      <i style={{ width: `${progress.pct ?? 0}%`, background: p.color, position: 'relative' }} />
                    </div>
                    {progress.spendBar && (
                      <>
                        <div style={{ fontSize: 11.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 8 }}>
                          Qualifying spend: ${Math.round(progress.spendBar.spendUSD).toLocaleString()} / $23,000
                        </div>
                        <div className="hbar" style={{ marginTop: 4 }}>
                          <i style={{ width: `${progress.spendBar.pct}%`, background: p.color }} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {relevantVouchers.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                      Vouchers
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {relevantVouchers.map((v) => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'var(--card2)' }}>
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => setVoucherRedeemed(v.id, true).then(refetchVouchers)}
                            style={{ width: 17, height: 17, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600 }}>{v.name}</div>
                          {v.value != null && <div style={{ fontSize: 12.5, fontWeight: 700 }}>£{v.value.toFixed(2)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
