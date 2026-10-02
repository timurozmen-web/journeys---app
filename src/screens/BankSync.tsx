import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBankLinks, usePaymentCards } from '../lib/useLiveData';
import { mapAccountToCard } from '../lib/queries';
import type { BankAccount, BankConnection } from '../lib/queries';
import { disconnectBank, startBankLink, syncBank } from '../lib/bankLink';
import { suggestCard } from '../lib/cardSuggest';
import { CARDS_STATIC } from '../data/cardDefs';
import type { PaymentCard } from '../types';
import { Button, EmptyState, ErrorText, Field, ScreenHeader } from '../components/ui';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

export function BankSync() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { connections, accounts, loaded, refetch } = useBankLinks();
  const { data: paymentCards, isLive: cardsLive, refetch: refetchCards } = usePaymentCards();
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Back from the bank. The server has already finished the link (so this
  // works whichever browser the bank returned you to); here we just load
  // it and clear the address so a refresh doesn't repeat this.
  const handled = useRef(false);
  useEffect(() => {
    const linked = params.get('linked');
    const bankError = params.get('error');
    if (handled.current || (!linked && !bankError)) return;
    handled.current = true;
    navigate('/bank-sync', { replace: true });
    if (bankError) { setError(bankError); return; }
    void refetch();
  }, [params, navigate, refetch]);

  async function connect() {
    setError('');
    setConnecting(true);
    try {
      window.location.href = await startBankLink();
    } catch (err) {
      setError(errorMessage(err));
      setConnecting(false);
    }
  }

  // Tracked cards are the ones to show on arrival at the Wallet.
  async function finish(cardIds: string[]) {
    await Promise.all([refetch(), refetchCards()]);
    navigate('/wallet', { state: { seg: 'payment', tracked: cardIds } });
  }

  const hasConnection = connections.length > 0;
  return (
    <div>
      <ScreenHeader title="Bank sync" />
      <div style={{ padding: '0 20px 24px' }}>
        {error && <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText>}
        {loaded && !hasConnection && !connecting && <EmptyState>No bank connected yet.</EmptyState>}

        {connections.map((c) => (
          <ConnectionCard
            key={c.id}
            connection={c}
            accounts={accounts.filter((a) => a.connectionId === c.id)}
            liveCardIds={cardsLive ? paymentCards.map((p) => p.id) : []}
            customCards={cardsLive ? paymentCards.filter((p) => !CARDS_STATIC.some((d) => d.id === p.id)) : []}
            onRefresh={() => refetch()}
            onFinished={finish}
            onError={setError}
          />
        ))}

        <Button block variant={hasConnection ? 'secondary' : 'primary'} onClick={connect} disabled={connecting} style={{ marginTop: 8 }}>
          {connecting ? 'Opening your bank…' : hasConnection ? 'Connect another bank' : 'Connect a bank'}
        </Button>
      </div>
    </div>
  );
}

const NEW_CARD = '__new__';

