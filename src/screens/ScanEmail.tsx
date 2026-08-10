import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';

const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6, display: 'block' };

export function ScanEmail() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleExtract() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/extract-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');

      if (data.type === 'hotel') {
        navigate('/log-hotel', {
          state: {
            prefill: {
              name: data.name, country: data.country, city: data.city, brand: data.brand,
              date: data.checkIn, nights: data.nights, total: data.total,
            },
            extractNote: data.currency && data.currency !== 'GBP' ? `Detected amount was in ${data.currency} — double-check the £ figure.` : undefined,
          },
        });
      } else if (data.type === 'flight') {
        navigate('/log-flight', {
          state: {
            prefill: {
              date: data.date, from: data.from, to: data.to, airline: data.airline,
              flightNo: data.flightNo, cabin: data.cabin, cost: data.cost,
            },
            extractNote: data.currency && data.currency !== 'GBP' ? `Detected amount was in ${data.currency} — double-check the £ figure.` : undefined,
          },
        });
      } else {
        setError("Couldn't tell if this was a hotel or flight confirmation — try pasting more of the email, or enter it manually.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Scan an email</div>
      </div>
      <p style={{ padding: '0 20px 4px', fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
        Paste the full text of a hotel or flight confirmation email below. You'll get a chance to review and correct everything before it's saved.
      </p>
      <div style={{ padding: '10px 20px' }}>
        <label style={labelStyle}>Email text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the confirmation email here…"
          rows={12}
          style={{
            width: '100%', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
            color: 'var(--ink)', fontSize: 13.5, padding: '11px 12px', outline: 'none', resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
        <button
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          style={{
            width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 12, border: 'none',
            background: loading || !text.trim() ? 'var(--card2)' : 'var(--brand)',
            color: loading || !text.trim() ? 'var(--ink3)' : '#fff',
            fontSize: 15, fontWeight: 700, cursor: loading || !text.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Reading…' : 'Extract details'}
        </button>
      </div>
    </div>
  );
}
