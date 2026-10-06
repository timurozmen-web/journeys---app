import { useNavigate } from 'react-router-dom';
import { useAllHotels, useAllFlights, useLoyaltyProgrammes, usePromotions, usePaymentCards, useBankLinks, useVouchers } from '../lib/useLiveData';
import { useCurrency } from '../lib/currency';
import { computeCardResults } from '../lib/cardMath';
import { computeStatusProgress } from '../lib/statusProgress';
import { withLiveOverrides } from '../lib/walletValue';
import { loyaltyHighlights } from '../lib/loyaltyHighlights';
import { computeWalletValueChange } from '../lib/hotelPlanner';
import { ringTicks } from '../lib/statusRing';
import { StatusRing } from '../components/StatusRing';
import { SectionSwitch } from '../components/SectionSwitch';
import { SettingsIcon } from '../components/Icons';

// The Loyalty home: what everything is worth, how close each status is,
// and the few things worth acting on now.
export function LoyaltyHome() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rawProgrammes } = useLoyaltyProgrammes();
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const { data: promotions } = usePromotions();
  const { data: paymentCards } = usePaymentCards();
  const { data: vouchers } = useVouchers();
  const { bankSpend } = useBankLinks();
  const { rates } = useCurrency();

  const cardResults = computeCardResults(hotels, flights, paymentCards, rawProgrammes, today, { bankSpend, rates }).filter((r) => r.cardRow);
  const programmes = withLiveOverrides(rawProgrammes, hotels, promotions);
  const value = programmes.reduce((s, p) => s + (p.points * p.ptValue) / 100, 0);
  const points = programmes.reduce((s, p) => s + p.points, 0);
  const statuses = programmes
    .filter((p) => p.category === 'hotel' && p.nextTier && p.nights != null)
    .map((p) => ({ p, progress: computeStatusProgress(p, hotels, promotions, cardResults) }))
    .filter((x) => x.progress.total > 0)
    .sort((a, b) => b.progress.currentNights / b.progress.total - a.progress.currentNights / a.progress.total);
  const change = computeWalletValueChange(hotels, programmes, vouchers, today);
  const highlights = loyaltyHighlights({ programmes: rawProgrammes, hotels, promotions, cardResults, vouchers, today });

  return (
    <div>
      <div style={{ background: 'var(--bg)', height: 'env(safe-area-inset-top, 0px)' }} />
      <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="h1" style={{ margin: 0 }}>Loyalty</h1>
        <div className="headtools">
          <SectionSwitch />
          <button className="lb-iconbtn" aria-label="Settings" onClick={() => navigate('/settings')}><SettingsIcon size={20} /></button>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        <button className="lh-value" onClick={() => navigate('/wallet')}>
          <span className="lh-label">Wallet value</span>
          <span className="lh-big">£{Math.round(value).toLocaleString()}</span>
          {change.hasData && (
            <span className={change.deltaValue >= 0 ? 'lh-delta up' : 'lh-delta down'}>
              {change.deltaValue >= 0 ? '▲' : '▼'} £{Math.round(Math.abs(change.deltaValue)).toLocaleString()} on last month
            </span>
          )}
          <span className="lh-sub">{points.toLocaleString()} points across {programmes.length} programmes</span>
        </button>
      </div>

      {statuses.length > 0 && (
        <>
          <div className="lh-section">Status</div>
          <div className="lh-rings">
            {statuses.map(({ p, progress }) => {
              const segs = [
                { key: 'stays', label: 'Stays', count: progress.breakdown.stays, colour: 'var(--ink)' },
                { key: 'card', label: 'Card', count: progress.breakdown.card, colour: 'var(--brand2)' },
                { key: 'promos', label: 'Promos', count: progress.breakdown.promos, colour: 'var(--promo)' },
                { key: 'pending', label: 'Booked', count: progress.breakdown.pending, colour: 'var(--pending)' },
              ];
              const toGo = Math.max(0, progress.total - progress.currentNights);
              return (
                <button key={p.name} className="lh-ring" onClick={() => navigate('/wallet', { state: { open: p.name } })}>
                  <StatusRing ticks={ringTicks(progress.total, segs)} size={92} label={`${progress.currentNights} of ${progress.total} nights`}>
                    <span className="lh-ring-num">{progress.currentNights}</span>
                    <span className="lh-ring-of">of {progress.total}</span>
                  </StatusRing>
                  <span className="lh-ring-name">{p.name}</span>
                  <span className="lh-ring-sub">{toGo > 0 ? `${toGo} to ${progress.targetTier ?? p.nextTier}` : `${progress.targetTier ?? p.nextTier} reached`}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {highlights.length > 0 && (
        <>
          <div className="lh-section">Worth knowing</div>
          <div style={{ display: 'grid', gap: 8, padding: '0 16px' }}>
            {highlights.map((h) => (
              <button key={h.key} className="lh-item" onClick={() => navigate('/wallet')}>
                <span className={`lh-dot ${h.tone}`} aria-hidden="true" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="lh-item-title">{h.title}</span>
                  <span className="lh-item-sub">{h.subtitle}</span>
                  {h.progressPct != null && <span className="lh-bar" aria-hidden="true"><i style={{ width: `${h.progressPct}%` }} /></span>}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