function ConnectionCard({ connection, accounts, liveCardIds, customCards, onRefresh, onFinished, onError }: {
  connection: BankConnection; accounts: BankAccount[]; liveCardIds: string[]; customCards: PaymentCard[];
  onRefresh: () => Promise<void>; onFinished: (cardIds: string[]) => Promise<void>; onError: (m: string) => void;
}) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [openDates, setOpenDates] = useState<Record<string, string>>({});
  // Details for a card that isn't in the catalogue, keyed by account.
  const [newCards, setNewCards] = useState<Record<string, { name: string; fee: string; openDate: string }>>({});
  const [step, setStep] = useState<'idle' | 'saving' | 'syncing'>('idle');
  const [confirming, setConfirming] = useState(false);

  const choiceOf = (a: BankAccount) => choices[a.id] ?? a.paymentCardId ?? '';
  const newCardOf = (a: BankAccount) => newCards[a.id] ?? { name: a.displayName, fee: '', openDate: '' };
  const addingNew = accounts.filter((a) => choiceOf(a) === NEW_CARD);
  const newIncomplete = addingNew.some((a) => { const n = newCardOf(a); return !n.name.trim() || n.fee === '' || !n.openDate; });
  const chosenCards = [...new Set(accounts.map(choiceOf).filter((c) => c && c !== NEW_CARD))];
  // A card that has never been tracked needs its open date: card-year and
  // welcome-bonus goals are counted from it.
  const needDate = chosenCards.filter((id) => !liveCardIds.includes(id));
  const missingDate = needDate.some((id) => !openDates[id]) || newIncomplete;
  const changed = accounts.some((a) => choiceOf(a) !== (a.paymentCardId ?? ''));
  const busy = step !== 'idle';

  async function save() {
    onError('');
    setStep('saving');
    try {
      for (const a of accounts) {
        const choice = choiceOf(a);
        if (choice === (a.paymentCardId ?? '')) continue;
        if (choice === NEW_CARD) {
          const n = newCardOf(a);
          const fee = Number(n.fee);
          await mapAccountToCard(a.id, { id: n.name.trim(), programmeBrand: 'Other', annualFee: fee, feeLabel: fee > 0 ? `£${fee}/yr` : 'Free' }, n.openDate);
          continue;
        }
        await mapAccountToCard(a.id, CARDS_STATIC.find((c) => c.id === choice) ?? customCards.find((c) => c.id === choice) ?? null, openDates[choice] ?? null);
      }
      setStep('syncing');
      const r = await syncBank(connection.id);
      if (!r.ok || (r.problems && r.problems.length > 0)) {
        // Mapping is saved; show why the spend didn't all arrive and stay put.
        onError(r.error ?? r.problems?.join(' ') ?? 'The sync did not complete.');
        await onRefresh();
        return;
      }
      await onFinished([...chosenCards, ...addingNew.map((a) => newCardOf(a).name.trim())]);
    } catch (err) {
      onError(errorMessage(err));
      await onRefresh();
    } finally {
      setStep('idle');
    }
  }

  async function syncNow() {
    onError('');
    setStep('syncing');
    try {
      const r = await syncBank(connection.id);
      if (!r.ok) onError(r.error ?? 'The sync did not complete.');
      else if (r.problems?.length) onError(r.problems.join(' '));
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      await onRefresh();
      setStep('idle');
    }
  }

  async function disconnect() {
    onError('');
    setStep('saving');
    try { await disconnectBank(connection.id); } catch (err) { onError(errorMessage(err)); }
    await onRefresh();
    setStep('idle');
  }

  const tracking = accounts.some((a) => a.paymentCardId);
  const statusColour = connection.status === 'error' ? 'var(--red)' : connection.status === 'partial' ? 'var(--amber)' : 'var(--green)';
  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600 }}>{connection.providerName ?? 'Bank'}</div>
        <div style={{ fontSize: 'var(--fs-caption)', color: statusColour }}>
          {connection.status === 'error' ? 'Needs attention' : connection.status === 'partial' ? 'Partly synced' : 'Connected'}
        </div>
      </div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 3 }}>
        {connection.lastSyncedAt ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'}
      </div>
      {connection.error && <ErrorText style={{ marginTop: 8 }}>{connection.error}</ErrorText>}

      <div style={{ height: 12 }} />
      {accounts.map((a) => {
        const choice = choiceOf(a);
        const suggestion = !choice ? suggestCard(a.displayName, connection.providerName) : null;
        return (
          <Field key={a.id} label={`${a.displayName}${a.last4 ? ` ····${a.last4}` : ''}`}>
            <select className="input" value={choice} disabled={busy} onChange={(e) => setChoices({ ...choices, [a.id]: e.target.value })}>
              <option value="">Not a rewards card</option>
              {CARDS_STATIC.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
              {customCards.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
              <option value={NEW_CARD}>Add a new card…</option>
            </select>
            {choice === NEW_CARD && (
              <div style={{ marginTop: 8 }}>
                <Field label="Card name">
                  <input className="input" value={newCardOf(a).name} disabled={busy} onChange={(e) => setNewCards({ ...newCards, [a.id]: { ...newCardOf(a), name: e.target.value } })} />
                </Field>
                <Field label="Annual fee (£)">
                  <input className="input" type="number" min="0" step="1" value={newCardOf(a).fee} disabled={busy} onChange={(e) => setNewCards({ ...newCards, [a.id]: { ...newCardOf(a), fee: e.target.value } })} />
                </Field>
                <Field label="Opened">
                  <input className="input" type="date" value={newCardOf(a).openDate} disabled={busy} onChange={(e) => setNewCards({ ...newCards, [a.id]: { ...newCardOf(a), openDate: e.target.value } })} />
                </Field>
              </div>
            )}
            {suggestion && (
              <button type="button" className="btn soft small" style={{ marginTop: 8 }} onClick={() => setChoices({ ...choices, [a.id]: suggestion })}>
                Looks like your {suggestion} — use it
              </button>
            )}
          </Field>
        );
      })}

      {needDate.map((id) => (
        <Field key={id} label={`${id} opened`}>
          <input className="input" type="date" value={openDates[id] ?? ''} disabled={busy} onChange={(e) => setOpenDates({ ...openDates, [id]: e.target.value })} />
        </Field>
      ))}

      <Button block onClick={save} disabled={busy || !changed || chosenCards.length === 0 || missingDate} style={{ marginTop: 6 }}>
        {step === 'saving' ? 'Saving…' : step === 'syncing' ? 'Pulling in your spend…' : tracking ? 'Save and sync' : 'Start tracking'}
      </Button>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {tracking && <Button variant="secondary" small onClick={syncNow} disabled={busy}>Sync now</Button>}
        {confirming ? (
          <>
            <Button variant="danger" small onClick={disconnect} disabled={busy}>Remove it and its spend</Button>
            <Button variant="ghost" small onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button variant="ghost" small onClick={() => setConfirming(true)}>Disconnect</Button>
        )}
      </div>
    </div>
  );
}
