import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { addLoyaltyProgramme } from '../lib/queries';

const inputStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
  color: 'var(--ink)', fontSize: 15, padding: '11px 12px', width: '100%', outline: 'none', minWidth: 0, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.05em', marginBottom: 5, display: 'block',
};

export function LogLoyaltyProgramme() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', points: '', ptValue: '0.5', tier: '', nextTier: '', nightsNeeded: '',
    category: 'hotel' as 'hotel' | 'airline',
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Give the programme a name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addLoyaltyProgramme({
        name: form.name.trim(),
        points: form.points ? parseInt(form.points, 10) : 0,
        ptValue: form.ptValue ? parseFloat(form.ptValue) : 0.5,
        tier: form.tier.trim() || null,
        nextTier: form.nextTier.trim() || null,
        nightsNeeded: form.nightsNeeded ? parseInt(form.nightsNeeded, 10) : null,
        category: form.category,
      });
      navigate('/wallet');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.includes('duplicate') || err.message.includes('unique')
            ? 'You already have a loyalty programme with this name.'
            : err.message
          : 'Failed to save';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Add a loyalty scheme</div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '10px 20px 40px', display: 'grid', gap: 16 }}>
        <div>
          <label style={labelStyle}>Programme name</label>
          <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. World of Hyatt" autoFocus />
        </div>

        <div>
          <label style={labelStyle}>Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['hotel', 'airline'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('category', c)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                  border: form.category === c ? '2px solid var(--brand)' : '1px solid var(--line)',
                  background: form.category === c ? 'rgba(91,63,166,.08)' : 'var(--card)',
                  color: form.category === c ? 'var(--brand)' : 'var(--ink)',
                }}
              >
                {c === 'hotel' ? 'Hotel' : 'Airline'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Current points</label>
            <input type="number" style={inputStyle} value={form.points} onChange={(e) => set('points', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={labelStyle}>Value per point (£)</label>
            <input type="number" step="0.01" style={inputStyle} value={form.ptValue} onChange={(e) => set('ptValue', e.target.value)} placeholder="0.50" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Current tier (optional)</label>
          <input style={inputStyle} value={form.tier} onChange={(e) => set('tier', e.target.value)} placeholder="e.g. Gold" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Next tier (optional)</label>
            <input style={inputStyle} value={form.nextTier} onChange={(e) => set('nextTier', e.target.value)} placeholder="e.g. Platinum" />
          </div>
          <div>
            <label style={labelStyle}>Nights needed</label>
            <input type="number" style={inputStyle} value={form.nightsNeeded} onChange={(e) => set('nightsNeeded', e.target.value)} placeholder="e.g. 50" disabled={!form.nextTier} />
          </div>
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '13px 0', borderRadius: 12, border: 'none',
            background: saving ? 'var(--card2)' : 'var(--brand)', color: saving ? 'var(--ink2)' : '#fff',
            fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer', marginTop: 4,
          }}
        >
          {saving ? 'Saving…' : 'Add programme'}
        </button>
      </form>
    </div>
  );
}
