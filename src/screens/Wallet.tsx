import { useState } from 'react';
import { useLoyaltyProgrammes, usePaymentCards } from '../lib/useLiveData';

type Seg = 'loyalty' | 'payment' | 'status';

export function Wallet() {
  const [seg, setSeg] = useState<Seg>('loyalty');
  const [open, setOpen] = useState<string | null>(null);
  const { data: loyaltyProgrammes, isLive } = useLoyaltyProgrammes();
  const { data: paymentCards } = usePaymentCards();

  const totalValue = loyaltyProgrammes.reduce((s, p) => s + (p.points * p.ptValue) / 100, 0);
  const statusItems = loyaltyProgrammes.filter((p) => p.nextTier && p.nightsNeeded != null);

  let items: { key: string; color: string; name: string; sub: string; big: string; biglab: string; val: string; vallab: string; pct: number | null }[] = [];
  if (seg === 'loyalty') {
    items = loyaltyProgrammes.map((p) => ({
      key: p.name, color: p.color, name: p.name, sub: p.tier ?? '—',
      big: p.points.toLocaleString(), biglab: 'points',
      val: `£${Math.round((p.points * p.ptValue) / 100).toLocaleString()}`, vallab: 'est. value',
      pct: p.nextTier && p.nights != null && p.nightsNeeded != null ? (p.nights / (p.nights + p.nightsNeeded)) * 100 : null,
    }));
  } else if (seg === 'payment') {
    items = paymentCards.map((c) => ({
      key: c.id, color: '#132247', name: c.id, sub: `Opened ${c.openDate}`,
      big: c.feeLabel, biglab: 'annual fee',
      val: c.programmeBrand, vallab: 'linked programme', pct: null,
    }));
  } else {
    items = statusItems.map((p) => ({
      key: p.name, color: p.color, name: p.name, sub: p.tier ?? '',
      big: `${p.nights}`, biglab: `of ${(p.nights ?? 0) + (p.nightsNeeded ?? 0)} nights`,
      val: `${p.nightsNeeded}`, vallab: `to ${p.nextTier}`,
      pct: p.nights != null && p.nightsNeeded != null ? (p.nights / (p.nights + p.nightsNeeded)) * 100 : null,
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
              style={{ marginTop: idx === 0 ? 0 : needsGap ? 10 : -56, zIndex: isOpen ? 50 : idx + 1 }}
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
                    <i style={{ width: `${it.pct}%`, background: '#fff' }} />
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
                  <div className="deckdetail">
                    <div className="dd-row">
                      <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Detail</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                        Full card math ports next — this proves the interaction, not final numbers.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
