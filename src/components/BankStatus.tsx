import type { BankAccount, BankConnection } from '../lib/queries';
import { Button } from './ui';

// The strip at the top of Wallet's Cards tab: what's left to finish, or a
// way into bank settings.
export function BankStatus({ connections, accounts, onOpen }: {
  connections: BankConnection[]; accounts: BankAccount[]; onOpen: () => void;
}) {
  const unfinished = connections.find((c) => !accounts.some((a) => a.connectionId === c.id && a.paymentCardId));
  if (unfinished) {
    return (
      <div className="card" style={{ margin: '0 16px 14px' }}>
        <div style={{ fontWeight: 600 }}>Finish setting up {unfinished.providerName ?? 'your bank'}</div>
        <Button small onClick={onOpen} style={{ marginTop: 10 }}>Choose cards</Button>
      </div>
    );
  }

  const synced = connections.map((c) => c.lastSyncedAt).filter((d): d is string => !!d).sort().at(-1);
  return (
    <div style={{ padding: '0 20px 12px' }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
        {connections.length === 0
          ? 'Connect a bank'
          : `Bank connected${synced ? ` · synced ${new Date(synced).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''} — manage`}
      </button>
    </div>
  );
}
