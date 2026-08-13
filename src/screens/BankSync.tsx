import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { useBankConnections, useUnreviewedBankTransactions, usePaymentCards } from '../lib/useLiveData';
import { assignBankTransactionToCard, dismissBankTransaction } from '../lib/queries';
import { supabase } from '../lib/supabase';

interface Bank {
  name: string;
  country: string;
  logo: string;
}

export function BankSync() {
  const navigate = useNavigate();
  const { data: connections } = useBankConnections();
  const { data: transactions, refetch: refetchTransactions } = useUnreviewedBankTransactions();
  const { data: cards, refetch: refetchCards } = usePaymentCards();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (connections.length > 0 || banks.length > 0) return;
    setLoadingBanks(true);
    setError('');
    fetch('/.netlify/functions/bank-list?country=GB')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
        return d;
      })
      .then((d) => setBanks(d.banks || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the bank list.'))
      .finally(() => setLoadingBanks(false));
  }, [connections.length, banks.length]);

  async function handleConnect(bank: Bank) {
    setConnecting(true);
    setError('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not signed in');
      const res = await fetch('/.netlify/functions/bank-link-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aspspName: bank.name,
          aspspCountry: bank.country,
          userId: userData.user.id,
          redirectUrl: `${window.location.origin}/.netlify/functions/bank-link-callback`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the connection');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setConnecting(false);
    }
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Bank sync</div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {connections.length === 0 ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5, marginBottom: 16 }}>
              Connect your bank to have new spend pulled in automatically, once a day. You'll review and assign each transaction to a card yourself — nothing gets added to your spend totals without your say.
            </p>
            {loadingBanks && <div style={{ color: 'var(--ink3)', fontSize: 13 }}>Loading banks…</div>}
            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'grid', gap: 8 }}>
              {banks.map((bank) => (
                <button
                  key={bank.name}
                  onClick={() => handleConnect(bank)}
                  disabled={connecting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10,
                    border: '1px solid var(--line)', background: 'var(--card)', fontSize: 13.5, fontWeight: 700,
                    color: 'var(--ink)', cursor: connecting ? 'default' : 'pointer', textAlign: 'left',
                  }}
                >
                  {bank.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {connections.map((c) => (
              <div key={c.id} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.aspspName}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>
                  {c.accountName ?? 'Account'} · last synced {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleDateString() : 'not yet'}
                </div>
              </div>
            ))}

            <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', margin: '16px 0 8px' }}>
              To review ({transactions.length})
            </div>
            {transactions.length === 0 && (
              <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
                Nothing new since the last sync.
              </div>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              {transactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  cards={cards}
                  onAssign={async (cardId) => {
                    const card = cards.find((c) => c.id === cardId);
                    if (!card) return;
                    await assignBankTransactionToCard(t.id, cardId, card.manualSpendAdjustment, t.amount);
                    refetchTransactions();
                    refetchCards();
                  }}
                  onDismiss={async () => {
                    await dismissBankTransaction(t.id);
                    refetchTransactions();
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TransactionRow({
  transaction, cards, onAssign, onDismiss,
}: {
  transaction: { date: string; amount: number; currency: string; description: string | null };
  cards: { id: string; programmeBrand: string }[];
  onAssign: (cardId: string) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState('');
  return (
    <div style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{transaction.description || 'Transaction'}</div>
        <div style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
          {transaction.currency} {transaction.amount.toFixed(2)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{transaction.date}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ flex: 1, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 12.5 }}
        >
          <option value="">Assign to card…</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>{c.id}</option>
          ))}
        </select>
        <button
          disabled={!selected}
          onClick={() => onAssign(selected)}
          style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: selected ? 'var(--brand)' : 'var(--card2)', color: selected ? '#fff' : 'var(--ink3)', fontSize: 12, fontWeight: 700, cursor: selected ? 'pointer' : 'default' }}
        >
          Add
        </button>
        <button
          onClick={onDismiss}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
