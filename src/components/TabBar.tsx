import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { HomeIcon, TripsIcon, WalletIcon, ProfileIcon, PlanIcon, CaptureIcon, DiscoverIcon, CreditIcon } from './Icons';
import { getQueuedWrites, onQueueChange, processQueue } from '../lib/offlineQueue';

const RADIAL = [
  { key: 'plan', label: 'Plan', Icon: PlanIcon, color: 'var(--brand)' },
  { key: 'capture', label: 'Capture', Icon: CaptureIcon, color: 'var(--brand2)' },
  { key: 'discover', label: 'Discover', Icon: DiscoverIcon, color: 'var(--brand)' },
  { key: 'credit', label: 'Where to credit', Icon: CreditIcon, color: 'var(--brand)' },
] as const;

export function TabBar() {
  const [open, setOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(() => getQueuedWrites().length);
  const [pendingItems, setPendingItems] = useState(() => getQueuedWrites());

  useEffect(() => onQueueChange(() => {
    setPendingCount(getQueuedWrites().length);
    setPendingItems(getQueuedWrites());
  }), []);

  async function retryNow() {
    setRetrying(true);
    try {
      await processQueue();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <>
      {pendingCount > 0 && (
        <button
          onClick={() => setPendingOpen(true)}
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
            zIndex: 94, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-pill)', border: 'none',
            background: 'var(--ink)', color: 'var(--on-dark)', fontSize: 'var(--fs-caption)', fontWeight: 700, boxShadow: '0 4px 14px rgba(23,23,28,.25)', cursor: 'pointer',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
          {pendingCount} change{pendingCount === 1 ? '' : 's'} waiting to sync
        </button>
      )}
      <div className={`scrim ${pendingOpen ? 'on' : ''}`} onClick={() => setPendingOpen(false)} />
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 96, background: 'var(--card)',
          borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0 -8px 30px rgba(23,23,28,.18)',
          padding: '18px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
          transform: pendingOpen ? 'translateY(0)' : 'translateY(110%)', transition: 'transform .3s cubic-bezier(.2,1.1,.3,1)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 'var(--r-pill)', background: 'var(--line)', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Waiting to sync</div>
        <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
          These will save automatically as soon as you're back online.
        </p>
        <div style={{ display: 'grid', gap: 8, maxHeight: '40vh', overflowY: 'auto' }}>
          {pendingItems.map((item) => (
            <div key={item.id} style={{ padding: '10px 12px', borderRadius: 'var(--r-control)', background: 'var(--card2)' }}>
              <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--ink)' }}>{item.label}</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 2 }}>
                Queued {new Date(item.queuedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={retryNow}
          disabled={retrying}
          style={{ width: '100%', marginTop: 14, padding: '12px 0', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--brand)', color: 'var(--on-dark)', fontSize: 'var(--fs-body-lg)', fontWeight: 700, cursor: 'pointer', opacity: retrying ? 0.6 : 1 }}
        >
          {retrying ? 'Trying now…' : 'Try syncing now'}
        </button>
      </div>
      <div className={`scrim ${open ? 'on' : ''}`} onClick={() => setOpen(false)} />
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 95, background: 'var(--card)',
          borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0 -8px 30px rgba(23,23,28,.18)',
          padding: '10px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
          transform: open ? 'translateY(0)' : 'translateY(110%)', transition: 'transform .3s cubic-bezier(.2,1.1,.3,1)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 'var(--r-pill)', background: 'var(--line)', margin: '0 auto 14px' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>What are we doing?</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {RADIAL.map((r) => (
            <button
              key={r.key}
              onClick={() => { setOpen(false); navigate(`/action/${r.key}`); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
                background: 'var(--card)', cursor: 'pointer', textAlign: 'left', font: 'inherit',
              }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--card2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <r.Icon size={20} color={r.color} />
              </span>
              <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 800, color: 'var(--ink)' }}>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <nav className="tabs" role="tablist">
        <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {({ isActive }) => (
            <>
              <span className="tab-ic"><HomeIcon strokeWidth={isActive ? 2.3 : 1.7} /></span>
              <span>Home</span>
            </>
          )}
        </NavLink>
        <NavLink to="/trips" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {({ isActive }) => (
            <>
              <span className="tab-ic"><TripsIcon strokeWidth={isActive ? 2.3 : 1.7} /></span>
              <span>Trips</span>
            </>
          )}
        </NavLink>
        <button className={`fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Actions">
          +
        </button>
        <NavLink to="/wallet" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {({ isActive }) => (
            <>
              <span className="tab-ic"><WalletIcon strokeWidth={isActive ? 2.3 : 1.7} /></span>
              <span>Wallet</span>
            </>
          )}
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {({ isActive }) => (
            <>
              <span className="tab-ic"><ProfileIcon strokeWidth={isActive ? 2.3 : 1.7} /></span>
              <span>Profile</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
}
