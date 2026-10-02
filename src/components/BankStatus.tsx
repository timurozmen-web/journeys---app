import type { CardResult } from '../lib/cardMath';
import type { BankAccount, BankConnection } from '../lib/queries';
import { Button } from './ui';

// The strip at the top of Wallet's Cards tab: what just changed after
// setting up a bank, what's left to finish, or how it's doing.
export function BankStatus({ connections, accounts, tracked, onDismiss, onOpen }: {
  connections: BankConnection[]; accounts: BankAccount[]; tracked: CardResult[]; onDismiss: () => void; onOpen: () => void;
}) {
  if (tracked.length > 0) {
    return (
      <div className="card" style={{ margin: '0 16px 14px', borderColor: 'var(--green)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 600, color: 'var(--green)' }}>Now tracking from your bank</div>
          <button onClick={onDismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--ink3)', cursor: 'pointer' }}>✕</button>
        </div>
        {tracked.map((r) => (
          <div key={r.card.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--fs-small)', marginTop: 8 }}>
            <span style={{ color: 'var(--ink2)' }}>{r.card.id}</span>
            <span style={{ fontWeight: 700 }}>£{Math.round(r.autoSpend).toLocaleString()} this card-year · {r.autoPts.toLocaleString()} pts</span>
          </div>
        ))}
      </div>
    );
  }

  const unfinished = connections.find((c) => !accounts.some((a) => a.connectionId === c.id && a.paymentCardId));
  if (unfinished) {
    return (
      <div className="card" style={{ margin: '0 16px 14px' }}>
        <div style={{ fontWeight: 600 }}>Finish setting up {unfinished.providerName ?? 'your bank'}</div>
        <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', margin: '4px 0 10px' }}>Choose which rewards card each account pays for and spend will start to flow in.</div>
        <Button small onClick={onOpen}>Choose cards</Button>
      </div>
    );
  }

  const synced = connections.map((c) => c.lastSyncedAt).filter((d): d is string => !!d).sort().at(-1);
  return (
    <div style={{ padding: '0 20px 12px' }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
        {connections.length === 0
          ? 'Connect your bank to track spend automatically'
          : `Bank connected${synced ? ` · synced ${new Date(synced).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''} — manage`}
      </button>
    </div>
  );
}
