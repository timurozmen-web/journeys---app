import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoyaltyProgrammes, usePaymentCards, useAllHotels, useAllFlights, usePromotions, useVouchers } from '../lib/useLiveData';
import { computeCardResults, computeCardVoucherCandidates } from '../lib/cardMath';
import { computeWalletValueChange } from '../lib/hotelPlanner';
import { withLiveOverrides } from '../lib/walletValue';
import { syncCardVouchers } from '../lib/queries';
import { LoyaltyTab } from '../components/LoyaltyTab';
import { PaymentTab } from '../components/PaymentTab';
import { PromotionsTab } from '../components/PromotionsTab';

type Seg = 'loyalty' | 'payment' | 'promotions';
const TODAY = new Date().toISOString().slice(0, 10);

export function Wallet() {
  const navigate = useNavigate();
  const [seg, setSeg] = useState<Seg>('loyalty');
  const { data: rawLoyaltyProgrammes, isLive } = useLoyaltyProgrammes();
  const { data: paymentCards, refetch: refetchCards } = usePaymentCards();
  const { data: hotels } = useAllHotels();
  const { data: promotions } = usePromotions();
  const { data: flights } = useAllFlights();

  // Card results only need ptValue for the value-lookup, not the points
  // balance itself, so this can run against the raw (pre-override) data.
  const cardResults = computeCardResults(hotels, flights, paymentCards, rawLoyaltyProgrammes, TODAY);

  // Auto-sync any newly-hit card vouchers once real card results are
  // available. Runs here rather than inside a specific tab's component,
  // since vouchers are now folded into the Loyalty view and this should
  // stay in sync regardless of which segment the user has open.
  useEffect(() => {
    if (cardResults.length === 0) return;
    const candidates = computeCardVoucherCandidates(cardResults);
    if (candidates.length === 0) return;
    syncCardVouchers(candidates).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardResults.length]);

  // One Key Cash isn't a fixed balance -- it's 6% of what's actually been
  // booked through Expedia at Platinum tier, computed live in the shared
  // helper so this always matches the figure Home shows.
  const loyaltyProgrammes = withLiveOverrides(rawLoyaltyProgrammes, hotels);

  const totalValue = loyaltyProgrammes.reduce((s, p) => s + (p.points * p.ptValue) / 100, 0);
  const { data: vouchers } = useVouchers();
  const valueChange = computeWalletValueChange(hotels, loyaltyProgrammes, vouchers, new Date().toISOString().slice(0, 10));

  return (
    <div>
      <div style={{ background: 'var(--bg)', height: 'env(safe-area-inset-top, 0px)' }} />
      <div style={{ padding: '20px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink2)' }}>Wallet value {!isLive && '· sample data'}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 600, letterSpacing: '-1px', marginTop: 4, lineHeight: 1, color: 'var(--ink)' }}>£{Math.round(totalValue).toLocaleString()}</div>
              {valueChange.hasData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: valueChange.deltaValue >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 800 }}>
                  <span>{valueChange.deltaValue >= 0 ? '▲' : '▼'}</span>
                  <span>£{Math.round(Math.abs(valueChange.deltaValue)).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginTop: 6 }}>
              {loyaltyProgrammes.reduce((s, p) => s + p.points, 0).toLocaleString()} points across {loyaltyProgrammes.length} programmes
              {valueChange.hasData && <span> · vs last 30 days from stays</span>}
            </div>
          </div>
          <button
            onClick={() => navigate('/log-loyalty-programme')}
            aria-label="Add a loyalty scheme"
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 20, fontWeight: 600, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            +
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
          {(['loyalty', 'payment', 'promotions'] as Seg[]).map((s) => (
            <button
              key={s}
              onClick={() => setSeg(s)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 99, border: seg === s ? 'none' : '1px solid var(--line)', cursor: 'pointer', background: seg === s ? 'var(--ink)' : 'var(--card)', color: seg === s ? '#fff' : 'var(--ink2)', fontSize: 13, fontWeight: 800 }}
            >
              {s === 'loyalty' ? 'Points' : s === 'payment' ? 'Cards' : 'Promos'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 18 }}>
        {seg === 'payment' && (
          <div style={{ padding: '0 20px 4px' }}>
            <button
              onClick={() => navigate('/bank-sync')}
              style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              🏦 Sync spend from your bank
            </button>
          </div>
        )}

        {seg === 'loyalty' && (
          <LoyaltyTab programmes={loyaltyProgrammes} hotels={hotels} promotions={promotions} paymentCards={paymentCards} cardResults={cardResults} />
        )}

        {seg === 'payment' && (
          <PaymentTab cardResults={cardResults} loyaltyProgrammes={loyaltyProgrammes} refetchCards={refetchCards} />
        )}

        {seg === 'promotions' && <PromotionsTab />}
      </div>
    </div>
  );
}
