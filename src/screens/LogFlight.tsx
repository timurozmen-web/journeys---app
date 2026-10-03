import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addFlight, updateFlight, deleteFlight } from '../lib/queries';
import { withOfflineFallback } from '../lib/offlineQueue';
import type { Flight } from '../types';
import { useTrips, useAllFlights } from '../lib/useLiveData';
import { findLikelyDuplicateFlight } from '../lib/duplicateDetection';
import { Button, ErrorText, ScreenHeader } from '../components/ui';

const CABINS = ['Economy', 'Premium Economy', 'Business', 'First'] as const;
const STATUSES = ['Completed', 'Booked'] as const;

export function LogFlight() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { flight?: Flight; tripId?: string; prefill?: Partial<Flight>; extractNote?: string; returnTo?: { pathname: string; state?: unknown } } | null;
  const editing = state?.flight;
  const presetTripId = state?.tripId;
  const prefill = state?.prefill;
  const src = editing ?? prefill;
  const extractNote = state?.extractNote as string | undefined;
  const { data: trips } = useTrips();
  const { data: allFlights } = useAllFlights();
  const presetTrip = trips.find((t) => t.id === presetTripId);
  const knownFrom = Array.from(new Set(allFlights.map((f) => f.from))).sort();
  const knownTo = Array.from(new Set(allFlights.map((f) => f.to))).sort();
  const knownAirlines = Array.from(new Set(allFlights.map((f) => f.airline))).sort();
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [confirmedDup, setConfirmedDup] = useState(false);
  const TODAY = new Date().toISOString().slice(0, 10);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [statusTouched, setStatusTouched] = useState(!!src?.status);
  const [form, setForm] = useState({
    date: src?.date ?? '', from: src?.from ?? '', to: src?.to ?? '',
    airline: src?.airline ?? '', flightNo: src?.flightNo ?? '',
    cabin: (src?.cabin ?? 'Economy') as (typeof CABINS)[number],
    status: (src?.status ?? (src?.date && src.date > TODAY ? 'Booked' : 'Completed')) as (typeof STATUSES)[number],
    cost: src?.cost != null ? String(src.cost) : '',
    award: src?.award ?? false, overnight: src?.overnight ?? false, tripId: presetTripId ?? '',
    departureTime: src?.departureTime ?? '', arrivalTime: src?.arrivalTime ?? '',
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    if (key === 'status') setStatusTouched(true);
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.from || !form.to || !form.airline) {
      setError('Date, airports, and airline are required.');
      return;
    }
    if (!editing && !confirmedDup) {
      const dup = findLikelyDuplicateFlight({ date: form.date, from: form.from, to: form.to }, allFlights);
      if (dup) {
        setDupWarning(`${dup.airline} ${dup.from} → ${dup.to} on ${dup.date}`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        date: form.date, from: form.from, to: form.to, airline: form.airline,
        flightNo: form.flightNo || null, cabin: form.cabin, status: form.status,
        cost: form.cost ? parseFloat(form.cost) : null, award: form.award, overnight: form.overnight,
        tripId: form.tripId || null, departureTime: form.departureTime || null, arrivalTime: form.arrivalTime || null,
      };
      if (editing) {
        await updateFlight(editing.id, payload);
      } else {
        await withOfflineFallback('addFlight', `${payload.airline ?? 'Flight'} ${payload.flightNo ?? ''}`.trim(), addFlight, payload);
      }
      if (state?.returnTo) navigate(state.returnTo.pathname, { state: state.returnTo.state });
      else navigate(form.tripId ? `/trips/${form.tripId}` : '/trips');
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
      <ScreenHeader title={editing ? 'Edit flight' : presetTrip ? `Log a flight for ${presetTrip.title}` : 'Log a flight'} />

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <div>
          <label className="field-label">Date *</label>
          <input
            className="input" type="date" value={form.date}
            onChange={(e) => {
              const date = e.target.value;
              setForm((f) => ({ ...f, date, status: statusTouched ? f.status : date > TODAY ? 'Booked' : 'Completed' }));
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label className="field-label">From *</label>
            <input className="input" list="known-from" value={form.from} onChange={(e) => set('from', e.target.value.toUpperCase())} placeholder="LHR" maxLength={3} />
            <datalist id="known-from">{knownFrom.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="field-label">To *</label>
            <input className="input" list="known-to" value={form.to} onChange={(e) => set('to', e.target.value.toUpperCase())} placeholder="JFK" maxLength={3} />
            <datalist id="known-to">{knownTo.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label className="field-label">Departs (optional)</label>
            <input className="input" type="time" value={form.departureTime} onChange={(e) => set('departureTime', e.target.value)} />
          </div>
          <div>
            <label className="field-label">Arrives (optional)</label>
            <input className="input" type="time" value={form.arrivalTime} onChange={(e) => set('arrivalTime', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label className="field-label">Airline *</label>
            <input className="input" list="known-airlines" value={form.airline} onChange={(e) => set('airline', e.target.value)} placeholder="British Airways" />
            <datalist id="known-airlines">{knownAirlines.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <div>
            <label className="field-label">Flight no.</label>
            <input className="input" value={form.flightNo} onChange={(e) => set('flightNo', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label className="field-label">Cabin</label>
            <select className="input" value={form.cabin} onChange={(e) => set('cabin', e.target.value as (typeof CABINS)[number])}>
              {CABINS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as (typeof STATUSES)[number])}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label className="field-label">Cost (£)</label>
            <input className="input" type="number" step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="Optional" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 11 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-body-lg)', color: 'var(--ink2)' }}>
              <input type="checkbox" checked={form.award} onChange={(e) => set('award', e.target.checked)} />
              Award / points redemption
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-body-lg)', color: 'var(--ink2)' }}>
            <input type="checkbox" checked={form.overnight} onChange={(e) => set('overnight', e.target.checked)} />
            Overnight or long-haul flight, covers the night before and of this date. No hotel needed either night.
          </label>
        </div>
        {!presetTripId && (
        <div>
          <label className="field-label">Attach to trip</label>
          <select className="input" value={form.tripId} onChange={(e) => set('tripId', e.target.value)}>
            <option value="">No trip — standalone</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.start})</option>)}
          </select>
        </div>
        )}

        {extractNote && (
          <div style={{ background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 'var(--fs-small)', padding: '10px 14px', borderRadius: 'var(--r-control)', fontWeight: 600 }}>
            {extractNote}
          </div>
        )}
        {dupWarning && (
          <div style={{ background: 'var(--amber-soft)', border: '1px solid rgba(232,176,75,.3)', borderRadius: 'var(--r-control)', padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--amber)', fontWeight: 600, marginBottom: 8 }}>
              This looks like it might already be logged as {dupWarning}: same route and date. Save anyway?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setConfirmedDup(true);
                  setDupWarning(null);
                }}
                style={{ padding: '6px 12px', borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--amber)', color: 'var(--on-dark)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
              >
                Save anyway
              </button>
              <button
                type="button"
                onClick={() => setDupWarning(null)}
                style={{ padding: '6px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
              >
                Let me check
              </button>
            </div>
          </div>
        )}
        {error && <ErrorText>{error}</ErrorText>}

        <Button type="submit" block disabled={saving} style={{ marginTop: 6 }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save flight'}
        </Button>

        {editing && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="btn ghost" style={{ color: 'var(--red)', fontSize: 'var(--fs-body)', fontWeight: 600, padding: '6px 0', justifyContent: 'flex-start' }}
          >
            Delete this flight
          </button>
        )}
        {editing && confirmingDelete && (
          <div style={{ background: 'var(--red-soft)', border: '1px solid rgba(240,138,126,.3)', borderRadius: 'var(--r-control)', padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--red)', fontWeight: 600, marginBottom: 8 }}>
              Delete this {editing.from} → {editing.to} flight permanently? This can't be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteFlight(editing.id);
                    navigate(form.tripId ? `/trips/${form.tripId}` : '/trips');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete.');
                    setDeleting(false);
                  }
                }}
                style={{ padding: '6px 12px', borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--red)', color: 'var(--on-dark)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete it'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                style={{ padding: '6px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </form>
      <div style={{ height: 30 }} />
    </div>
  );
}
