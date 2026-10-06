import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { HomeIcon, TripsIcon, WalletIcon, ProfileIcon, PlusIcon, PlanIcon, CaptureIcon, DiscoverIcon, CreditIcon } from './Icons';
import { getQueuedWrites, onQueueChange, processQueue } from '../lib/offlineQueue';
import { fanPositions } from '../lib/fanLayout';
import { useDiscoverItems, useReviews, useTrips } from '../lib/useLiveData';
import { badgeLabel, newDiscoverCount, profileActionCount } from '../lib/badges';

// The + button's fan, left to right along the arc.
const ACTIONS = [
  { key: 'plan', label: 'Plan', desc: 'Weather, crowds and cost for a trip', Icon: PlanIcon },
  { key: 'capture', label: 'Add', desc: 'Stays, flights, trips and cards', Icon: CaptureIcon },
  { key: 'discover', label: 'Discover', desc: 'Card offers and loyalty news', Icon: DiscoverIcon },
  { key: 'credit', label: 'Credit', desc: 'Best programme for a flight', Icon: CreditIcon },
] as const;
const FAN_RADIUS = 145;
const FAN = fanPositions(ACTIONS.length, FAN_RADIUS);
// Dotted guide arc through the item centres, 162deg to 18deg.
const FAN_ARC = (() => {
  const pt = (deg: number) => [Math.cos((deg * Math.PI) / 180) * FAN_RADIUS, -Math.sin((deg * Math.PI) / 180) * FAN_RADIUS];
  const [x0, y0] = pt(162); const [x1, y1] = pt(18);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A ${FAN_RADIUS} ${FAN_RADIUS} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
})();

export function TabBar() {
  const [open, setOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(() => getQueuedWrites().length);
  const [pendingItems, setPendingItems] = useState(() => getQueuedWrites());
  // Count badges: things waiting on Profile, and new Discover items behind +.
  const { data: trips } = useTrips();
  const { data: reviews } = useReviews();
  const { data: discoverItems } = useDiscoverItems();
  const profileBadge = badgeLabel(profileActionCount(trips, reviews, new Date().toISOString().slice(0, 10)));
  const discoverBadge = badgeLabel(newDiscoverCount(discoverItems));

  // Escape closes the fan.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(74px + env(safe-area-inset-bottom, 0px) * 0.5)',
            zIndex: 94, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-pill)', border: 'none',
            background: 'var(--ink)', color: 'var(--on-dark)', fontSize: 'var(--fs-caption)', fontWeight: 700, boxShadow: '0 4px 14px rgba(0,0,0,.4)', cursor: 'pointer',
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
          borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0 -8px 30px rgba(0,0,0,.4)',
          padding: '18px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
          transform: pendingOpen ? 'translateY(0)' : 'translateY(110%)', transition: 'transform .3s cubic-bezier(.2,1.1,.3,1)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 'var(--r-pill)', background: 'var(--line)', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 'var(--fs-title)', fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Waiting to sync</div>
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
          style={{ width: '100%', marginTop: 14, padding: '12px 0', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--brand)', color: 'var(--on-brand)', fontSize: 'var(--fs-body-lg)', fontWeight: 700, cursor: 'pointer', opacity: retrying ? 0.6 : 1 }}
        >
          {retrying ? 'Trying now…' : 'Try syncing now'}
        </button>
      </div>
      <div className={`fanscrim ${open ? 'on' : ''}`} onClick={() => setOpen(false)} />
      <div className={`fan ${open ? 'on' : ''}`} aria-hidden={!open}>
        <svg className="fan-arc" width={FAN_RADIUS * 2 + 20} height={FAN_RADIUS + 20} viewBox={`${-FAN_RADIUS - 10} ${-FAN_RADIUS - 10} ${FAN_RADIUS * 2 + 20} ${FAN_RADIUS + 20}`} aria-hidden="true">
          <path d={FAN_ARC} fill="none" stroke="var(--brand)" strokeWidth="1.2" strokeDasharray="2 6" strokeLinecap="round" />
        </svg>
        {ACTIONS.map((a, i) => (
          <button
            key={a.key}
            className="fan-item"
            tabIndex={open ? 0 : -1}
            style={{ ['--x' as string]: `${FAN[i].x}px`, ['--y' as string]: `${FAN[i].y}px`, transitionDelay: open ? `${i * 45}ms` : '0ms' }}
            onClick={() => { setOpen(false); navigate(`/action/${a.key}`); }}
          >
            <span className="fan-btn">
              <a.Icon size={22} color="currentColor" />
              {a.key === 'discover' && discoverBadge && <span className="badge">{discoverBadge}</span>}
            </span>
            <span className="fan-label">{a.label}</span>
            <span className="fan-desc">{a.desc}</span>
          </button>
        ))}
      </div>

      <nav className={`tabs ${open ? 'open' : ''}`} role="tablist">
        <NavLink to="/" end aria-label="Home" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {({ isActive }) => <HomeIcon size={22} strokeWidth={isActive ? 1.9 : 1.5} />}
        </NavLink>
        <NavLink to="/trips" aria-label="Trips" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {({ isActive }) => <TripsIcon size={22} strokeWidth={isActive ? 1.9 : 1.5} />}
        </NavLink>
        <span className="fabwrap">
          <button className={`fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close actions' : discoverBadge ? `Actions, ${discoverBadge} new in Discover` : 'Actions'} aria-expanded={open}>
            <PlusIcon size={20} strokeWidth={2.2} />
          </button>
          {!open && discoverBadge && <span className="badge" aria-hidden="true">{discoverBadge}</span>}
        </span>
        <NavLink to="/wallet" aria-label="Wallet" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {({ isActive }) => <WalletIcon size={22} strokeWidth={isActive ? 1.9 : 1.5} />}
        </NavLink>
        <NavLink to="/profile" aria-label={profileBadge ? `Profile, ${profileBadge} to do` : 'Profile'} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {({ isActive }) => (
            <>
              <ProfileIcon size={22} strokeWidth={isActive ? 1.9 : 1.5} />
              {profileBadge && <span className="badge" aria-hidden="true">{profileBadge}</span>}
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
}
