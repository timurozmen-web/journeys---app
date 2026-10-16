import { useState } from 'react';
import { useFinish } from '../lib/useFinish';
import { addLoyaltyProgramme } from '../lib/queries';
import { Button, ErrorText, ScreenHeader, Segmented } from '../components/ui';


export function LogLoyaltyProgramme() {
  const finish = useFinish();
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
      finish.done('/status');
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
      <ScreenHeader title="New programme" />

      <form onSubmit={handleSubmit} style={{ padding: '0 20px 40px', display: 'grid', gap: 14 }}>
        <label className="field">
          <span className="field-label">Programme name</span>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. World of Hyatt" autoFocus />
        </label>

        <Segmented
          variant="pills" tone="brand"
          options={[{ value: 'hotel', label: 'Hotel' }, { value: 'airline', label: 'Airline' }]}
          value={form.category} onChange={(v) => set('category', v)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field">
            <span className="field-label">Current points</span>
            <input type="number" className="input" value={form.points} onChange={(e) => set('points', e.target.value)} placeholder="0" />
          </label>
          <label className="field">
            <span className="field-label">Value per point (£)</span>
            <input type="number" step="0.01" className="input" value={form.ptValue} onChange={(e) => set('ptValue', e.target.value)} placeholder="0.50" />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Current tier (optional)</span>
          <input className="input" value={form.tier} onChange={(e) => set('tier', e.target.value)} placeholder="e.g. Gold" />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field">
            <span className="field-label">Next tier (optional)</span>
            <input className="input" value={form.nextTier} onChange={(e) => set('nextTier', e.target.value)} placeholder="e.g. Platinum" />
          </label>
          <label className="field">
            <span className="field-label">Nights needed</span>
            <input type="number" className="input" value={form.nightsNeeded} onChange={(e) => set('nightsNeeded', e.target.value)} placeholder="e.g. 50" disabled={!form.nextTier} />
          </label>
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        <Button type="submit" block disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Saving…' : 'Save programme'}
        </Button>
      </form>
    </div>
  );
}
