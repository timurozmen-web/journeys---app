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
      <div className={`scrim ${open ? 'on' : ''}`} onClick={() => setOpen(false)} />
      <div className="radial" aria-hidden={!open}>
        <svg className="rtrack" viewBox="0 0 200 120" fill="none">
          <path d="M13.4,70 A100,100 0 0,1 100,20 A100,100 0 0,1 186.6,70" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="1 7" strokeLinecap="round" />
          {[
            [13.4, 70],
            [100, 20],
            [186.6, 70],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.5" fill="var(--line)" />
          ))}
        </svg>
        {RADIAL.map((r) => (
          <button
            key={r.key}
            className="ract"
            onClick={() => {
              setOpen(false);
              navigate(`/action/${r.key}`);
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
