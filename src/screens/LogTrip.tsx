import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addTrip, updateTrip } from '../lib/queries';
import type { Trip } from '../types';
import { BackIcon } from '../components/Icons';

const inputStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
  color: 'var(--ink)', fontSize: 15, padding: '11px 12px', width: '100%', outline: 'none', minWidth: 0, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.05em', marginBottom: 5, display: 'block',
};

export function LogTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const editing = (location.state as { trip?: Trip } | null)?.trip;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: editing?.title ?? '',
    start: editing?.start ?? '',
    end: editing?.end ?? '',
    tripType: (editing?.tripType ?? 'leisure') as 'work' | 'leisure',
    notes: editing?.notes ?? '',
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.start || !form.end) {
      setError('Title, start date, and end date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateTrip(editing.id, form);
        navigate(`/trips/${editing.id}`);
      } else {
        const id = await addTrip(form);
        navigate(`/trips/${id}`);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Something went wrong';
      setError(message);
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>{editing ? 'Edit trip' : 'New trip'}</div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <div>
          <label style={labelStyle}>Trip name *</label>
          <input style={inputStyle} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Japan 2027" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label style={labelStyle}>Start date *</label>
            <input style={inputStyle} type="date" value={form.start} onChange={(e) => set('start', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>End date *</label>
            <input style={inputStyle} type="date" value={form.end} onChange={(e) => set('end', e.target.value)} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>You're travelling for…</label>
          <div
            onClick={() => set('tripType', form.tripType === 'work' ? 'leisure' : 'work')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: form.tripType === 'leisure' ? 'var(--ink)' : 'var(--ink3)', flex: 1 }}>
              Leisure
            </span>
            <span
              style={{
                width: 46, height: 26, borderRadius: 99, position: 'relative', flexShrink: 0,
                background: form.tripType === 'work' ? 'var(--brand)' : 'var(--line)',
                transition: 'background .18s ease',
              }}
            >
              <span
                style={{
                  position: 'absolute', top: 3, left: form.tripType === 'work' ? 23 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .18s ease',
                }}
              />
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: form.tripType === 'work' ? 'var(--ink)' : 'var(--ink3)', flex: 1, textAlign: 'right' }}>
              Work
            </span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional"
          />
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '13px 0', borderRadius: 12, border: 'none',
            background: saving ? 'var(--card2)' : 'var(--brand)', color: saving ? 'var(--ink3)' : '#fff',
            fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer', marginTop: 4,
          }}
        >
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create trip'}
        </button>
      </form>
    </div>
  );
}
