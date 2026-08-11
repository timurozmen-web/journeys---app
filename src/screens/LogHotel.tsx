import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addHotel, updateHotel } from '../lib/queries';
import type { Hotel } from '../types';
import { useTrips, useAllHotels } from '../lib/useLiveData';
import { BackIcon } from '../components/Icons';

const CATEGORIES = ['Luxury', 'Premium', 'Midscale', 'Budget'] as const;
const STATUSES = ['Completed', 'Booked', 'needs-confirm'] as const;
const inputStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
  color: 'var(--ink)', fontSize: 15, padding: '11px 12px', width: '100%', outline: 'none', minWidth: 0, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.05em', marginBottom: 5, display: 'block',
};

export function LogHotel() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { hotel?: Hotel; tripId?: string; prefill?: Partial<Hotel>; extractNote?: string } | null;
  const editing = state?.hotel;
  const presetTripId = state?.tripId;
  const prefill = state?.prefill;
  const extractNote = state?.extractNote as string | undefined;
  const src = editing ?? prefill; // either populates the form; only `editing` triggers update-mode
  const { data: trips } = useTrips();
  const { data: allHotels } = useAllHotels();
  const knownHotels = Array.from(new Map(allHotels.map((h) => [h.name, h])).values());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [confirmedOverlap, setConfirmedOverlap] = useState(false);
  const [form, setForm] = useState({
    name: src?.name ?? '', country: src?.country ?? '', city: src?.city ?? '', brand: src?.brand ?? '',
    nights: String(src?.nights ?? 1), date: src?.date ?? '',
    status: (src?.status ?? 'Completed') as (typeof STATUSES)[number],
    total: src?.total != null ? String(src.total) : '',
    card: src?.card ?? '', category: (src?.category ?? 'Premium') as (typeof CATEGORIES)[number],
    tripId: presetTripId ?? '',
    benefitValue: src?.benefitValue != null ? String(src.benefitValue) : '',
    benefitNote: src?.benefitNote ?? '',
    bookingChannel: src?.bookingChannel ?? '',
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setConfirmedOverlap(false);
    setOverlapWarning(null);
  }

  function findOverlap(): string | null {
    if (!form.tripId || !form.date) return null;
    const trip = trips.find((t) => t.id === form.tripId);
    if (!trip) return null;
    const start = form.date;
    const nights = parseInt(form.nights, 10) || 1;
    const end = new Date(start);
    end.setDate(end.getDate() + nights);
    const endStr = end.toISOString().slice(0, 10);
    for (const h of trip.hotels) {
      if (editing && h.id === editing.id) continue;
      const hEnd = new Date(h.date);
      hEnd.setDate(hEnd.getDate() + h.nights);
      const hEndStr = hEnd.toISOString().slice(0, 10);
      if (start < hEndStr && h.date < endStr) return h.name;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.country || !form.date) {
      setError('Name, country and date are required.');
      return;
    }
    if (!confirmedOverlap) {
      const overlap = findOverlap();
      if (overlap) {
        setOverlapWarning(overlap);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name, country: form.country, city: form.city || null, brand: form.brand || 'Other',
        nights: parseInt(form.nights, 10) || 1, date: form.date, status: form.status,
        total: form.total ? parseFloat(form.total) : null,
        card: form.card || null, category: form.category,
        tripId: form.tripId || null,
        benefitValue: form.benefitValue ? parseFloat(form.benefitValue) : null,
        benefitNote: form.benefitNote || null,
        bookingChannel: form.bookingChannel || null,
      };
      if (editing) {
        await updateHotel(editing.id, payload);
      } else {
        await addHotel(payload);
      }
      navigate(form.tripId ? `/trips/${form.tripId}` : '/trips');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to save.';
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
        <div className="h1" style={{ fontSize: 21 }}>{editing ? 'Edit stay' : 'Log a stay'}</div>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <div>
          <label style={labelStyle}>Hotel name *</label>
          <input
            style={inputStyle}
            list="known-hotels"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              const match = knownHotels.find((h) => h.name === name);
              if (match) {
                setForm((f) => ({
                  ...f, name, country: match.country, city: match.city ?? '', brand: match.brand,
                  category: match.category, card: match.card ?? '',
                }));
              } else {
                set('name', name);
              }
            }}
            placeholder="e.g. Marriott Marble Arch"
          />
          <datalist id="known-hotels">
            {knownHotels.map((h) => (
              <option key={h.id} value={h.name} />
            ))}
          </datalist>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label style={labelStyle}>Country *</label>
            <input style={inputStyle} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="United Kingdom" />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="London" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Brand</label>
          <input style={inputStyle} value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Marriott Bonvoy" />
        </div>
        <div>
          <label style={labelStyle}>Check-in date *</label>
          <input style={inputStyle} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Nights</label>
          <input style={inputStyle} type="number" min="1" value={form.nights} onChange={(e) => set('nights', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={(e) => set('status', e.target.value as (typeof STATUSES)[number])}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={(e) => set('category', e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label style={labelStyle}>Total cost (£)</label>
            <input style={inputStyle} type="number" step="0.01" value={form.total} onChange={(e) => set('total', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={labelStyle}>Card used</label>
            <input style={inputStyle} value={form.card} onChange={(e) => set('card', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label style={labelStyle}>Benefit value (£)</label>
            <input style={inputStyle} type="number" step="0.01" value={form.benefitValue} onChange={(e) => set('benefitValue', e.target.value)} placeholder="e.g. upgrade, breakfast" />
          </div>
          <div>
            <label style={labelStyle}>What was it</label>
            <input style={inputStyle} value={form.benefitNote} onChange={(e) => set('benefitNote', e.target.value)} placeholder="Suite upgrade, breakfast…" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Booked via (leave blank if direct)</label>
          <input style={inputStyle} value={form.bookingChannel} onChange={(e) => set('bookingChannel', e.target.value)} placeholder="e.g. Expedia" />
        </div>
        <div>
          <label style={labelStyle}>Attach to trip</label>
          <select style={inputStyle} value={form.tripId} onChange={(e) => set('tripId', e.target.value)}>
            <option value="">No trip — standalone</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.start})</option>)}
          </select>
        </div>

        {extractNote && (
          <div style={{ background: 'rgba(156,95,8,.1)', color: 'var(--amber)', fontSize: 12.5, padding: '10px 14px', borderRadius: 10, fontWeight: 600 }}>
            {extractNote}
          </div>
        )}
        {overlapWarning && (
          <div style={{ background: 'rgba(156,95,8,.1)', border: '1px solid rgba(156,95,8,.25)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12.5, color: 'var(--amber)', fontWeight: 600, marginBottom: 8 }}>
              These dates overlap with "{overlapWarning}", already logged on this trip. Save anyway?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setConfirmedOverlap(true);
                  setOverlapWarning(null);
                }}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--amber)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                Save anyway
              </button>
              <button
                type="button"
                onClick={() => setOverlapWarning(null)}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                Let me fix it
              </button>
            </div>
          </div>
        )}
        {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

        <button type="submit" disabled={saving} style={{
          background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 12,
          padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 6,
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save stay'}
        </button>
      </form>
      <div style={{ height: 30 }} />
    </div>
  );
}
