import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { HomeIcon, TripsIcon, WalletIcon, ProfileIcon, PlanIcon, CaptureIcon, DiscoverIcon } from './Icons';

const RADIAL = [
  { key: 'plan', label: 'Plan', Icon: PlanIcon, color: '#132247' },
  { key: 'capture', label: 'Capture', Icon: CaptureIcon, color: '#0C7A42' },
  { key: 'discover', label: 'Discover', Icon: DiscoverIcon, color: '#9C5F08' },
] as const;

export function TabBar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="radial" aria-hidden={!open}>
        {RADIAL.map((r, i) => (
          <button
            key={r.key}
            className="ract"
            style={{
              opacity: open ? 1 : 0,
              pointerEvents: open ? 'auto' : 'none',
              transform: open
                ? [
                    'translate(-98px,-46px) scale(1)',
                    'translate(0,-104px) scale(1)',
                    'translate(98px,-46px) scale(1)',
                  ][i]
                : undefined,
            }}
            onClick={() => {
              setOpen(false);
              navigate(r.key === 'capture' ? '/capture' : `/action/${r.key}`);
            }}
          >
            <span className="rbtn" style={{ color: r.color }}>
              <r.Icon size={22} color={r.color} />
            </span>
            <span className="rlab">{r.label}</span>
          </button>
        ))}
      </div>

      <nav className="tabs" role="tablist">
        <NavLink to="/" end className="tab">
          <HomeIcon /> <span>Home</span>
        </NavLink>
        <NavLink to="/trips" className="tab">
          <TripsIcon /> <span>Trips</span>
        </NavLink>
        <button className={`fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Actions">
          +
        </button>
        <NavLink to="/wallet" className="tab">
          <WalletIcon /> <span>Wallet</span>
        </NavLink>
        <NavLink to="/profile" className="tab">
          <ProfileIcon /> <span>Profile</span>
        </NavLink>
      </nav>
    </>
  );
}
