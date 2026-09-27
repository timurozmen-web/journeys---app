import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addLoyaltyProgramme } from '../lib/queries';
import { Button, ErrorText, ScreenHeader } from '../components/ui';


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
      <ScreenHeader title="Add a loyalty scheme" />

      <form onSubmit={handleSubmit} style={{ padding: '10px 20px 40px', display: 'grid', gap: 16 }}>
        <div>
          <label className="field-label">Programme name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. World of Hyatt" autoFocus />
        </div>

        <div>
          <label className="field-label">Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['hotel', 'airline'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('category', c)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--r-control)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer',
                  border: form.category === c ? '2px solid var(--brand)' : '1px solid var(--line)',
                  background: form.category === c ? 'var(--brand-soft)' : 'var(--card)',
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
            <label className="field-label">Current points</label>
            <input type="number" className="input" value={form.points} onChange={(e) => set('points', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="field-label">Value per point (£)</label>
            <input type="number" step="0.01" className="input" value={form.ptValue} onChange={(e) => set('ptValue', e.target.value)} placeholder="0.50" />
          </div>
        </div>

        <div>
          <label className="field-label">Current tier (optional)</label>
          <input className="input" value={form.tier} onChange={(e) => set('tier', e.target.value)} placeholder="e.g. Gold" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="field-label">Next tier (optional)</label>
            <input className="input" value={form.nextTier} onChange={(e) => set('nextTier', e.target.value)} placeholder="e.g. Platinum" />
          </div>
          <div>
            <label className="field-label">Nights needed</label>
            <input type="number" className="input" value={form.nightsNeeded} onChange={(e) => set('nightsNeeded', e.target.value)} placeholder="e.g. 50" disabled={!form.nextTier} />
          </div>
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        <Button type="submit" block disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Saving…' : 'Add programme'}
        </Button>
      </form>
    </div>
  );
}
