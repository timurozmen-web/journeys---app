import { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { updateManualSpendAdjustment, updateCardClosedDate, updateCardOpenDate, deletePaymentCard } from '../lib/queries';
import { SwipeToDelete } from './SwipeToDelete';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorText } from './ui';
import type { CardResult } from '../lib/cardMath';
import type { LoyaltyProgramme } from '../types';
import { CARD_FACES, DEFAULT_FACE } from '../data/cardFaces';
import { cardDistinguishesAbroad } from '../lib/earning';
import { paceLine } from '../lib/spendPace';

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

// Spend split by this card's own earning categories, with the points each
// earns. This is the only breakdown shown: purchases are never listed one
// by one.
function SpendByCategory({ r }: { r: CardResult }) {
  const { summary } = r;
  if (summary.totalSpend <= 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const shown = summary.categories.filter((c) => c.spend > 0);
  const caveat = r.connected && summary.assumedShare > 0 && cardDistinguishesAbroad(r.card, today);
  return (
    <div style={{ padding: '4px 0 10px' }}>
      <div className="dd-lab">Where it went</div>
      {shown.map((c) => (
        <div key={c.category.id} style={{ padding: '5px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--fs-small)' }}>
            <span style={{ color: 'var(--ink2)' }}>{c.category.label}{!r.card.custom && <span style={{ color: 'var(--ink3)' }}> · {c.rate}pt/£</span>}</span>
            <span style={{ fontWeight: 700, flexShrink: 0 }}>{moneyPrecise(c.spend)}{!r.card.custom && ` · ${c.points.toLocaleString()} pts`}</span>
          </div>
          <div className="catbar" style={{ marginTop: 4 }}><i style={{ width: `${(c.spend / summary.totalSpend) * 100}%` }} /></div>
        </div>
      ))}
      {caveat && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 6 }}>
          Purchases the bank bills in £ count as UK spend, so anything bought abroad in £ may earn more than shown here.
        </div>
      )}
    </div>
  );
}

