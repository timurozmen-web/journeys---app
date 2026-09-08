import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon, ChevronDownIcon, CheckIcon, XIcon } from '../components/Icons';
import { usePromotionCandidates, useDiscoverItems, useLoyaltyProgrammes, usePaymentCards } from '../lib/useLiveData';
import { acceptPromotionCandidate, dismissPromotionCandidate, dismissDiscoverItem } from '../lib/queries';
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const TODAY = new Date().toISOString().slice(0, 10);

  const walletNames = new Set([
    ...loyaltyProgrammes.map((p) => p.name.toLowerCase()),
    ...paymentCards.map((c) => c.programmeBrand.toLowerCase()),
  ]);

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Discover</div>
      </div>
      <p style={{ padding: '0 20px', fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.6, marginTop: -4 }}>
        Travel and loyalty news worth knowing about — new cards, live bonuses, and programme changes. Tap for details, dismiss what's not for you.
      </p>

      <div style={{ padding: '10px 20px 8px', display: 'grid', gap: 10 }}>
        {items.length === 0 && (
          <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>Nothing new right now.</div>
        )}
        {items.map((item) => {
          const isOpen = expanded === item.id;
          const inWallet = item.relatedProgramme ? walletNames.has(item.relatedProgramme.toLowerCase()) : false;
          const deadlinePassed = item.deadline ? item.deadline < TODAY : false;
          return (
            <div key={item.id} style={{ border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 16, overflow: 'hidden' }}>
              <button
                onClick={() => setExpanded(isOpen ? null : item.id)}
                style={{ width: '100%', textAlign: 'left', font: 'inherit', border: 0, background: 'none', padding: '14px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
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
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', marginTop: 6 }}>{item.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 3, lineHeight: 1.5 }}>{item.summary}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    {item.headlineStat && <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{item.headlineStat}</span>}
                    {item.deadline && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: deadlinePassed ? 'var(--ink3)' : 'var(--amber)' }}>
                        {deadlinePassed ? `Offer ended ${fmtDate(item.deadline)}` : `Apply by ${fmtDate(item.deadline)}`}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDownIcon size={16} color="var(--ink3)" style={{ flexShrink: 0, marginTop: 3, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
              </button>
              {isOpen && (
                <div style={{ padding: '0 14px 14px' }}>
                  {item.detail && <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6, margin: '0 0 10px' }}>{item.detail}</p>}
                  {item.annualFee && (
                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 10 }}><b style={{ color: 'var(--ink)' }}>Cost:</b> {item.annualFee}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Source: {item.source}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                          Read more
                        </a>
                      )}
                      <button
                        onClick={async () => { await dismissDiscoverItem(item.id); refetchItems(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <XIcon size={11} color="var(--ink2)" /> Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
