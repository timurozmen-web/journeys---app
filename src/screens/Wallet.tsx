import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoyaltyProgrammes, usePaymentCards, useAllHotels, useAllFlights, usePromotions } from '../lib/useLiveData';
import { computeCardResults } from '../lib/cardMath';
import { computeStatusProgress } from '../lib/statusProgress';
import { updateManualSpendAdjustment } from '../lib/queries';
import { BrandMark } from '../components/BrandMark';
import { VouchersTab } from '../components/VouchersTab';
import { PromotionsTab } from '../components/PromotionsTab';

type Seg = 'loyalty' | 'payment' | 'status' | 'vouchers' | 'promotions';
const TODAY = new Date().toISOString().slice(0, 10);

function money(n: number) {
  const sign = n < 0 ? '−' : '';
  return `${sign}£${Math.round(Math.abs(n)).toLocaleString()}`;
}
function moneyPrecise(n: number) {
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  const showDecimals = abs < 100 && hasCents;
  return `${sign}£${abs.toLocaleString(undefined, { minimumFractionDigits: showDecimals ? 2 : 0, maximumFractionDigits: showDecimals ? 2 : 0 })}`;
}

export function Wallet() {
  const navigate = useNavigate();
  const [seg, setSeg] = useState<Seg>('loyalty');
  const [editingSpendCard, setEditingSpendCard] = useState<string | null>(null);
  const [spendInput, setSpendInput] = useState('');
  const [spendIsUK, setSpendIsUK] = useState(true);
  const [spendSaveError, setSpendSaveError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { data: rawLoyaltyProgrammes, isLive } = useLoyaltyProgrammes();
  const { data: paymentCards, refetch: refetchCards } = usePaymentCards();
  const { data: hotels } = useAllHotels();
  const { data: promotions } = usePromotions();
  const { data: flights } = useAllFlights();

  // Card results only need ptValue for the value-lookup, not the points
  // balance itself, so this can run against the raw (pre-override) data.
  const cardResults = computeCardResults(hotels, flights, paymentCards, rawLoyaltyProgrammes, TODAY);

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
  const statusItems = loyaltyProgrammes.filter((p) => p.nextTier && p.nightsNeeded != null);

  let items: { key: string; color: string; name: string; sub: string; big: string; biglab: string; pending?: string | null; val: string; vallab: string; pct: number | null; pct2?: number | null; pct3?: number | null; spendBar?: { spendUSD: number; spendRequiredUSD: number; pct: number } | null; detail: React.ReactNode; shape?: string; font?: string; accent?: string }[] = [];

  if (seg === 'loyalty') {
    items = loyaltyProgrammes.map((p) => ({
      key: p.name, color: p.color, name: p.name, sub: p.tier ?? '—',
      big: `${p.points.toLocaleString()} pts`, biglab: '',
      val: `£${Math.round((p.points * p.ptValue) / 100).toLocaleString()}`, vallab: '',
      pct: null, shape: p.shape, font: p.font, accent: p.accent,
      detail: (
        <div className="dd-row">
          <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Rate</span>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.ptValue}p per point</span>
        </div>
      ),
    }));
  } else if (seg === 'payment') {
    items = cardResults.map((r) => {
      const prog = loyaltyProgrammes.find((p) => p.name === r.card.programmeBrand);
      return {
        key: r.card.id, color: prog?.color ?? '#132247', name: r.card.id,
        sub: r.cardRow?.openDate ? `Opened ${r.cardRow.openDate}` : 'Open date not set',
        big: money(r.net), biglab: 'net this card-year',
        val: r.card.feeLabel, vallab: 'annual fee',
        pct: null,
        shape: prog?.shape, font: prog?.font, accent: prog?.accent,
        detail: (
        <>
          <div className="dd-row">
            <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Spend this card-year</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{moneyPrecise(r.autoSpend)}</span>
          </div>
          <div style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', marginBottom: 4 }}>
            {editingSpendCard === r.card.id ? (
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number" step="0.01" autoFocus value={spendInput}
                    onChange={(e) => setSpendInput(e.target.value)}
                    placeholder="Other spend not logged here (£)"
                    style={{ flex: 1, padding: '6px 9px', borderRadius: 7, border: '1px solid var(--line)', fontSize: 12.5 }}
                  />
                  <button
                    onClick={async () => {
                      setSpendSaveError('');
                      try {
                        await updateManualSpendAdjustment(r.card.id, spendInput ? parseFloat(spendInput) : 0, spendIsUK);
                        setEditingSpendCard(null);
                        refetchCards();
                      } catch (err) {
                        const message =
                          err instanceof Error
                            ? err.message
                            : typeof err === 'object' && err !== null && 'message' in err
                            ? String((err as { message: unknown }).message)
                            : 'Failed to save';
                        setSpendSaveError(message);
                      }
                    }}
                    style={{ padding: '6px 10px', borderRadius: 7, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                  Save
                </button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {[{ v: true, l: 'UK spend' }, { v: false, l: 'Overseas spend' }].map((opt) => (
                    <button
                      key={String(opt.v)}
                      onClick={() => setSpendIsUK(opt.v)}
                      style={{
                        padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: spendIsUK === opt.v ? '1px solid var(--brand)' : '1px solid var(--line)',
                        background: spendIsUK === opt.v ? 'rgba(19,34,71,.06)' : 'var(--card)',
                        color: spendIsUK === opt.v ? 'var(--brand)' : 'var(--ink3)',
                      }}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 6 }}>
                  Earning rate differs by region -- this is used to work out the points this spend earns.
                </div>
                {spendSaveError && (
                  <div style={{ color: 'var(--red)', fontSize: 11.5, marginTop: 6 }}>{spendSaveError}</div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingSpendCard(r.card.id);
                  setSpendSaveError('');
                  setSpendInput(r.cardRow?.manualSpendAdjustment ? String(r.cardRow.manualSpendAdjustment) : '');
                  setSpendIsUK(r.cardRow?.manualSpendIsUK ?? true);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                {r.cardRow?.manualSpendAdjustment ? `+ ${moneyPrecise(r.cardRow.manualSpendAdjustment)} other spend added — edit` : '+ Add other spend not logged here'}
              </button>
            )}
          </div>
          <div className="dd-row">
            <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Points earned</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.autoPts.toLocaleString()} pts ({moneyPrecise(r.ptsValue)})</span>
          </div>
          {r.totalEliteNights > 0 && (
            <div className="dd-row">
              <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Elite nights</span>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.totalEliteNights} ({moneyPrecise(r.eliteNightValue)} at £10/night)</span>
            </div>
          )}
          {r.milestoneResults.map((m) => (
            <div className="dd-row" key={m.m.id}>
              <span style={{ fontSize: 12, color: m.hit ? 'var(--green)' : 'var(--ink3)', fontWeight: 600 }}>
                {m.hit ? '✓' : '—'} {m.m.rewardLabel}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, opacity: m.superseded ? 0.5 : 1 }}>
                {m.hit && !m.superseded ? moneyPrecise(m.value) : ''}
              </span>
            </div>
          ))}
          {r.card.perks.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <div className="dd-lab">Perks (not valued)</div>
              {r.card.perks.map((p) => (
                <div key={p.id} style={{ fontSize: 12, color: 'var(--ink2)', padding: '3px 0' }}>{p.label}</div>
              ))}
            </div>
          )}
        </>
        ),
      };
    });
  } else {
    items = statusItems.map((p) => {
      const progress = computeStatusProgress(p, hotels, promotions);
      const { total, bookedNights, pendingPromo, pendingNights, spendBar } = progress;

      const pendingTotal = bookedNights + pendingNights;
      return {
        key: p.name, color: p.color, name: p.name, sub: p.tier ?? '',
        big: `${progress.currentNights}`, biglab: `of ${total} nights`,
        pending: pendingTotal > 0 ? `+${pendingTotal} pending` : null,
        val: `${Math.max(0, total - progress.currentNights)}`, vallab: `to ${p.nextTier}`,
        pct: progress.pct,
        pct2: progress.pct2,
        pct3: progress.pct3,
        shape: p.shape, font: p.font, accent: p.accent,
        spendBar,
        detail: (
          <>
            <div className="dd-row">
              <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Status</span>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.tier}</span>
            </div>
            {bookedNights > 0 && (
              <div className="dd-row">
                <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Booked</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>+{bookedNights}</span>
              </div>
            )}
            {pendingPromo && (
              <div className="dd-row">
                <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>{pendingPromo.title}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)' }}>+{pendingNights}</span>
              </div>
            )}
            {spendBar && (
              <div className="dd-row">
                <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Qualifying spend</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>${Math.round(spendBar.spendUSD).toLocaleString()} / $23,000</span>
              </div>
            )}
          </>
        ),
      };
    });
  }

  return (
    <div>
      <div className="head">
        <div className="h-sub" style={{ margin: '0 0 2px' }}>
          My wallet {!isLive && <span style={{ opacity: 0.6 }}>· sample data</span>}
        </div>
        <div className="wtotal" style={{ padding: 0 }}>
          <div className="val">£{Math.round(totalValue).toLocaleString()}</div>
        </div>
      </div>

      <div className="catchip" style={{ margin: '8px 0 16px' }}>
        {(['loyalty', 'payment', 'status', 'vouchers', 'promotions'] as Seg[]).map((s) => (
          <button
            key={s}
            className={seg === s ? 'won' : ''}
            onClick={() => {
              setSeg(s);
              setOpen(null);
            }}
          >
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

      {(seg === 'loyalty' || seg === 'payment' || seg === 'status') && (
      <div className="stack">
        {items.map((it, idx) => {
          const isOpen = open === it.key;
          const openIdx = items.findIndex((x) => x.key === open);
          const needsGap = idx === 0 || idx === openIdx || idx === openIdx + 1;
          return (
            <div
              key={it.key}
              className="deckcard"
              style={{ marginTop: idx === 0 ? 0 : needsGap ? 10 : -14, zIndex: isOpen ? 50 : idx + 1 }}
            >
              <button
                className="deckface"
                style={{ background: `linear-gradient(135deg,${it.color} 0%,${it.color}CC 100%)` }}
                onClick={() => setOpen(isOpen ? null : it.key)}
              >
                <div className="top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="deckmark">
                      {it.shape ? (
                        <BrandMark shape={it.shape} color={it.accent ?? '#fff'} size={18} />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{it.name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </span>
                    <div>
                      <div className="deckname">{it.name}</div>
                      <div className="decksub">{it.sub}</div>
                    </div>
                  </div>
                  <span className="deckchev" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                    ›
                  </span>
                </div>
                {it.pct != null && (
                  <div className="hbar" style={{ background: 'rgba(255,255,255,.22)', marginTop: 12, position: 'relative' }}>
                    {it.pct3 != null && (
                      <i style={{ width: `${Math.max(0, Math.min(100, it.pct3))}%`, background: 'rgba(255,193,90,.6)', position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                    )}
                    {it.pct2 != null && (
                      <i style={{ width: `${Math.max(0, Math.min(100, it.pct2))}%`, background: 'rgba(255,255,255,.55)', position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                    )}
                    <i style={{ width: `${Math.max(0, Math.min(100, it.pct))}%`, background: '#fff', position: 'relative' }} />
                  </div>
                )}
                {it.spendBar && (
                  <>
                    <div style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 700, marginTop: 8, color: '#fff' }}>
                      Qualifying spend: ${Math.round(it.spendBar.spendUSD).toLocaleString()} / $23,000
                    </div>
                    <div className="hbar" style={{ background: 'rgba(255,255,255,.22)', marginTop: 4 }}>
                      <i style={{ width: `${Math.max(0, Math.min(100, it.spendBar.pct))}%`, background: '#fff' }} />
                    </div>
                  </>
                )}
                <div className="deckbot">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <div className="deckbig">{it.big}</div>
                      {it.pending && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#FFC15A', background: 'rgba(255,193,90,.18)', padding: '1px 7px', borderRadius: 99 }}>
                          {it.pending}
                        </span>
                      )}
                    </div>
                    <div className="decklab">{it.biglab}</div>
                  </div>
                  <div>
                    <div className="deckval">{it.val}</div>
                    <div className="decksmall">{it.vallab}</div>
                  </div>
                </div>
              </button>
              <div className="deckwrap" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                <div className="deckinner">
                  <div className="deckdetail">{it.detail}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {seg === 'vouchers' && <VouchersTab cardResults={cardResults} />}
      {seg === 'promotions' && <PromotionsTab />}
    </div>
  );
}
