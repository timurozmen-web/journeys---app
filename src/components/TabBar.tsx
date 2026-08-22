import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { HomeIcon, TripsIcon, WalletIcon, ProfileIcon, PlanIcon, CaptureIcon, DiscoverIcon, HomeIconFilled, TripsIconFilled, WalletIconFilled, ProfileIconFilled } from './Icons';

const RADIAL = [
  { key: 'plan', label: 'Plan', Icon: PlanIcon, color: '#5B3FA6' },
  { key: 'capture', label: 'Capture', Icon: CaptureIcon, color: '#7B5FC7' },
  { key: 'discover', label: 'Discover', Icon: DiscoverIcon, color: '#5B3FA6' },
] as const;

export function TabBar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className={`scrim ${open ? 'on' : ''}`} onClick={() => setOpen(false)} />
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 95, background: '#fff',
          borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0 -8px 30px rgba(23,23,28,.18)',
          padding: '10px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
          transform: open ? 'translateY(0)' : 'translateY(110%)', transition: 'transform .3s cubic-bezier(.2,1.1,.3,1)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--line)', margin: '0 auto 14px' }} />
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>What are we doing?</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {RADIAL.map((r, i) => (
            <button
              key={r.key}
              onClick={() => { setOpen(false); navigate(`/action/${r.key}`); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px', borderRadius: 16, border: i === 0 ? 'none' : '1px solid var(--line)',
                background: i === 0 ? 'linear-gradient(135deg,#5B3FA6,#7B5FC7)' : '#fff', cursor: 'pointer', textAlign: 'left', font: 'inherit',
              }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 12, background: i === 0 ? 'rgba(255,255,255,.2)' : 'var(--card2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <r.Icon size={20} color={i === 0 ? '#fff' : r.color} />
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: i === 0 ? '#fff' : 'var(--ink)' }}>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <nav className="tabs" role="tablist">
        <NavLink to="/" end className="tab">
          {({ isActive }) => (
            <>
              {isActive ? <HomeIconFilled /> : <HomeIcon />}
              <span>Home</span>
            </>
          )}
        </NavLink>
        <NavLink to="/trips" className="tab">
          {({ isActive }) => (
            <>
              {isActive ? <TripsIconFilled /> : <TripsIcon />}
              <span>Trips</span>
            </>
          )}
        </NavLink>
        <button className={`fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Actions">
          +
        </button>
        <NavLink to="/wallet" className="tab">
          {({ isActive }) => (
            <>
              {isActive ? <WalletIconFilled /> : <WalletIcon />}
              <span>Wallet</span>
            </>
          )}
        </NavLink>
        <NavLink to="/profile" className="tab">
          {({ isActive }) => (
            <>
              {isActive ? <ProfileIconFilled /> : <ProfileIcon />}
              <span>Profile</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
}
