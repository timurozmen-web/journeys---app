import { useParams, useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';

const CONTENT: Record<string, { title: string; body: string; actions?: { label: string; to: string }[] }> = {
  capture: {
    title: 'Capture',
    body: 'Paste a confirmation email to have the details pulled out automatically, or log a stay or flight by hand.',
    actions: [
      { label: '✉️ Scan an email', to: '/scan-email' },
      { label: '+ Log a stay', to: '/log-hotel' },
      { label: '+ Log a flight', to: '/log-flight' },
    ],
  },
  plan: {
    title: 'Plan',
    body: 'Scores destinations against your real balances using the redemption maths already in Wallet. Not built yet — live award availability needs an external data feed first.',
  },
  discover: {
    title: 'Discover',
    body: 'Surfaces promotions and redemptions worth using, filtered by the balances and cards you actually hold. Not built yet — needs a live award/promo data source.',
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
      <p style={{ padding: '0 20px', fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6 }}>{c.body}</p>
      {c.actions && (
        <div style={{ padding: '10px 20px', display: 'grid', gap: 10 }}>
          {c.actions.map((a) => (
            <button
              key={a.to}
              onClick={() => navigate(a.to)}
              style={{ padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
