import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBankLinks, usePaymentCards } from '../lib/useLiveData';
import { mapAccountToCard } from '../lib/queries';
import type { BankAccount, BankConnection } from '../lib/queries';
import { disconnectBank, exchangeBankCode, startBankLink, syncBank, takeState } from '../lib/bankLink';
import { CARDS_STATIC } from '../data/cardDefs';
import { Button, EmptyState, ErrorText, Field, ScreenHeader, SectionLabel } from '../components/ui';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

export function BankSync() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { connections, accounts, loaded, refetch } = useBankLinks();
  const { data: paymentCards, refetch: refetchCards } = usePaymentCards();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // Back from the bank: finish the connection once, then clear the code
  // from the address so a refresh can't replay it. A code that arrives
  // without the state we saved before leaving isn't ours, so it's refused.
  const handled = useRef(false);
  useEffect(() => {
    const code = params.get('code');
    const bankError = params.get('error');
    if (handled.current || (!code && !bankError)) return;
    handled.current = true;
    const state = params.get('state');
    navigate('/bank-sync', { replace: true });
    if (bankError) { setError(bankError); return; }
    if (!state || state !== takeState()) { setError('That bank link did not come from this app, so it was ignored. Start again.'); return; }
    setBusy('connect');
    exchangeBankCode(code!)
      .then(() => refetch())
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusy(null));
  }, [params, navigate, refetch]);

  async function connect() {
    setError('');
    setBusy('connect');
    try {
      window.location.href = await startBankLink();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function sync(c: BankConnection) {
    setError('');
    setBusy(c.id);
    try {
      const r = await syncBank(c.id);
      if (!r.ok) setError(r.error ?? 'The sync did not complete.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      refetch();
      setBusy(null);
    }
  }

  async function disconnect(c: BankConnection) {
    setError('');
    setBusy(c.id);
    try {
      await disconnectBank(c.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      refetch();
      setBusy(null);
    }
  }

  return (
    <div>
      <ScreenHeader title="Bank sync" />
      <div style={{ padding: '0 20px' }}>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--ink2)', lineHeight: 1.5, marginBottom: 16 }}>
          Link the bank or card that pays for your rewards cards. Purchases are added up by each card's own earning
          categories and tracked against its spending goals, once a day. Individual transactions aren't shown, and
          accounts you don't point at a rewards card are never read.
        </p>
        {error && <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText>}

        {loaded && connections.length === 0 && busy !== 'connect' && <EmptyState>No bank connected yet.</EmptyState>}
        {connections.map((c) => (
          <ConnectionCard
            key={c.id}
            connection={c}
            accounts={accounts.filter((a) => a.connectionId === c.id)}
            existingCardIds={paymentCards.map((p) => p.id)}
            busy={busy === c.id}
            onSync={() => sync(c)}
            onDisconnect={() => disconnect(c)}
            onMapped={async () => { await sync(c); refetchCards(); }}
            onError={setError}
          />
        ))}
        <Button block onClick={connect} disabled={busy === 'connect'} style={{ marginTop: 8 }}>
          {busy === 'connect' ? 'Connecting…' : connections.length === 0 ? 'Connect a bank' : 'Connect another bank'}
        </Button>
      </div>
    </div>
  );
}

function ConnectionCard({ connection, accounts, existingCardIds, busy, onSync, onDisconnect, onMapped, onError }: {
  connection: BankConnection; accounts: BankAccount[]; existingCardIds: string[]; busy: boolean;
  onSync: () => void; onDisconnect: () => void; onMapped: () => Promise<void>; onError: (m: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const trackedCount = accounts.filter((a) => a.paymentCardId).length;
  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600 }}>{connection.providerName ?? 'Bank'}</div>
        <div style={{ fontSize: 'var(--fs-caption)', color: connection.status === 'error' ? 'var(--red)' : connection.status === 'partial' ? 'var(--amber)' : 'var(--green)' }}>
          {connection.status === 'error' ? 'Needs attention' : connection.status === 'partial' ? 'Partly synced' : 'Connected'}
        </div>
      </div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 3 }}>
        {connection.lastSyncedAt ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'}
      </div>
      {connection.error && <ErrorText style={{ marginTop: 8 }}>{connection.error}</ErrorText>}

      <SectionLabel style={{ marginTop: 14, marginBottom: 12 }}>Which rewards card does each one pay for?</SectionLabel>
      {accounts.map((a) => (
        <AccountRow key={a.id} account={a} cardExists={(id) => existingCardIds.includes(id)} onMapped={onMapped} onError={onError} />
      ))}
      {trackedCount === 0 && (
        <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink3)', marginTop: 8 }}>Nothing is tracked until you choose a card above.</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button variant="secondary" small onClick={onSync} disabled={busy || trackedCount === 0}>{busy ? 'Working…' : 'Sync now'}</Button>
        {confirming ? (
          <>
            <Button variant="danger" small onClick={onDisconnect} disabled={busy}>Remove it and its spend</Button>
            <Button variant="ghost" small onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button variant="ghost" small onClick={() => setConfirming(true)}>Disconnect</Button>
        )}
      </div>
    </div>
  );
}

function AccountRow({ account, cardExists, onMapped, onError }: {
  account: BankAccount; cardExists: (cardId: string) => boolean; onMapped: () => Promise<void>; onError: (m: string) => void;
}) {
  const [pending, setPending] = useState<string | null>(null); // a card chosen that still needs an open date
  const [openDate, setOpenDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(cardId: string, date: string | null) {
    onError('');
    setSaving(true);
    try {
      await mapAccountToCard(account.id, CARDS_STATIC.find((c) => c.id === cardId) ?? null, date);
      setPending(null);
      setOpenDate('');
      await onMapped();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function choose(cardId: string) {
    if (cardId === '') { void save('', null); return; }
    // A card that has never been tracked needs its open date: card-year
    // and welcome-bonus goals are counted from it.
    if (!cardExists(cardId)) { setPending(cardId); return; }
    void save(cardId, null);
  }

  return (
    <Field
      label={`${account.displayName}${account.last4 ? ` ····${account.last4}` : ''}`}
      hint={account.kind === 'card' ? 'Credit card' : 'Current account'}
    >
      <select className="input" value={pending ?? account.paymentCardId ?? ''} disabled={saving} onChange={(e) => choose(e.target.value)}>
        <option value="">Not a rewards card</option>
        {CARDS_STATIC.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
      </select>
      {pending && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <input className="input" type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} aria-label={`When did you open the ${pending}?`} />
          <Button small disabled={!openDate || saving} onClick={() => save(pending, openDate)}>Track</Button>
          <Button small variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
        </div>
      )}
      {pending && <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink3)', marginTop: 6 }}>When did you open the {pending}? Goals count from this date.</div>}
    </Field>
  );
}
