import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoyaltyProgrammes, usePaymentCards, useAllHotels, useAllFlights, usePromotions, useVouchers } from '../lib/useLiveData';
import { computeCardResults, computeCardVoucherCandidates } from '../lib/cardMath';
import { computeWalletValueChange } from '../lib/hotelPlanner';
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
  // booked through Expedia at Platinum tier, so it's computed live from
  // real bookings rather than trusted as a stored number.
  const oneKeyCash = hotels
    .filter((h) => h.bookingChannel === 'Expedia' && h.status === 'Completed' && h.total)
    .reduce((s, h) => s + (h.total ?? 0) * 0.06, 0);

  // For hotel-brand programmes with real stay history, total points = base
  // program points (rate × elite tier bonus, computed from real spend) +
  // whatever the card-issued side already earned. These are two genuinely
  // separate earning streams, not alternatives to each other.
  // Marriott/Hilton/IHG/Accor balances were already manually tracked to
  // include card spend and other factors -- overriding them with only
  // what this app can compute would lose real information. The formula
  // below is used prospectively instead (Trip Detail's per-trip points),
  // not retroactively against the whole stored balance.
  const loyaltyProgrammes = rawLoyaltyProgrammes.map((p) =>
    p.name === 'Expedia One Key Cash' ? { ...p, points: Math.round(oneKeyCash), ptValue: 100 } : p
  );

  const totalValue = loyaltyProgrammes.reduce((s, p) => s + (p.points * p.ptValue) / 100, 0);
  const { data: vouchers } = useVouchers();
  const valueChange = computeWalletValueChange(hotels, loyaltyProgrammes, vouchers, new Date().toISOString().slice(0, 10));

  return (
    <div>
      <div style={{ background: '#fff', height: 'env(safe-area-inset-top, 0px)' }} />
      <div style={{ background: 'linear-gradient(165deg,#4A3189 0%,#5B3FA6 100%)', padding: '24px 20px 22px', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>Wallet value {!isLive && '· sample data'}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1.8px', marginTop: 2, lineHeight: 1 }}>£{Math.round(totalValue).toLocaleString()}</div>
              {valueChange.hasData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: valueChange.deltaValue >= 0 ? '#9BE7C4' : '#FFB4B4', fontSize: 13, fontWeight: 800 }}>
                  <span>{valueChange.deltaValue >= 0 ? '▲' : '▼'}</span>
                  <span>£{Math.round(Math.abs(valueChange.deltaValue)).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginTop: 6 }}>
              {loyaltyProgrammes.reduce((s, p) => s + p.points, 0).toLocaleString()} points across {loyaltyProgrammes.length} programmes
              {valueChange.hasData && <span style={{ opacity: 0.7 }}> · vs last 30 days from stays</span>}
            </div>
          </div>
          <button
            onClick={() => navigate('/log-loyalty-programme')}
            aria-label="Add a loyalty scheme"
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 20, fontWeight: 600, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            +
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
          {(['loyalty', 'payment', 'promotions'] as Seg[]).map((s) => (
            <button
              key={s}
              onClick={() => setSeg(s)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 99, border: 'none', cursor: 'pointer', background: seg === s ? '#fff' : 'rgba(255,255,255,.16)', color: seg === s ? '#4A3189' : '#fff', fontSize: 13, fontWeight: 800 }}
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
