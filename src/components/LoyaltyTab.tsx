import { useRef, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { useVouchers } from '../lib/useLiveData';
import { deleteLoyaltyProgramme, setVoucherRedeemed, updateLoyaltyProgramme } from '../lib/queries';
import { SwipeToDelete } from './SwipeToDelete';
import { ErrorText } from './ui';
import { computeStatusProgress, type StatusProgress } from '../lib/statusProgress';
import { ringTicks, spendTicks, type RingSegment } from '../lib/statusRing';
import { StatusRing } from './StatusRing';
import { computeLoyaltyInsights } from '../lib/loyaltyInsights';
import { voucherDates } from '../lib/voucherDates';
import { formatDate } from '../lib/format';
import type { LoyaltyProgramme, Hotel, Promotion, PaymentCard } from '../types';

type Category = 'hotel' | 'airline';

// Values are shown to the pound, like every other figure in the wallet
// (the One Key Cash balance was showing as £31.00).
function moneyPrecise(n: number): string {
  return `£${Math.round(n).toLocaleString()}`;
}

export function LoyaltyTab({
  programmes, hotels, promotions, paymentCards, cardResults, refetchProgrammes,
}: {
  programmes: LoyaltyProgramme[]; hotels: Hotel[]; promotions: Promotion[]; paymentCards: PaymentCard[];
  cardResults?: Parameters<typeof computeStatusProgress>[3];
  refetchProgrammes: () => void;
}) {
  const { data: vouchers, refetch: refetchVouchers } = useVouchers();
  const [category, setCategory] = useState<Category>('hotel');
  const [open, setOpen] = useState<string | null>(null);
  // Removed this session: hidden straight away, before the refetch lands.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  async function remove(name: string) {
    setError('');
    try {
      await deleteLoyaltyProgramme(name);
      setRemoved((r) => new Set(r).add(name));
      if (open === name) setOpen(null);
      refetchProgrammes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete it.');
    }
  }

  // Saves a changed balance or tier when you leave the field.
  async function save(name: string, patch: Parameters<typeof updateLoyaltyProgramme>[1]) {
    setError('');
    try {
      await updateLoyaltyProgramme(name, patch);
      refetchProgrammes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const filtered = programmes.filter((p) => p.category === category && !removed.has(p.name));
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

      {error && <ErrorText>{error}</ErrorText>}
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
        const brandInsight = insights.byBrand.find((b) => b.brand === p.name);

        // card's own programme brand where possible (auto-synced
        // vouchers store the card id as source), falling back to a
        // fuzzy name match for manually-added ones.
        const relevantCardIds = new Set(paymentCards.filter((c) => c.programmeBrand === p.name).map((c) => c.id));
        const relevantVouchers = vouchers.filter(
          (v) => !v.redeemed && (relevantCardIds.has(v.source) || v.source.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]))
        );

        return (
          <div key={p.name} className="prog">
            <SwipeToDelete itemLabel={p.name} surface="var(--card)" wrapperStyle={{ borderRadius: 0 }} onClick={() => setOpen(isOpen ? null : p.name)} onDelete={() => remove(p.name)}>
            <div
              className="prog-head" role="button" tabIndex={0} aria-expanded={isOpen}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : p.name); } }}
            >
              {progress && progress.total > 0 ? (
                <StatusRing ticks={ringTicks(progress.total, nightSegments(progress))} size={46} label={`${progress.currentNights} of ${progress.total} nights`}>
                  <BrandLogo name={p.name} shape={p.shape} color={p.color} accent={p.accent} size={26} />
                </StatusRing>
              ) : (
                <BrandLogo name={p.name} shape={p.shape} color={p.color} accent={p.accent} size={34} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="prog-name">{p.name}</div>
                <div className="prog-sub">
                  {[tier, progress && progress.total > 0 ? `${progress.currentNights}/${progress.total} nights` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <div className="prog-pts">{p.points.toLocaleString()}</div>
                <div className="prog-val">{moneyPrecise(value)}</div>
              </div>
            </div>
            </SwipeToDelete>

            {isOpen && (
              <div className="prog-body">
                {progress && progress.total > 0 && <RingPager progress={progress} />}
                <div className="dd-row">
                  <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Points</span>
                  <input
                    className="input compact inline-value" type="number" inputMode="numeric" aria-label={`${p.name} points`}
                    defaultValue={p.points}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    // Entering a balance records it as of today: stays up to now are
                    // in it, so the baseline moves to today (nights too, kept in step)
                    // and only later stays are added on top.
                    onBlur={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isFinite(v) || v === p.points) return;
                      save(p.name, { points: v, nightsBaselineDate: today, ...(p.nights != null && progress ? { nights: progress.currentNights } : {}) });
                    }}
                  />
                </div>
                {(p.stayPoints ?? 0) > 0 && (
                  <div className="dd-row">
                    <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>From stays since {formatDate(p.nightsBaselineDate ?? today)}</span>
                    <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--green)' }}>+{(p.stayPoints ?? 0).toLocaleString()}</span>
                  </div>
                )}
                {(p.pendingStayPoints ?? 0) > 0 && (
                  <div className="dd-row">
                    <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Pending from booked stays</span>
                    <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--amber)' }}>+{(p.pendingStayPoints ?? 0).toLocaleString()}</span>
                  </div>
                )}
                {p.category !== 'airline' && (<>
                <div className="dd-row">
                  <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Tier</span>
                  <input
                    className="input compact inline-value" aria-label={`${p.name} tier`} placeholder="None"
                    defaultValue={p.tier ?? ''}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (p.tier ?? null)) save(p.name, { tier: v }); }}
                  />
                </div>
                <div className="dd-row">
                  <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Rate</span>
                  <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>{p.ptValue}p per point</span>
                </div>
                </>)}

                {progress?.cardGrantedTier && (
                  <div className="dd-row">
                    <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Held via card</span>
                    <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>{progress.cardGrantedTier}</span>
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
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-small)', fontWeight: 600 }}>{v.name}</div>
                            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 2 }}>{voucherDates(v, today)}</div>
                          </div>
                          {v.value != null && <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>£{Math.round(v.value).toLocaleString()}</div>}
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

