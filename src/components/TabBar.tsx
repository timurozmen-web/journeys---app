import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  TodayIcon, SuitcaseIcon, StatusIcon, CardIcon, PlusIcon, ImageIcon, MailIcon, BedIcon, PlaneIcon, PinIcon, TagIcon, CalendarIcon, ChevronRightIcon, XIcon,
} from './Icons';
import { getQueuedWrites, onQueueChange, processQueue } from '../lib/offlineQueue';

// One tab bar for the whole app: Today and Trips, the + (add anything),
// Status and Cards. The + opens a sheet: screenshots or an email first,
// since that's the quickest way in, then adding by hand.
const TABS = [
  { to: '/', label: 'Today', Icon: TodayIcon, match: (p: string) => p === '/' },
  { to: '/trips', label: 'Trips', Icon: SuitcaseIcon, match: (p: string) => p === '/trips' || p.startsWith('/trips/') || p === '/map' },
  { to: '/status', label: 'Status', Icon: StatusIcon, match: (p: string) => p === '/status' || p.startsWith('/status/') || p === '/promotions' },
  { to: '/cards', label: 'Cards', Icon: CardIcon, match: (p: string) => p === '/cards' },
] as const;

const BY_HAND = [
  { label: 'Stay', to: '/log-hotel', Icon: BedIcon },
  { label: 'Flight', to: '/log-flight', Icon: PlaneIcon },
  { label: 'Trip', to: '/log-trip', Icon: PinIcon },
  { label: 'Promotion', to: '/scan-promotion', Icon: TagIcon },
  { label: 'Card', to: '/add-card', Icon: CardIcon },
  { label: 'Calendar file', to: '/import-calendar', Icon: CalendarIcon },
] as const;

export function TabBar() {
  const [open, setOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(() => getQueuedWrites().length);
  const [pendingItems, setPendingItems] = useState(() => getQueuedWrites());
  const fileInput = useRef<HTMLInputElement>(null);

  // Escape closes the sheet.
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

  // A new screen closes the sheet.
  useEffect(() => { setOpen(false); }, [pathname]);

  async function retryNow() {
    setRetrying(true);
    try {
      await processQueue();
    } finally {
      setRetrying(false);
    }
  }

  // Screenshots go straight to the reader: picking them is the tap, so the
  // booking is read as soon as they're chosen.
  function pickedScreenshots(files: FileList | null) {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (fileInput.current) fileInput.current.value = '';
    if (images.length === 0) return;
    setOpen(false);
    navigate('/scan-email', { state: { files: images } });
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
        <button onClick={retryNow} disabled={retrying} className="btn primary block" style={{ marginTop: 14 }}>
          {retrying ? 'Trying now…' : 'Try syncing now'}
        </button>
      </div>

      <div className={`scrim ${open ? 'on' : ''}`} onClick={() => setOpen(false)} />
      <div className={`addsheet ${open ? 'on' : ''}`} role="dialog" aria-modal="true" aria-label="Add" aria-hidden={!open}>
        <div className="grip" />
        <div className="addsheet-head">
          <h2 className="addsheet-title">Add</h2>
          <button className="iconbtn" aria-label="Close" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}><XIcon size={18} /></button>
        </div>
        <div className="addsheet-tiles">
          <button className="addtile dark" tabIndex={open ? 0 : -1} onClick={() => fileInput.current?.click()}>
            <ImageIcon size={28} color="var(--brand2)" />
            <span>Screenshots</span>
          </button>
          <button className="addtile" tabIndex={open ? 0 : -1} onClick={() => navigate('/scan-email')}>
            <MailIcon size={28} color="var(--brand)" />
            <span>Paste email</span>
          </button>
        </div>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => pickedScreenshots(e.target.files)} />
        <div className="sectionlabel" style={{ margin: '20px 0 8px' }}>By hand</div>
        <div className="addlist">
          {BY_HAND.map((a) => (
            <button key={a.to} tabIndex={open ? 0 : -1} onClick={() => navigate(a.to)}>
              <a.Icon size={20} color="var(--brand)" />
              <span>{a.label}</span>
              <ChevronRightIcon size={18} color="var(--ink3)" />
            </button>
          ))}
        </div>
      </div>

      <nav className="tabs" aria-label="Tabs">
        {TABS.slice(0, 2).map((t) => <Tab key={t.to} tab={t} active={t.match(pathname)} />)}
        <button className={`fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close' : 'Add'} aria-expanded={open}>
          <PlusIcon size={22} strokeWidth={2.4} />
        </button>
        {TABS.slice(2).map((t) => <Tab key={t.to} tab={t} active={t.match(pathname)} />)}
      </nav>
    </>
  );
}

function Tab({ tab, active }: { tab: (typeof TABS)[number]; active: boolean }) {
  return (
    <NavLink to={tab.to} className={active ? 'tab active' : 'tab'} aria-current={active ? 'page' : undefined}>
      <tab.Icon size={22} strokeWidth={active ? 1.9 : 1.6} />
      <span className="tab-label">{tab.label}</span>
    </NavLink>
  );
}
