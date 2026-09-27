import { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { hasWordmarkLogo } from '../data/brandLogos';
import { useVouchers } from '../lib/useLiveData';
import { setVoucherRedeemed } from '../lib/queries';
import { computeStatusProgress } from '../lib/statusProgress';
import { computeLoyaltyInsights } from '../lib/loyaltyInsights';
import { cardBackground, luminance, textOn, tierFinish } from '../lib/cardTheme';
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
  const insights = computeLoyaltyInsights(hotels, programmes, new Date().getFullYear());

  return (
    <div style={{ display: 'grid', gap: 12, padding: '0 16px' }}>
      <div className="catchip" style={{ margin: '0 0 4px', padding: '0 4px 4px' }}>
        {(['hotel', 'airline'] as Category[]).map((c) => (
          <button key={c} className={category === c ? 'won' : ''} onClick={() => { setCategory(c); setOpen(null); }}>
            {c === 'hotel' ? 'Hotels' : 'Airlines'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 'var(--fs-body)' }}>
          No {category} programmes yet.
        </div>
      )}

      {filtered.map((p) => {
        const isOpen = open === p.name;
        const value = (p.points * p.ptValue) / 100;
        const hasStatus = !!p.nextTier && p.nights != null;
        const progress = hasStatus ? computeStatusProgress(p, hotels, promotions, cardResults) : null;
        const tier = progress?.effectiveTier ?? p.tier;
        const ink = textOn(p.color);
        const brandInsight = insights.byBrand.find((b) => b.brand === p.name);

        // card's own programme brand where possible (auto-synced
        // vouchers store the card id as source), falling back to a
        // fuzzy name match for manually-added ones.
        const relevantCardIds = new Set(paymentCards.filter((c) => c.programmeBrand === p.name).map((c) => c.id));
        const relevantVouchers = vouchers.filter(
          (v) => !v.redeemed && (relevantCardIds.has(v.source) || v.source.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]))
        );

        return (
          <div key={p.name} className="brandcard" style={{ background: cardBackground(p.color), color: ink }}>
            <button
              onClick={() => setOpen(isOpen ? null : p.name)}
              aria-expanded={isOpen}
              style={{ width: '100%', display: 'block', padding: '16px 16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                  <BrandLogo name={p.name} shape={p.shape} color={p.color} accent={p.accent} size={32} />
                  {!hasWordmarkLogo(p.name) && <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>}
                </div>
                {tier && <span className={`tierchip ${tierFinish(tier)}`}>{tier}</span>}
                <span aria-hidden="true" style={{ fontSize: 'var(--fs-caption)', opacity: 0.7, flexShrink: 0 }}>{isOpen ? '⌃' : '⌄'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18, gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-h1)', fontWeight: 400, letterSpacing: '-.5px', lineHeight: 1 }}>{p.points.toLocaleString()}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', opacity: 0.72, marginTop: 4 }}>points · {p.ptValue}p each</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--fs-title)', fontWeight: 500 }}>{moneyPrecise(value)}</div>
                  {progress?.targetTier && progress.total > progress.currentNights && (
                    <div style={{ fontSize: 'var(--fs-caption)', opacity: 0.72, marginTop: 2 }}>
                      {progress.total - progress.currentNights} nights to {progress.targetTier}
                    </div>
                  )}
                </div>
              </div>
            </button>
            {progress && (
              <div className="bc-progress" aria-hidden="true">
                <i style={{ width: `${Math.max(0, Math.min(100, progress.pct ?? 0))}%`, background: p.accent && luminance(p.accent) > 0.05 ? p.accent : 'var(--brand)' }} />
              </div>
            )}

            {isOpen && (
              <div style={{ padding: '14px 14px 16px', background: 'var(--card)', color: 'var(--ink)', display: 'grid', gap: 14 }}>
                <div className="dd-row">
                  <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Rate</span>
                  <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>{p.ptValue}p per point</span>
                </div>

                {progress && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>
                        {progress.currentNights} of {progress.total} nights
                        {progress.bookedNights + progress.pendingNights > 0 && (
                          <span style={{ color: 'var(--amber)', fontWeight: 700 }}> (+{progress.bookedNights + progress.pendingNights} pending)</span>
                        )}
                      </span>
                      <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>
                        {progress.targetTier ?? p.nextTier}
                      </span>
                    </div>
                    {progress.cardGrantedTier && (
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginBottom: 6 }}>
                        {progress.cardGrantedTier} held via card — working toward {progress.targetTier ?? 'the next tier'}
                      </div>
                    )}
                    {progress.uniqueBrandNights > 0 && (
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginBottom: 6 }}>
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
                            width: `${Math.max(0, Math.min(100, progress.pendingPct))}%`, background: 'rgba(232,176,75,.45)',
                            position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 'var(--r-pill)',
                          }}
                        />
                      )}
                      <i
                        style={{
                          width: `${Math.max(0, Math.min(100, progress.pct ?? 0))}%`, background: p.color,
                          position: 'relative', borderRadius: 'var(--r-pill)', display: 'block', height: '100%',
                        }}
                      />
                    </div>
                    {progress.spendProgress && (
                      <>
                        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink2)', fontWeight: 600, marginTop: 8 }}>
                          {progress.spendProgress.label}: {progress.spendProgress.currencySymbol ?? ''}
                          {Math.round(progress.spendProgress.currentAmount).toLocaleString()}
                          {progress.spendProgress.unit === 'points' ? ' pts' : ''}
                          {' / '}{progress.spendProgress.currencySymbol ?? ''}{Math.round(progress.spendProgress.requiredAmount).toLocaleString()}
                          {progress.spendProgress.unit === 'points' ? ' pts' : ''}
                          {progress.spendProgress.pendingAmount > 0 && (
                            <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
                              {' '}(+{progress.spendProgress.currencySymbol ?? ''}{Math.round(progress.spendProgress.pendingAmount).toLocaleString()} pending)
                            </span>
                          )}
                        </div>
                        <div className="hbar" style={{ marginTop: 4, position: 'relative', background: 'var(--card2)', border: '1px solid var(--line)', boxSizing: 'border-box' }}>
                          {progress.spendProgress.pendingPct != null && (
                            <i
                              style={{
                                width: `${progress.spendProgress.pendingPct}%`, background: 'rgba(232,176,75,.45)',
                                position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 'var(--r-pill)',
                              }}
                            />
                          )}
                          <i style={{ width: `${progress.spendProgress.pct}%`, background: p.color, borderRadius: 'var(--r-pill)', display: 'block', height: '100%', position: 'relative' }} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {progress && progress.cardEliteNights.length > 0 && (
                  <div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                      Elite nights from cards
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {progress.cardEliteNights.map((c, idx) => (
                        <div key={`${c.cardId}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--fs-small)' }}>
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
                  <div style={{ padding: '10px 12px', borderRadius: 'var(--r-control)', background: 'rgba(111,207,151,.12)', border: '1px solid rgba(111,207,151,.3)' }}>
                    <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--green)' }}>
                      ✓ {progress.appliedPromoNights} promotion night{progress.appliedPromoNights === 1 ? '' : 's'} marked applied
                    </div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 2 }}>
                      Make sure your nights total above already reflects this — {p.name} should have credited it directly to your account.
                    </div>
                  </div>
                )}

                {progress?.brandExplorer && (
                  <div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                      Brand Explorer
                    </div>
                    <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', marginBottom: 6 }}>
                      {progress.brandExplorer.completedCount} distinct brand{progress.brandExplorer.completedCount === 1 ? '' : 's'} stayed
                      {progress.brandExplorer.pendingCount > 0 && (
                        <span style={{ color: 'var(--amber)', fontWeight: 700 }}> (+{progress.brandExplorer.pendingCount} pending)</span>
                      )}
                      {' · '}{progress.brandExplorer.brandsToNextVoucher} more to a free night
                    </div>
                    {progress.brandExplorer.vouchersEarned > 0 && (
                      <div style={{ fontSize: 'var(--fs-small)', color: 'var(--green)', fontWeight: 700, marginBottom: 6 }}>
                        {progress.brandExplorer.vouchersEarned} free night award{progress.brandExplorer.vouchersEarned === 1 ? '' : 's'} earned (Category 1–5, valid 12 months)
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {progress.brandExplorer.brandsStayed.map((b) => (
                        <span key={b} style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                          {b}
                        </span>
                      ))}
                      {progress.brandExplorer.brandsPending.map((b) => (
                        <span key={b} style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                          {b} (booked)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {relevantVouchers.length > 0 && (
                  <div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                      Vouchers
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {relevantVouchers.map((v) => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-xs)', background: 'var(--card2)' }}>
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => setVoucherRedeemed(v.id, true).then(refetchVouchers)}
                            style={{ width: 17, height: 17, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-small)', fontWeight: 600 }}>{v.name}</div>
                          {v.value != null && <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>£{v.value.toFixed(2)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {brandInsight && (brandInsight.loyaltyValue > 0 || brandInsight.rateSavings > 0) && (
                  <div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                      Value gained this year
                    </div>
                    <div style={{ display: 'grid', gap: 5 }}>
                      {brandInsight.benefitsByType.breakfast > 0 && <div className="dd-row"><span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)' }}>Free breakfast</span><span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>£{Math.round(brandInsight.benefitsByType.breakfast)}</span></div>}
                      {brandInsight.benefitsByType.upgrade > 0 && <div className="dd-row"><span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)' }}>Room upgrades</span><span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>£{Math.round(brandInsight.benefitsByType.upgrade)}</span></div>}
                      {brandInsight.benefitsByType.lounge > 0 && <div className="dd-row"><span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)' }}>Lounge access</span><span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>£{Math.round(brandInsight.benefitsByType.lounge)}</span></div>}
                      {brandInsight.benefitsByType.lateCheckout > 0 && <div className="dd-row"><span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)' }}>Late checkout</span><span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>£{Math.round(brandInsight.benefitsByType.lateCheckout)}</span></div>}
                      {brandInsight.benefitsByType.other > 0 && <div className="dd-row"><span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)' }}>Other perks</span><span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>£{Math.round(brandInsight.benefitsByType.other)}</span></div>}
                      <div className="dd-row"><span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)' }}>Points earned (value)</span><span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>£{Math.round(brandInsight.pointsValue)}</span></div>
                      {brandInsight.rateSavings > 0 && <div className="dd-row"><span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink3)' }}>Rate savings (not loyalty)</span><span style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--ink3)' }}>£{Math.round(brandInsight.rateSavings)}</span></div>}
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