export function PaymentTab({ cardResults, loyaltyProgrammes, refetchCards, initialOpen = null }: {
  cardResults: CardResult[]; loyaltyProgrammes: LoyaltyProgramme[]; refetchCards: () => void; initialOpen?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(initialOpen);
  const [cardError, setCardError] = useState('');
  // Deleted this session: hidden straight away, before the refetch lands.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  async function removeCard(cardId: string) {
    setCardError('');
    try {
      await deletePaymentCard(cardId);
      setRemoved((r) => new Set(r).add(cardId));
      if (open === cardId) setOpen(null);
      refetchCards();
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Could not delete the card.');
    }
  }
  const [editingSpendCard, setEditingSpendCard] = useState<string | null>(null);
  const [spendInput, setSpendInput] = useState('');
  const [spendIsUK, setSpendIsUK] = useState(true);
  const [spendSaveError, setSpendSaveError] = useState('');
  const [editingClosedCard, setEditingClosedCard] = useState<string | null>(null);
  const [closedInput, setClosedInput] = useState('');
  const [closedSaveError, setClosedSaveError] = useState('');

  const shown = cardResults.filter((r) => !removed.has(r.card.id));
  const active = shown.filter((r) => !r.cardRow?.closedDate);
  const archived = shown.filter((r) => r.cardRow?.closedDate);

  function renderCard(r: CardResult, muted: boolean, stacked: boolean) {
    const prog = loyaltyProgrammes.find((p) => p.name === r.card.programmeBrand);
    const isOpen = open === r.card.id;

    const faceSpec = CARD_FACES[r.card.id] ?? DEFAULT_FACE;
    return (
      // Bug fixed: archived cards were stacked faces at 55% opacity, so they
      // showed through one another and an opened one overlaid the rest.
      // They are compact rows instead.
      <div key={r.card.id} className={muted ? 'archslot' : `walletslot${stacked ? ' stacked' : ''}`}>
        {muted ? (
        <SwipeToDelete
          onClick={() => setOpen(isOpen ? null : r.card.id)}
          onDelete={() => removeCard(r.card.id)}
          itemLabel={r.card.id}
          wrapperStyle={{ borderRadius: 'var(--r-md)' }}
        >
          <div role="button" tabIndex={0} className="archrow" aria-expanded={isOpen} aria-label={r.card.id}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : r.card.id); } }}>
            <span className="minicard" style={{ background: `linear-gradient(150deg, ${faceSpec.from} 0%, ${faceSpec.to} 100%)` }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>{r.card.id}</span>
              <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 2 }}>Closed {r.cardRow?.closedDate}</span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--ink3)' }}>{isOpen ? '⌃' : '⌄'}</span>
          </div>
        </SwipeToDelete>
        ) : (
        <SwipeToDelete
          onClick={() => setOpen(isOpen ? null : r.card.id)}
          onDelete={() => removeCard(r.card.id)}
          surface="transparent"
          revealHeight={78}
          itemLabel={r.card.id}
          wrapperStyle={{ borderRadius: 'var(--r-lg)' }}
        >
        <div
          role="button"
          tabIndex={0}
          className="walletcard"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : r.card.id); } }}
          aria-expanded={isOpen}
          aria-label={r.card.id}
          style={{ background: `linear-gradient(150deg, ${faceSpec.from} 0%, ${faceSpec.to} 100%)` }}
        >
          <div className="walletcard-top">
            <span className="walletcard-id">
              <BrandLogo name={prog?.name ?? ''} shape={prog?.shape} color={prog?.color} accent={prog?.accent} size={28} />
              <span className="walletcard-name">{r.card.id}</span>
            </span>
            <span className="walletcard-meta">
              {r.connected && <span className="live">Live</span>}
              <span>{r.card.feeLabel}</span>
            </span>
          </div>
          <span aria-hidden="true" className="cardchip" />
          <div className="walletcard-bottom">
            <span className="walletcard-mark">
              {faceSpec.issuer && <span className="walletcard-issuer">{faceSpec.issuer}</span>}
              {faceSpec.network === 'amex' && <span className="walletcard-amex">AMEX</span>}
              {faceSpec.network === 'mastercard' && <span className="walletcard-mc" aria-label="Mastercard"><i /><i /></span>}
            </span>
            <span className="walletcard-value">
              <span>{r.card.custom ? money(r.autoSpend) : money(r.net)}</span>
              <small>{r.card.custom ? 'spend this year' : 'net value'}</small>
            </span>
          </div>
        </div>
        </SwipeToDelete>
        )}

        {isOpen && (
          <div className="walletdetail">
            <div className="dd-row">
              <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Opened</span>
              <input
                type="date" className="input compact inline-date" aria-label="Date opened"
                defaultValue={r.cardRow?.openDate ?? ''}
                onChange={(e) => e.target.value && updateCardOpenDate(r.card.id, e.target.value).then(refetchCards).catch((err) => setCardError(err instanceof Error ? err.message : 'Could not save.'))}
              />
            </div>
            <div className="dd-row">
              <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Spend this card-year</span>
              <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>{moneyPrecise(r.autoSpend)}</span>
            </div>
            <SpendByCategory r={r} />

            {!r.connected && (
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', marginBottom: 4 }}>
              {editingSpendCard === r.card.id ? (
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number" step="0.01" autoFocus value={spendInput}
                      onChange={(e) => setSpendInput(e.target.value)}
                      placeholder="Other spend not logged here (£)"
                      style={{ flex: 1, padding: '6px 9px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)', fontSize: 'var(--fs-small)' }}
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
                      style={{ padding: '6px 10px', borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
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
                          padding: '4px 10px', borderRadius: 'var(--r-pill)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer',
                          border: spendIsUK === opt.v ? '1px solid var(--brand)' : '1px solid var(--line)',
                          background: spendIsUK === opt.v ? 'var(--brand-soft)' : 'var(--card)',
                          color: spendIsUK === opt.v ? 'var(--brand)' : 'var(--ink3)',
                        }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink3)', marginTop: 6 }}>
                    Earning rate differs by region -- this is used to work out the points this spend earns.
                  </div>
                  {spendSaveError && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-small)', marginTop: 6 }}>{spendSaveError}</div>}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingSpendCard(r.card.id);
                    setSpendSaveError('');
                    setSpendInput(r.cardRow?.manualSpendAdjustment ? String(r.cardRow.manualSpendAdjustment) : '');
                    setSpendIsUK(r.cardRow?.manualSpendIsUK ?? true);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  {r.cardRow?.manualSpendAdjustment ? `+ ${moneyPrecise(r.cardRow.manualSpendAdjustment)} other spend added — edit` : '+ Add other spend not logged here'}
                </button>
              )}
            </div>
            )}

            {!r.card.custom && (
              <div className="dd-row">
                <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Points earned</span>
                <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>{r.autoPts.toLocaleString()} pts ({moneyPrecise(r.ptsValue)})</span>
              </div>
            )}
            {r.totalEliteNights > 0 && (
              <div className="dd-row">
                <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', fontWeight: 600 }}>Elite nights</span>
                <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>{r.totalEliteNights} ({moneyPrecise(r.eliteNightValue)} at £10/night)</span>
              </div>
            )}
            {r.milestoneResults.map((m) => (
              <div key={m.m.id} style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-small)', color: m.hit ? 'var(--green)' : m.missed ? 'var(--ink3)' : 'var(--ink2)', fontWeight: 600 }}>
                    {m.hit ? '✓' : m.missed ? '✕' : '—'} {m.m.rewardLabel}
                  </span>
                  <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700, opacity: m.superseded ? 0.5 : 1, flexShrink: 0 }}>
                    {m.hit && !m.superseded ? moneyPrecise(m.value) : ''}
                  </span>
                </div>
                {m.m.spendRequired && !m.hit && !m.missed && (
                  <>
                    <div className="catbar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (m.spend / m.m.spendRequired) * 100)}%` }} /></div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 4 }}>
                      {moneyPrecise(m.spend)} of {moneyPrecise(m.m.spendRequired)}{m.pace && paceLine(m.pace) ? ` · ${paceLine(m.pace)}` : ''}
                    </div>
                  </>
                )}
                {m.missed && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 4 }}>Not reached within its window ({moneyPrecise(m.spend)} spent)</div>}
              </div>
            ))}
            {r.card.perks.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <div className="dd-lab">Perks (not valued)</div>
                {r.card.perks.map((p) => (
                  <div key={p.id} style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', padding: '3px 0' }}>{p.label}</div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              {editingClosedCard === r.card.id ? (
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="date" autoFocus value={closedInput}
                      onChange={(e) => setClosedInput(e.target.value)}
                      style={{ flex: 1, padding: '6px 9px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)', fontSize: 'var(--fs-small)' }}
                    />
                    <button
                      onClick={async () => {
                        setClosedSaveError('');
                        try {
                          await updateCardClosedDate(r.card.id, closedInput || null);
                          setEditingClosedCard(null);
                          setOpen(null);
                          refetchCards();
                        } catch (err) {
                          const message =
                            err instanceof Error
                              ? err.message
                              : typeof err === 'object' && err !== null && 'message' in err
                              ? String((err as { message: unknown }).message)
                              : 'Failed to save';
                          setClosedSaveError(message);
                        }
                      }}
                      style={{ padding: '6px 10px', borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Save
                    </button>
                  </div>
                  {closedSaveError && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-small)', marginTop: 6 }}>{closedSaveError}</div>}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingClosedCard(r.card.id);
                    setClosedSaveError('');
                    setClosedInput(r.cardRow?.closedDate ?? '');
                  }}
                  style={{ background: 'none', border: 'none', color: r.cardRow?.closedDate ? 'var(--red)' : 'var(--ink3)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  {r.cardRow?.closedDate ? `Closed ${r.cardRow.closedDate} — edit` : 'Mark this card as closed'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="walletstack">
      {cardError && <ErrorText style={{ marginBottom: 10 }}>{cardError}</ErrorText>}
      <div>{active.map((r, i) => renderCard(r, false, i > 0 && open !== active[i - 1].card.id))}</div>
      <Button variant="secondary" block onClick={() => navigate('/add-card')} style={{ marginTop: 14 }}>Add a card</Button>

      {archived.length > 0 && (
        <>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 10 }}>
            Archived
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>{archived.map((r) => renderCard(r, true, false))}</div>
        </>
      )}
    </div>
  );
}
