import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon, CheckIcon, XIcon, ChevronDownIcon } from '../components/Icons';
import { usePromotionCandidates, useDiscoverItems, useLoyaltyProgrammes, usePaymentCards, useAllHotels } from '../lib/useLiveData';
import { acceptPromotionCandidate, dismissPromotionCandidate, dismissDiscoverItem, keepDiscoverItem, registerDiscoverItem } from '../lib/queries';
import { matchingStays, promoIsActive } from '../lib/promoMatching';
import type { DiscoverCategory } from '../types';

const CATEGORY_LABEL: Record<DiscoverCategory, string> = {
  new_card: 'New card', card_bonus: 'Card bonus', loyalty_news: 'Loyalty news',
};

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Discover() {
  const navigate = useNavigate();
  const { data: candidates, refetch: refetchCandidates } = usePromotionCandidates();
  const { data: items, refetch: refetchItems } = useDiscoverItems();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: paymentCards } = usePaymentCards();
  const { data: hotels } = useAllHotels();
  const [expandedKept, setExpandedKept] = useState<string | null>(null);
  const TODAY = new Date().toISOString().slice(0, 10);

  const walletNames = new Set([
    ...loyaltyProgrammes.map((p) => p.name.toLowerCase()),
    ...paymentCards.map((c) => c.programmeBrand.toLowerCase()),
  ]);

  const newItems = items.filter((i) => i.status === 'new');
  const keptItems = items.filter((i) => i.status === 'kept');

  async function onKeep(id: string) {
    await keepDiscoverItem(id);
    refetchItems();
  }
  async function onDismiss(id: string) {
    await dismissDiscoverItem(id);
    refetchItems();
  }
  async function onToggleRegister(id: string, current: boolean) {
    await registerDiscoverItem(id, !current);
    refetchItems();
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Discover</div>
      </div>
      <p style={{ padding: '0 20px', fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.6, marginTop: -4 }}>
        Points-earning cards and hotel or airline loyalty news. Keep what's worth acting on, dismiss the rest.
      </p>

      <div style={{ padding: '10px 20px 8px', display: 'grid', gap: 10 }}>
        {newItems.length === 0 && keptItems.length === 0 && (
          <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>Nothing new right now.</div>
        )}
        {newItems.map((item) => {
          const inWallet = item.relatedProgramme ? walletNames.has(item.relatedProgramme.toLowerCase()) : false;
          const deadlinePassed = item.deadline ? item.deadline < TODAY : false;
          return (
            <div key={item.id} style={{ position: 'relative', border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 16, padding: '14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--brand)', background: 'rgba(30,58,143,.08)', borderRadius: 99, padding: '2px 8px' }}>
                  {CATEGORY_LABEL[item.category]}
                </span>
                {item.relatedProgramme && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: inWallet ? 'var(--green)' : 'var(--ink3)' }}>
                    {inWallet ? <CheckIcon size={11} color="var(--green)" /> : null}
                    {inWallet ? 'In your wallet' : 'Not in your wallet'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginTop: 6, paddingRight: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 3, lineHeight: 1.5 }}>{item.summary}</div>
              {item.detail && <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6, margin: '8px 0 0' }}>{item.detail}</p>}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                {item.headlineStat && <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{item.headlineStat}</span>}
                {item.annualFee && <span style={{ fontSize: 12, color: 'var(--ink2)' }}>Cost: {item.annualFee}</span>}
                {item.deadline && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: deadlinePassed ? 'var(--ink3)' : 'var(--amber)' }}>
                    {deadlinePassed ? `Offer ended ${fmtDate(item.deadline)}` : `Apply by ${fmtDate(item.deadline)}`}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Source: {item.source}</span>
                {item.sourceUrl && (
                  <a href={item.sourceUrl} style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--ink)', fontSize: 11.5, fontWeight: 700, textDecoration: 'none' }}>
                    Read more
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => onKeep(item.id)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  Keep
                </button>
                <button
                  onClick={() => onDismiss(item.id)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '9px 0', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  <XIcon size={11} color="var(--ink2)" /> Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {keptItems.length > 0 && (
        <>
          <div className="sect"><h2>Saved ({keptItems.length})</h2></div>
          <div style={{ padding: '0 20px', display: 'grid', gap: 8 }}>
            {keptItems.map((item) => {
              const isOpen = expandedKept === item.id;
              const matches = matchingStays(item, hotels);
              const active = promoIsActive(item);
              return (
                <div key={item.id} style={{ border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 14, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedKept(isOpen ? null : item.id)}
                    style={{ width: '100%', textAlign: 'left', font: 'inherit', border: 0, background: 'none', padding: '11px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.headlineStat ?? item.summary}
                        {active && matches.length > 0 && <span style={{ color: 'var(--green)', fontWeight: 700 }}> · applies to {matches.length} stay{matches.length === 1 ? '' : 's'}</span>}
                        {item.requiresRegistration && !item.registered && <span style={{ color: 'var(--amber)', fontWeight: 700 }}> · needs registering</span>}
                      </div>
                    </div>
                    <ChevronDownIcon size={14} color="var(--ink3)" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.5 }}>{item.summary}</div>
                      {item.detail && <p style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6, margin: '6px 0 0' }}>{item.detail}</p>}

                      {(item.promoStart || item.promoEnd || item.minNights != null || item.newBookingsOnly) && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 8, padding: '8px 10px', background: 'var(--card2)', borderRadius: 8, lineHeight: 1.6 }}>
                          {item.promoStart && item.promoEnd && <div>Stay dates: {fmtDate(item.promoStart)} – {fmtDate(item.promoEnd)}</div>}
                          {item.minNights != null && <div>Minimum {item.minNights} night{item.minNights === 1 ? '' : 's'}</div>}
                          {item.newBookingsOnly && <div>New bookings only, made after registering</div>}
                        </div>
                      )}

                      {item.requiresRegistration && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={item.registered} onChange={() => onToggleRegister(item.id, item.registered)} style={{ width: 16, height: 16 }} />
                          I've registered for this
                        </label>
                      )}

                      {active && (
                        matches.length > 0 ? (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                              Applies to {matches.length} logged stay{matches.length === 1 ? '' : 's'}
                            </div>
                            {matches.map((m) => (
                              <div key={m.hotel.id} style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{m.hotel.name} · {fmtDate(m.hotel.date)}</div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 10 }}>No logged stays match yet.</div>
                        )
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                        {item.sourceUrl ? (
                          <a href={item.sourceUrl} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>Source: {item.source}</a>
                        ) : <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Source: {item.source}</span>}
                        <button
                          onClick={() => onDismiss(item.id)}
                          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="sect">
        <h2>Hotel promotions</h2>
      </div>
      <div style={{ padding: '0 20px 32px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
          Screenshot a promotion email and it'll show up here to add to your wallet.
        </p>
        <button
          onClick={() => navigate('/scan-promotion')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px 0', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}
        >
          Scan a promotion
        </button>

        {candidates.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {candidates.map((c) => (
              <div key={c.id} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{c.title}</div>
                {c.brand && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{c.brand}</div>}
                {c.description && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{c.description}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={async () => { await acceptPromotionCandidate(c); refetchCandidates(); }}
                    style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Add
                  </button>
                  <button
                    onClick={async () => { await dismissPromotionCandidate(c.id); refetchCandidates(); }}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
