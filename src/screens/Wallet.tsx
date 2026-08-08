import { useState } from 'react';
import { useLoyaltyProgrammes, usePaymentCards, useAllHotels, useAllFlights } from '../lib/useLiveData';
import { computeCardResults } from '../lib/cardMath';

type Seg = 'loyalty' | 'payment' | 'status';
const TODAY = new Date().toISOString().slice(0, 10);

function money(n: number) {
  const sign = n < 0 ? '−' : '';
  return `${sign}£${Math.round(Math.abs(n)).toLocaleString()}`;
}

export function Wallet() {
  const [seg, setSeg] = useState<Seg>('loyalty');
  const [open, setOpen] = useState<string | null>(null);
  const { data: loyaltyProgrammes, isLive } = useLoyaltyProgrammes();
  const { data: paymentCards } = usePaymentCards();
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();

  const cardResults = computeCardResults(hotels, flights, paymentCards, loyaltyProgrammes, TODAY);

  const totalValue = loyaltyProgrammes.reduce((s, p) => s + (p.points * p.ptValue) / 100, 0);
  const statusItems = loyaltyProgrammes.filter((p) => p.nextTier && p.nightsNeeded != null);

  let items: { key: string; color: string; name: string; sub: string; big: string; biglab: string; val: string; vallab: string; pct: number | null; detail: React.ReactNode }[] = [];

  if (seg === 'loyalty') {
    items = loyaltyProgrammes.map((p) => ({
      key: p.name, color: p.color, name: p.name, sub: p.tier ?? '—',
      big: p.points.toLocaleString(), biglab: 'points',
      val: `£${Math.round((p.points * p.ptValue) / 100).toLocaleString()}`, vallab: 'est. value',
      pct: p.nextTier && p.nights != null && p.nightsNeeded != null ? (p.nights / (p.nights + p.nightsNeeded)) * 100 : null,
      detail: (
        <div className="dd-row">
          <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Rate</span>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.ptValue}p per point</span>
        </div>
      ),
    }));
  } else if (seg === 'payment') {
    items = cardResults.map((r) => ({
      key: r.card.id, color: '#132247', name: r.card.id,
      sub: r.cardRow?.openDate ? `Opened ${r.cardRow.openDate}` : 'Open date not set',
      big: money(r.net), biglab: 'net this card-year',
      val: r.card.feeLabel, vallab: 'annual fee',
      pct: r.nextMilestone ? Math.min(100, (r.autoSpend / (r.nextMilestone.m.spendRequired ?? 1)) * 100) : null,
      detail: (
        <>
          <div className="dd-row">
            <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Spend this card-year</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{money(r.autoSpend)}</span>
          </div>
          <div className="dd-row">
            <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Points earned</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.autoPts.toLocaleString()} pts ({money(r.ptsValue)})</span>
          </div>
          {r.totalEliteNights > 0 && (
            <div className="dd-row">
              <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Elite nights</span>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.totalEliteNights} ({money(r.eliteNightValue)} at £10/night)</span>
            </div>
          )}
          {r.milestoneResults.map((m) => (
            <div className="dd-row" key={m.m.id}>
              <span style={{ fontSize: 12, color: m.hit ? 'var(--green)' : 'var(--ink3)', fontWeight: 600 }}>
                {m.hit ? '✓' : '—'} {m.m.rewardLabel}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, opacity: m.superseded ? 0.5 : 1 }}>
                {m.hit && !m.superseded ? money(m.value) : ''}
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
    }));
  } else {
    items = statusItems.map((p) => ({
      key: p.name, color: p.color, name: p.name, sub: p.tier ?? '',
      big: `${p.nights}`, biglab: `of ${(p.nights ?? 0) + (p.nightsNeeded ?? 0)} nights`,
      val: `${p.nightsNeeded}`, vallab: `to ${p.nextTier}`,
      pct: p.nights != null && p.nightsNeeded != null ? (p.nights / (p.nights + p.nightsNeeded)) * 100 : null,
      detail: (
        <div className="dd-row">
          <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Status</span>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.tier}</span>
        </div>
      ),
    }));
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

      <div className="wseg" style={{ margin: '8px 20px 16px' }}>
        {(['loyalty', 'payment', 'status'] as Seg[]).map((s) => (
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
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{it.name.slice(0, 2).toUpperCase()}</span>
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
                  <div className="hbar" style={{ background: 'rgba(255,255,255,.22)', marginTop: 12 }}>
                    <i style={{ width: `${Math.max(0, Math.min(100, it.pct))}%`, background: '#fff' }} />
                  </div>
                )}
                <div className="deckbot">
                  <div>
                    <div className="deckbig">{it.big}</div>
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
    </div>
  );
}
