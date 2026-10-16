import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addFlight, updateFlight, deleteFlight } from '../lib/queries';
import { withOfflineFallback } from '../lib/offlineQueue';
import type { Flight } from '../types';
import { useTrips, useAllFlights } from '../lib/useLiveData';
import { findLikelyDuplicateFlight } from '../lib/duplicateDetection';
import { airlineFromFlightNo } from '../lib/flightNumber';
import { Button, Confirm, ErrorText, ScreenHeader } from '../components/ui';
import { MailIcon } from '../components/Icons';
import { useFinish } from '../lib/useFinish';

const CABINS = ['Economy', 'Premium Economy', 'Business', 'First'] as const;
const STATUSES = ['Completed', 'Booked'] as const;

export function LogFlight() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { flight?: Flight; tripId?: string; prefill?: Partial<Flight>; extractNote?: string } | null;
  const finish = useFinish();
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
  const [confirmedDupState, setConfirmedDup] = useState(false);
  const TODAY = new Date().toISOString().slice(0, 10);
  const [saving, setSaving] = useState(false);
  // Less-used fields stay folded away until asked for (open when editing).
  const [more, setMore] = useState(!!editing);
  const [autoAirline, setAutoAirline] = useState<string | null>(null);
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
    await save(false);
  }

  // "Save anyway" saves straight away.
  async function save(dupOk: boolean) {
    if (dupOk) setConfirmedDup(true);
    const confirmedDup = dupOk || confirmedDupState;
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
      finish.done(form.tripId ? `/trips/${form.tripId}` : '/trips');
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
      <ScreenHeader
        title={editing ? 'Edit flight' : 'New flight'} sub={presetTrip?.title}
        right={editing ? undefined : (
          <button type="button" className="iconbtn" aria-label="Import from an email or screenshot" onClick={() => navigate('/scan-email', { replace: true, state: { tripId: presetTripId, back: (location.state as { back?: boolean } | null)?.back } })}>
            <MailIcon size={20} />
          </button>
        )}
      />

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <label className="field">
          <span className="field-label">Date *</span>
          <input
            className="input" type="date" value={form.date}
            onChange={(e) => {
              const date = e.target.value;
              setForm((f) => ({ ...f, date, status: statusTouched ? f.status : date > TODAY ? 'Booked' : 'Completed' }));
            }}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <label className="field">
            <span className="field-label">From *</span>
            <input className="input" list="known-from" value={form.from} onChange={(e) => set('from', e.target.value.toUpperCase())} placeholder="LHR" maxLength={3} />
            <datalist id="known-from">{knownFrom.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="field">
            <span className="field-label">To *</span>
            <input className="input" list="known-to" value={form.to} onChange={(e) => set('to', e.target.value.toUpperCase())} placeholder="JFK" maxLength={3} />
            <datalist id="known-to">{knownTo.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <label className="field">
            <span className="field-label">Flight no.</span>
            <input
              className="input" value={form.flightNo} placeholder="e.g. BA866" autoCapitalize="characters"
              onChange={(e) => {
                const flightNo = e.target.value;
                // Fill the airline from the flight number unless one was typed by hand.
                const airline = airlineFromFlightNo(flightNo, allFlights);
                setForm((f) => ({ ...f, flightNo, airline: airline && (!f.airline || f.airline === autoAirline) ? airline : f.airline }));
                if (airline) setAutoAirline(airline);
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">Airline *</span>
            <input className="input" list="known-airlines" value={form.airline} onChange={(e) => set('airline', e.target.value)} placeholder="British Airways" />
            <datalist id="known-airlines">{knownAirlines.map((a) => <option key={a} value={a} />)}</datalist>
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <label className="field">
            <span className="field-label">Cabin</span>
            <select className="input" value={form.cabin} onChange={(e) => set('cabin', e.target.value as (typeof CABINS)[number])}>
              {CABINS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Cost (£)</span>
            <input className="input" type="number" step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} placeholder="Optional" />
          </label>
        </div>
        <button type="button" className="btn ghost small" style={{ justifySelf: 'start', padding: '4px 0' }} onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? 'Fewer details' : 'More details'}
        </button>
        {more && (
          <>
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="field">
                <span className="field-label">Departs (optional)</span>
                <input className="input" type="time" value={form.departureTime} onChange={(e) => set('departureTime', e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">Arrives (optional)</span>
                <input className="input" type="time" value={form.arrivalTime} onChange={(e) => set('arrivalTime', e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
              <label className="field">
                <span className="field-label">Status</span>
                <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as (typeof STATUSES)[number])}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
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
                Overnight flight (no hotel needed that night)
              </label>
            </div>
          </>
        )}
        {!presetTripId && (
        <label className="field">
          <span className="field-label">Attach to trip</span>
          <select className="input" value={form.tripId} onChange={(e) => set('tripId', e.target.value)}>
            <option value="">No trip — standalone</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.start})</option>)}
          </select>
        </label>
        )}

        {extractNote && <div className="formnote">{extractNote}</div>}
        {dupWarning && (
          <Confirm confirmLabel="Save anyway" cancelLabel="Let me check" onConfirm={() => save(true)} onCancel={() => setDupWarning(null)}>
            Looks like {dupWarning}, already logged.
          </Confirm>
        )}
        {error && <ErrorText>{error}</ErrorText>}

        <Button type="submit" block disabled={saving} style={{ marginTop: 6 }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save flight'}
        </Button>

        {editing && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="removecard" style={{ justifySelf: 'start', padding: '10px 0' }}
          >
            Delete this flight
          </button>
        )}
        {editing && confirmingDelete && (
          <Confirm
            danger busy={deleting} confirmLabel={deleting ? 'Deleting…' : 'Delete flight'}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={async () => {
              setDeleting(true);
              try {
                await deleteFlight(editing.id);
                finish.gone(form.tripId ? `/trips/${form.tripId}` : '/trips');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete it.');
                setDeleting(false);
              }
            }}
          >
            Delete {editing.flightNo ?? `${editing.from} → ${editing.to}`}?
          </Confirm>
        )}
      </form>
      <div style={{ height: 30 }} />
    </div>
  );
}
