import { useState } from 'react';
import { BrandMark } from './BrandMark';
import { updateManualSpendAdjustment } from '../lib/queries';
import type { CardResult } from '../lib/cardMath';
import type { LoyaltyProgramme } from '../types';

function money(n: number) {
  const sign = n < 0 ? '−' : '';
  return `${sign}£${Math.round(Math.abs(n)).toLocaleString()}`;
}
function moneyPrecise(n: number) {
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  return `${sign}£${hasCents ? abs.toFixed(2) : Math.round(abs).toLocaleString()}`;
}

export function PaymentTab({ cardResults, loyaltyProgrammes, refetchCards }: {
  cardResults: CardResult[]; loyaltyProgrammes: LoyaltyProgramme[]; refetchCards: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [editingSpendCard, setEditingSpendCard] = useState<string | null>(null);
  const [spendInput, setSpendInput] = useState('');
  const [spendIsUK, setSpendIsUK] = useState(true);
  const [spendSaveError, setSpendSaveError] = useState('');

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {cardResults.map((r) => {
        const prog = loyaltyProgrammes.find((p) => p.name === r.card.programmeBrand);
        const isOpen = open === r.card.id;

        return (
          <div key={r.card.id} style={{ borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(isOpen ? null : r.card.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: prog?.color ?? '#5B3FA6', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {prog?.shape && <BrandMark shape={prog.shape} color={prog.accent || '#fff'} size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.card.id}</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 1 }}>
                  {r.cardRow?.openDate ? `Opened ${r.cardRow.openDate}` : 'Open date not set'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{money(r.net)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 1 }}>{r.card.feeLabel}</div>
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: '0 14px 16px', display: 'grid', gap: 4 }}>
                <div className="dd-row">
                  <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>Spend this card-year</span>
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
                              padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              border: spendIsUK === opt.v ? '1px solid var(--brand)' : '1px solid var(--line)',
                              background: spendIsUK === opt.v ? 'rgba(91,63,166,.08)' : 'var(--card)',
                              color: spendIsUK === opt.v ? 'var(--brand)' : 'var(--ink3)',
                            }}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 6 }}>
                        Earning rate differs by region -- this is used to work out the points this spend earns.
                      </div>
                      {spendSaveError && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{spendSaveError}</div>}
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
                  <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>Points earned</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.autoPts.toLocaleString()} pts ({moneyPrecise(r.ptsValue)})</span>
                </div>
                {r.totalEliteNights > 0 && (
                  <div className="dd-row">
                    <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>Elite nights</span>
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
                  <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                    <div className="dd-lab">Perks (not valued)</div>
                    {r.card.perks.map((p) => (
                      <div key={p.id} style={{ fontSize: 12, color: 'var(--ink2)', padding: '3px 0' }}>{p.label}</div>
                    ))}
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
