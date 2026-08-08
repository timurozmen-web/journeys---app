import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addFlight, updateFlight } from '../lib/queries';
import type { Flight } from '../types';
import { useTrips } from '../lib/useLiveData';
import { BackIcon } from '../components/Icons';

const CABINS = ['Economy', 'Premium Economy', 'Business', 'First'] as const;
const STATUSES = ['Completed', 'Booked'] as const;
const inputStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
  color: 'var(--ink)', fontSize: 15, padding: '11px 12px', width: '100%', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.05em', marginBottom: 5, display: 'block',
};

export function LogFlight() {
  const navigate = useNavigate();
  const location = useLocation();
  const editing = (location.state as { flight?: Flight; tripId?: string } | null)?.flight;
  const presetTripId = (location.state as { flight?: Flight; tripId?: string } | null)?.tripId;
  const { data: trips } = useTrips();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: editing?.date ?? '', from: editing?.from ?? '', to: editing?.to ?? '',
    airline: editing?.airline ?? '', flightNo: editing?.flightNo ?? '',
    cabin: (editing?.cabin ?? 'Economy') as (typeof CABINS)[number],
    status: (editing?.status ?? 'Completed') as (typeof STATUSES)[number],
    cost: editing?.cost != null ? String(editing.cost) : '',
    award: editing?.award ?? false, tripId: presetTripId ?? '',
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.from || !form.to || !form.airline) {
      setError('Date, airports, and airline are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        date: form.date, from: form.from, to: form.to, airline: form.airline,
        flightNo: form.flightNo || null, cabin: form.cabin, status: form.status,
        cost: form.cost ? parseFloat(form.cost) : null, award: form.award,
        tripId: form.tripId || null,
      };
      if (editing) {
        await updateFlight(editing.id, payload);
      } else {
        await addFlight(payload);
      }
      navigate(form.tripId ? `/trips/${form.tripId}` : '/trips');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
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
        <div className="h1" style={{ fontSize: 21 }}>{editing ? 'Edit flight' : 'Log a flight'}</div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <div>
          <label style={labelStyle}>Date *</label>
          <input style={inputStyle} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>From *</label>
            <input style={inputStyle} value={form.from} onChange={(e) => set('from', e.target.value.toUpperCase())} placeholder="LHR" maxLength={3} />
          </div>
          <div>
            <label style={labelStyle}>To *</label>
            <input style={inputStyle} value={form.to} onChange={(e) => set('to', e.target.value.toUpperCase())} placeholder="JFK" maxLength={3} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Airline *</label>
            <input style={inputStyle} value={form.airline} onChange={(e) => set('airline', e.target.value)} placeholder="British Airways" />
          </div>
          <div>
            <label style={labelStyle}>Flight no.</label>
            <input style={inputStyle} value={form.flightNo} onChange={(e) => set('flightNo', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Cabin</label>
            <select style={inputStyle} value={form.cabin} onChange={(e) => set('cabin', e.target.value as (typeof CABINS)[number])}>
              {CABINS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={(e) => set('status', e.target.value as (typeof STATUSES)[number])}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Cost (£)</label>
            <input style={inputStyle} type="number" step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="Optional" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 11 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink2)' }}>
              <input type="checkbox" checked={form.award} onChange={(e) => set('award', e.target.checked)} />
              Award / points redemption
            </label>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Attach to trip</label>
          <select style={inputStyle} value={form.tripId} onChange={(e) => set('tripId', e.target.value)}>
            <option value="">No trip — standalone</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.start})</option>)}
          </select>
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

        <button type="submit" disabled={saving} style={{
          background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 12,
          padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 6,
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save flight'}
        </button>
      </form>
      <div style={{ height: 30 }} />
    </div>
  );
}
