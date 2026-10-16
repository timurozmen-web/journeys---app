import { useRef, useState } from 'react';
import { useVouchers } from '../lib/useLiveData';
import { setVoucherRedeemed, updateLoyaltyProgramme } from '../lib/queries';
import { SectionLabel } from './ui';
import type { StatusProgress } from '../lib/statusProgress';
import { nightSegments, ringTicks, spendTicks } from '../lib/statusRing';
import { StatusRing } from './StatusRing';
import { voucherDates } from '../lib/voucherDates';
import { formatDate } from '../lib/format';
import type { LoyaltyProgramme, PaymentCard } from '../types';

// One programme in full, on its own page under Status: the nights ring
// (swipe across for spend), its balance, tier and nights stayed (each
// edited where it's shown), where its bonus nights come from, Brand
// Explorer, and the vouchers its cards have earned.
export function ProgrammeDetail({ p, progress, paymentCards, onSave }: {
  p: LoyaltyProgramme;
  progress: StatusProgress | null;
  paymentCards: PaymentCard[];
  onSave: (patch: Parameters<typeof updateLoyaltyProgramme>[1]) => void;
}) {
  const { data: vouchers, refetch: refetchVouchers } = useVouchers();
  const today = new Date().toISOString().slice(0, 10);
  const save = (_name: string, patch: Parameters<typeof updateLoyaltyProgramme>[1]) => onSave(patch);
  // A card's own programme brand where possible (auto-synced vouchers store
  // the card id as source), falling back to a fuzzy name match for
  // manually-added ones.
  const relevantCardIds = new Set(paymentCards.filter((c) => c.programmeBrand === p.name).map((c) => c.id));
  const relevantVouchers = vouchers.filter(
    (v) => !v.redeemed && (relevantCardIds.has(v.source) || v.source.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]))
  );

  return (
    <div className="prog-body">
      {progress && progress.total > 0 && <RingPager progress={progress} />}
      <div className="dd-row">
        <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Points</span>
        <input
          className="input compact inline-value" type="number" inputMode="numeric" aria-label={`${p.name} points`}
          defaultValue={p.points}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          // Entering a balance records it as of today: stays up to now are
          // in it, so the baseline moves to today (nights stayed too, kept
          // in step) and only later stays are added on top. Only stays are
          // stored: bonus nights are added from their sources on every read,
          // so storing the full total counted them twice.
          onBlur={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isFinite(v) || v === p.points) return;
            save(p.name, { points: v, nightsBaselineDate: today, ...(p.nights != null && progress ? { nights: progress.breakdown.stays } : {}) });
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

      {progress && progress.total > 0 && (
        <div className="dd-row">
          <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Nights stayed this year</span>
          <input
            key={progress.breakdown.stays}
            className="input compact inline-value" type="number" inputMode="numeric" aria-label={`${p.name} nights stayed this year`}
            defaultValue={progress.breakdown.stays}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            // Stays only: card, membership and promotion nights are added
            // from their own sources. The baseline moves to today, so the
            // live points balance is stored with it to keep stays since the
            // old baseline in the points too.
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isFinite(v) || v < 0 || v === progress.breakdown.stays) return;
              save(p.name, { nights: v, nightsBaselineDate: today, points: p.points });
            }}
          />
        </div>
      )}

      {progress && progress.bonusNights.length > 0 && (
        <div>
          <SectionLabel style={{ marginBottom: 6 }}>Bonus nights</SectionLabel>
          <div className="bonuslist">
            {progress.bonusNights.map((b, idx) => (
              <div key={`${b.from}-${idx}`} className={b.earned ? 'bonusrow' : 'bonusrow tocome'}>
                <span className="sw" style={{ background: b.earned ? BONUS_COLOUR[b.source] : undefined }} aria-hidden="true" />
                <span className="what">{b.note}</span>
                <span className="n">{b.earned ? `+${b.nights}` : `+${b.nights} to come`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {progress?.brandExplorer && (
        <div>
          <SectionLabel style={{ marginBottom: 6 }}>Brand Explorer</SectionLabel>
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
              <span key={b} className="tag solid">{b}</span>
            ))}
            {progress.brandExplorer.brandsPending.map((b) => (
              <span key={b} className="tag">{b} · booked</span>
            ))}
          </div>
        </div>
      )}

      {relevantVouchers.length > 0 && (
        <div>
          <SectionLabel style={{ marginBottom: 6 }}>Vouchers</SectionLabel>
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

    </div>
  );
}

const BONUS_COLOUR = { card: 'var(--brand2)', membership: 'var(--member)', promo: 'var(--promo)' } as const;

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
  const segs = nightSegments(progress.breakdown);
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
          {/* Stays always; each other source only when it has nights. */}
          <Legend items={segs.filter((s) => s.key === 'stays' || s.count > 0).map((s) => ({ label: s.label, value: String(s.count), colour: s.colour }))} />
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
