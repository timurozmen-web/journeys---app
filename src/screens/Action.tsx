import { useParams, useNavigate } from 'react-router-dom';
import { BackIcon, MailIcon, PlusCircleIcon, BedIcon, PlaneIcon } from '../components/Icons';

const CONTENT: Record<string, { title: string; body: string; actions?: { label: string; to: string; Icon: typeof MailIcon }[] }> = {
  capture: {
    title: 'Capture',
    body: 'Paste or screenshot a confirmation to pull the details automatically (and catch every booking in it), start a new trip, or log a stay or flight by hand.',
    actions: [
      { label: 'Scan an email', to: '/scan-email', Icon: MailIcon },
      { label: 'Start a new trip', to: '/log-trip', Icon: PlusCircleIcon },
      { label: 'Log a stay', to: '/log-hotel', Icon: BedIcon },
      { label: 'Log a flight', to: '/log-flight', Icon: PlaneIcon },
    ],
  },
};

export function Action() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const c = CONTENT[kind ?? ''] ?? { title: kind ?? '', body: '' };

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>{c.title}</div>
      </div>
      <p style={{ padding: '0 20px', fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.6 }}>{c.body}</p>
      {c.actions && (
        <div style={{ padding: '10px 20px', display: 'grid', gap: 10 }}>
          {c.actions.map((a) => (
            <button
              key={a.to}
              onClick={() => navigate(a.to)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px', borderRadius: 16, border: '1px solid var(--line)',
                background: 'var(--card)', cursor: 'pointer', textAlign: 'left', font: 'inherit',
              }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--card2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <a.Icon size={19} color="var(--brand)" />
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
