import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';

export function Capture() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Log something</div>
      </div>
      <div className="stack">
        <button className="row" style={{ borderRadius: 14, border: '1px solid var(--line)', padding: 16 }}
          onClick={() => navigate('/log-hotel')}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>🏨 Hotel stay</span>
        </button>
        <button className="row" style={{ borderRadius: 14, border: '1px solid var(--line)', padding: 16 }}
          onClick={() => navigate('/log-flight')}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>✈️ Flight</span>
        </button>
      </div>
      <p className="note">
        Manual entry today — this is also the foundation the AI-powered "scan a confirmation email" version
        will write into later, same forms, same validation.
      </p>
    </div>
  );
}
