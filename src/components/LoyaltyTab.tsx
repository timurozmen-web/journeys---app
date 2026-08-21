import { useState } from 'react';
import { BrandLogo, hasWordmarkLogo } from './BrandLogo';
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
  programmes, hotels, promotions, paymentCards, cardResults,
}: {
  programmes: LoyaltyProgramme[]; hotels: Hotel[]; promotions: Promotion[]; paymentCards: PaymentCard[];
  cardResults?: Parameters<typeof computeStatusProgress>[3];
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
        const progress = hasStatus ? computeStatusProgress(p, hotels, promotions, cardResults) : null;

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
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--ink)',
              }}
            >
              <BrandLogo name={p.name} shape={p.shape} color={p.color} accent={p.accent} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {!hasWordmarkLogo(p.name) && <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>}
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 1 }}>
                  {progress?.effectiveTier ?? p.tier ?? '—'}
                </div>
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
                      <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>
                        {progress.targetTier ?? p.nextTier}
                      </span>
                    </div>
                    {progress.cardGrantedTier && (
                      <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 6 }}>
                        {progress.cardGrantedTier} held via card — working toward {progress.targetTier ?? 'the next tier'}
                      </div>
                    )}
                    {progress.uniqueBrandNights > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 6 }}>
                        +{progress.uniqueBrandNights} elite nights from {progress.uniqueBrandCount} unique brands (promotion)
                      </div>
                    )}
                    <div
                      className="hbar"
                      style={{
                        position: 'relative', background: 'var(--card2)',
                        border: '1px solid var(--line)', boxSizing: 'border-box',
                      }}
                    >
                      {progress.pendingPct != null && (
                        <i
                          style={{
                            width: `${Math.max(0, Math.min(100, progress.pendingPct))}%`, background: 'rgba(156,95,8,.4)',
                            position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 99,
                          }}
                        />
                      )}
                      <i
                        style={{
                          width: `${Math.max(0, Math.min(100, progress.pct ?? 0))}%`, background: p.color,
                          position: 'relative', borderRadius: 99, display: 'block', height: '100%',
                        }}
                      />
                    </div>
                    {progress.spendProgress && (
                      <>
                        <div style={{ fontSize: 11.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 8 }}>
                          {progress.spendProgress.label}: {progress.spendProgress.currencySymbol ?? ''}
                          {Math.round(progress.spendProgress.currentAmount).toLocaleString()}
                          {progress.spendProgress.unit === 'points' ? ' pts' : ''}
                          {' / '}{progress.spendProgress.currencySymbol ?? ''}{Math.round(progress.spendProgress.requiredAmount).toLocaleString()}
                          {progress.spendProgress.unit === 'points' ? ' pts' : ''}
                          {progress.spendProgress.pendingAmount > 0 && (
                            <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
                              {' '}(+{Math.round(progress.spendProgress.pendingAmount).toLocaleString()} pending)
                            </span>
                          )}
                        </div>
                        <div className="hbar" style={{ marginTop: 4, position: 'relative', background: 'var(--card2)', border: '1px solid var(--line)', boxSizing: 'border-box' }}>
                          {progress.spendProgress.pendingPct != null && (
                            <i
                              style={{
                                width: `${progress.spendProgress.pendingPct}%`, background: 'rgba(156,95,8,.4)',
                                position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 99,
                              }}
                            />
                          )}
                          <i style={{ width: `${progress.spendProgress.pct}%`, background: p.color, borderRadius: 99, display: 'block', height: '100%', position: 'relative' }} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {progress && progress.cardEliteNights.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                      Elite nights from cards
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {progress.cardEliteNights.map((c, idx) => (
                        <div key={`${c.cardId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                          <span style={{ color: c.earned ? 'var(--ink2)' : 'var(--amber)' }}>
                            {c.earned ? '✓' : '○'} {c.note}
                          </span>
                          <span style={{ fontWeight: 700, color: c.earned ? 'var(--ink)' : 'var(--amber)', flexShrink: 0 }}>
                            +{c.nights}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {progress && progress.appliedPromoNights > 0 && (
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(58,168,94,.1)', border: '1px solid rgba(58,168,94,.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                      ✓ {progress.appliedPromoNights} promotion night{progress.appliedPromoNights === 1 ? '' : 's'} marked applied
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                      Make sure your nights total above already reflects this — {p.name} should have credited it directly to your account.
                    </div>
                  </div>
                )}

                {progress?.brandExplorer && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                      Brand Explorer
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 6 }}>
                      {progress.brandExplorer.completedCount} distinct brand{progress.brandExplorer.completedCount === 1 ? '' : 's'} stayed
                      {progress.brandExplorer.pendingCount > 0 && (
                        <span style={{ color: 'var(--amber)', fontWeight: 700 }}> (+{progress.brandExplorer.pendingCount} pending)</span>
                      )}
                      {' · '}{progress.brandExplorer.brandsToNextVoucher} more to a free night
                    </div>
                    {progress.brandExplorer.vouchersEarned > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginBottom: 6 }}>
                        {progress.brandExplorer.vouchersEarned} free night award{progress.brandExplorer.vouchersEarned === 1 ? '' : 's'} earned (Category 1–5, valid 12 months)
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {progress.brandExplorer.brandsStayed.map((b) => (
                        <span key={b} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(91,63,166,.1)', color: 'var(--brand)' }}>
                          {b}
                        </span>
                      ))}
                      {progress.brandExplorer.brandsPending.map((b) => (
                        <span key={b} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(156,95,8,.12)', color: 'var(--amber)' }}>
                          {b} (booked)
                        </span>
                      ))}
                    </div>
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
