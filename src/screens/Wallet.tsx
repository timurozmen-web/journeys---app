import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoyaltyProgrammes, usePaymentCards, useAllHotels, useAllFlights, usePromotions } from '../lib/useLiveData';
import { computeCardResults, computeCardVoucherCandidates } from '../lib/cardMath';
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

  return (
    <div>
      <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="h-sub" style={{ margin: '0 0 2px' }}>
            My wallet {!isLive && <span style={{ opacity: 0.6 }}>· sample data</span>}
          </div>
          <div className="wtotal" style={{ padding: 0 }}>
            <div className="val">£{Math.round(totalValue).toLocaleString()}</div>
          </div>
        </div>
        <button
          onClick={() => navigate('/log-loyalty-programme')}
          aria-label="Add a loyalty scheme"
          style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--brand)', color: '#fff',
            fontSize: 20, fontWeight: 700, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2,
          }}
        >
          +
        </button>
      </div>

      <div className="catchip" style={{ margin: '8px 0 16px' }}>
        {(['loyalty', 'payment', 'promotions'] as Seg[]).map((s) => (
          <button key={s} className={seg === s ? 'won' : ''} onClick={() => setSeg(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

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
  );
}