// Where the nights came from, in ring order: stays, card nights,
// promotions, then booked stays still to come.
function nightSegments(p: StatusProgress): RingSegment[] {
  return [
    { key: 'stays', label: 'Stays', count: p.breakdown.stays, colour: 'var(--ink)' },
    { key: 'card', label: 'Card', count: p.breakdown.card, colour: 'var(--brand2)' },
    { key: 'promos', label: 'Promos', count: p.breakdown.promos, colour: 'var(--promo)' },
    { key: 'pending', label: 'Booked', count: p.breakdown.pending, colour: 'var(--pending)' },
  ];
}

function Legend({ items }: { items: { label: string; value: string; colour: string; zero?: boolean }[] }) {
  return (
    <div className="ringlegend">
      {items.map((it) => (
        <div key={it.label}>
          <div className="l"><span className="sw" style={{ background: it.colour }} />{it.label}</div>
          <div className={it.zero ? 'v zero' : 'v'}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

// The nights ring, and beside it (swipe across) the spend requirement on
// the same kind of ring, when the programme has one.
function RingPager({ progress }: { progress: StatusProgress }) {
  const [page, setPage] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const sp = progress.spendProgress;
  const pages = sp ? ['Nights', sp.unit === 'points' ? 'Status points' : 'Spend'] : ['Nights'];
  const segs = nightSegments(progress);
  const toGo = Math.max(0, progress.total - progress.currentNights);
  const money = (n: number) => `${sp?.currencySymbol ?? ''}${Math.round(n).toLocaleString()}`;
  const go = (i: number) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' });
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {pages.length > 1 && <Tabs pages={pages} page={page} go={go} />}
      <div
        className="ringpager" ref={ref}
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
      >
        <div className="ringpage">
          <StatusRing ticks={ringTicks(progress.total, segs)} size={220} label={`${progress.currentNights} of ${progress.total} nights`}>
            <div className="ring-big">{progress.currentNights}</div>
            <div className="ring-of">of {progress.total} nights</div>
            <div className="ring-go">{toGo > 0 ? `${toGo} to go` : `${progress.targetTier ?? 'Tier'} reached`}</div>
          </StatusRing>
          <Legend items={segs.map((s) => ({ label: s.label, value: String(s.count), colour: s.colour, zero: s.count === 0 }))} />
        </div>
        {sp && (() => {
          const t = spendTicks(sp.currentAmount, sp.pendingAmount, sp.requiredAmount);
          const left = Math.max(0, sp.requiredAmount - sp.currentAmount);
          const unit = sp.unit === 'points' ? ' pts' : '';
          return (
            <div className="ringpage">
              <StatusRing
                ticks={ringTicks(100, [
                  { key: 'done', label: '', count: t.done, colour: 'var(--ink)' },
                  { key: 'pending', label: '', count: t.pending, colour: 'var(--pending)' },
                ])}
                size={220} label={`${money(sp.currentAmount)} of ${money(sp.requiredAmount)}`}
              >
                <div className="ring-big money">{money(sp.currentAmount)}</div>
                <div className="ring-of">of {money(sp.requiredAmount)}{unit}</div>
                <div className="ring-go">{left > 0 ? `${money(left)}${unit} to go` : 'Reached'}</div>
              </StatusRing>
              <Legend items={[
                { label: sp.unit === 'points' ? 'Earned' : 'Stays paid', value: `${money(sp.currentAmount)}`, colour: 'var(--ink)' },
                { label: 'Booked', value: `${money(sp.pendingAmount)}`, colour: 'var(--pending)', zero: sp.pendingAmount === 0 },
              ]} />
            </div>
          );
        })()}
      </div>
      {pages.length > 1 && <div className="ringdots" aria-hidden="true">{pages.map((pg, i) => <i key={pg} className={i === page ? 'on' : ''} />)}</div>}
    </div>
  );
}

function Tabs({ pages, page, go }: { pages: string[]; page: number; go: (i: number) => void }) {
  return (
    <div className="ringpage-tabs" role="tablist">
      {pages.map((pg, i) => (
        <button key={pg} role="tab" aria-selected={i === page} className={i === page ? 'on' : ''} onClick={() => go(i)}>{pg}</button>
      ))}
    </div>
  );
}
