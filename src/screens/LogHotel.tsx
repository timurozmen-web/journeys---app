import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addHotel, updateHotel, deleteHotel, addTrip, updateTrip } from '../lib/queries';
import { withOfflineFallback } from '../lib/offlineQueue';
import { suggestTripAssignment } from '../lib/autoTrip';
import { normalizeBrand } from '../data/brandMap';
import type { Hotel } from '../types';
import { useTrips, useAllHotels, useAllFlights } from '../lib/useLiveData';
import { findLikelyDuplicateHotel } from '../lib/duplicateDetection';
import { Button, ErrorText, ScreenHeader } from '../components/ui';

const CATEGORIES = ['Luxury', 'Premium', 'Midscale', 'Budget'] as const;
const STATUSES = ['Completed', 'Booked', 'needs-confirm'] as const;
const RATE_TYPES = ['Standard', 'Member', 'Promotional', 'Non-refundable', 'Other'] as const;

export function LogHotel() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { hotel?: Hotel; tripId?: string; prefill?: Partial<Hotel>; extractNote?: string; returnTo?: { pathname: string; state?: unknown } } | null;
  const editing = state?.hotel;
  const presetTripId = state?.tripId;
  const prefill = state?.prefill;
  const extractNote = state?.extractNote as string | undefined;
  const src = editing ?? prefill; // either populates the form; only `editing` triggers update-mode
  const { data: trips } = useTrips();
  const { data: allHotels } = useAllHotels();
  const { data: allFlights } = useAllFlights();
  const knownHotels = Array.from(new Map(allHotels.map((h) => [h.name, h])).values());
  const [manualTripOverride, setManualTripOverride] = useState(!!presetTripId || !!editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [confirmedOverlap, setConfirmedOverlap] = useState(false);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [confirmedDup, setConfirmedDup] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusTouched, setStatusTouched] = useState(!!src?.status); // don't auto-override an explicit status from editing/extraction
  const TODAY = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: src?.name ?? '', country: src?.country ?? '', city: src?.city ?? '', brand: src?.brand ?? '',
    nights: String(src?.nights ?? 1), date: src?.date ?? '',
    status: (src?.status ?? (src?.date && src.date > TODAY ? 'Booked' : 'Completed')) as (typeof STATUSES)[number],
    total: src?.total != null ? String(src.total) : '',
    card: src?.card ?? '', category: (src?.category ?? 'Premium') as (typeof CATEGORIES)[number],
    tripId: presetTripId ?? '',
    benefitValue: src?.benefitValue != null ? String(src.benefitValue) : '',
    benefitNote: src?.benefitNote ?? '',
    benefitType: src?.benefitType ?? '',
    bookingChannel: src?.bookingChannel ?? '',
    roomType: src?.roomType ?? '',
    award: src?.award ?? false,
    rateType: (src?.rateType ?? 'Standard') as (typeof RATE_TYPES)[number],
    avgRate: src?.avgRate != null ? String(src.avgRate) : '',
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setConfirmedOverlap(false);
    setOverlapWarning(null);
  }

  const autoSuggestion = suggestTripAssignment(form.date || TODAY, form.city || null, form.country, trips, allFlights);

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
    if (!editing && !confirmedDup) {
      const dup = findLikelyDuplicateHotel({ name: form.name, brand: form.brand || null, checkIn: form.date }, allHotels);
      if (dup) {
        setDupWarning(dup.name);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const nights = parseInt(form.nights, 10) || 1;
      const total = form.total ? parseFloat(form.total) : null;
      const avgRate = form.rateType === 'Standard' ? (total != null ? total / nights : null) : form.avgRate ? parseFloat(form.avgRate) : null;

      let resolvedTripId = form.tripId || null;
      if (!manualTripOverride) {
        if (autoSuggestion.tripId) {
          resolvedTripId = autoSuggestion.tripId;
          const existingTrip = trips.find((t) => t.id === autoSuggestion.tripId);
          if (existingTrip) {
            const newEnd = new Date(form.date);
            newEnd.setDate(newEnd.getDate() + nights);
            const newEndStr = newEnd.toISOString().slice(0, 10);
            if (newEndStr > existingTrip.end) {
              await withOfflineFallback('updateTrip', `Extend ${existingTrip.title}`, updateTrip, existingTrip.id, {
                title: existingTrip.title, start: existingTrip.start, end: newEndStr,
                tripType: existingTrip.tripType, notes: existingTrip.notes,
              });
            }
          }
        } else {
          const end = new Date(form.date);
          end.setDate(end.getDate() + nights);
          const newTripInput = {
            title: autoSuggestion.suggestedTitle, start: form.date, end: end.toISOString().slice(0, 10),
            tripType: autoSuggestion.tripType, notes: '',
          };
          // Pre-generate the id client-side so the hotel below can
          // reference this trip right away, even if creating the trip
          // itself also has to queue for later -- addTrip accepts an
          // explicit id specifically to make this chaining work; without
          // it, a queued trip wouldn't have a real id yet for the
          // queued hotel to point at.
          resolvedTripId = crypto.randomUUID();
          await withOfflineFallback(
            'addTrip', autoSuggestion.suggestedTitle,
            async (input: typeof newTripInput, id: string) => { await addTrip(input, id); },
            newTripInput, resolvedTripId
          );
        }
      }

      const payload = {
        name: form.name, country: form.country, city: form.city || null, brand: normalizeBrand(form.brand || 'Other'),
        nights, date: form.date, status: form.status,
        total,
        card: form.card || null, category: form.category,
        tripId: resolvedTripId,
        benefitValue: form.benefitValue ? parseFloat(form.benefitValue) : null,
        benefitNote: form.benefitNote || null,
        benefitType: form.benefitType || null,
        bookingChannel: form.bookingChannel || null,
        roomType: form.roomType || null,
        award: form.award,
        rateType: form.rateType,
        nightlyRate: total != null ? total / nights : null,
        avgRate,
      };
      if (editing) {
        await updateHotel(editing.id, payload);
      } else {
        // If this can't reach the network, it queues instead of failing
        // outright -- the persistent "N pending" indicator in the tab
        // bar is what tells the user it's waiting to sync, rather than
        // a one-off message here that would vanish on navigation anyway.
        await withOfflineFallback('addHotel', `${payload.name} stay`, addHotel, payload);
      }
      if (state?.returnTo) navigate(state.returnTo.pathname, { state: state.returnTo.state });
      else navigate(resolvedTripId ? `/trips/${resolvedTripId}` : '/trips');
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
      <ScreenHeader title={editing ? 'Edit stay' : 'Log a stay'} />

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <div>
          <label className="field-label">Hotel name *</label>
          <input
            className="input"
            list="known-hotels"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              const match = knownHotels.find((h) => h.name === name);
              if (match) {
                setForm((f) => ({
                  ...f, name, country: match.country, city: match.city ?? '', brand: normalizeBrand(match.brand),
                  category: match.category, card: match.card ?? '', roomType: match.roomType ?? f.roomType,
                  rateType: (match.rateType as (typeof RATE_TYPES)[number]) ?? f.rateType,
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
            <label className="field-label">Country *</label>
            <input className="input" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="United Kingdom" />
          </div>
          <div>
            <label className="field-label">City</label>
            <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="London" />
          </div>
        </div>
        <div>
          <label className="field-label">Brand</label>
          <input
            className="input"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
            onBlur={(e) => e.target.value && set('brand', normalizeBrand(e.target.value))}
            placeholder="Marriott Bonvoy"
          />
        </div>
        <div>
          <label className="field-label">Check-in date *</label>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => {
              const date = e.target.value;
              setForm((f) => ({ ...f, date, status: statusTouched ? f.status : date > TODAY ? 'Booked' : 'Completed' }));
              setConfirmedOverlap(false);
              setOverlapWarning(null);
            }}
          />
        </div>
        <div>
          <label className="field-label">Nights</label>
          <input className="input" type="number" min="1" value={form.nights} onChange={(e) => set('nights', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label className="field-label">Status</label>
            <select className="input" value={form.status} onChange={(e) => { setStatusTouched(true); set('status', e.target.value as (typeof STATUSES)[number]); }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label className="field-label">Total cost (£)</label>
            <input className="input" type="number" step="0.01" value={form.total} onChange={(e) => set('total', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="field-label">Card used</label>
            <input className="input" value={form.card} onChange={(e) => set('card', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-body)', color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.award} onChange={(e) => set('award', e.target.checked)} />
          Booked with points/certificate (award stay -- doesn't earn elite night credit)
        </label>
        <div>
          <label className="field-label">Room type</label>
          <input className="input" value={form.roomType} onChange={(e) => set('roomType', e.target.value)} placeholder="e.g. Deluxe King, City View" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label className="field-label">Rate type</label>
            <select
              className="input"
              value={form.rateType}
              onChange={(e) => {
                const rateType = e.target.value as (typeof RATE_TYPES)[number];
                setForm((f) => ({
                  ...f, rateType,
                  avgRate: rateType === 'Standard' && f.total ? (parseFloat(f.total) / (parseInt(f.nights, 10) || 1)).toFixed(2) : f.avgRate,
                }));
              }}
            >
              {RATE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Standard rate (£/night)</label>
            <input
              className="input" style={{ opacity: form.rateType === 'Standard' ? 0.6 : 1 }}
              type="number"
              step="0.01"
              value={form.rateType === 'Standard' && form.total ? (parseFloat(form.total) / (parseInt(form.nights, 10) || 1)).toFixed(2) : form.avgRate}
              onChange={(e) => set('avgRate', e.target.value)}
              disabled={form.rateType === 'Standard'}
              placeholder="What it would've cost at standard rate"
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label className="field-label">Benefit value (£)</label>
            <input className="input" type="number" step="0.01" value={form.benefitValue} onChange={(e) => set('benefitValue', e.target.value)} placeholder="e.g. upgrade, breakfast" />
          </div>
          <div>
            <label className="field-label">Benefit type</label>
            <select className="input" value={form.benefitType} onChange={(e) => set('benefitType', e.target.value)}>
              <option value="">Not set</option>
              <option value="breakfast">Free breakfast</option>
              <option value="upgrade">Room/suite upgrade</option>
              <option value="lounge">Lounge access</option>
              <option value="late-checkout">Late checkout</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="field-label">What was it</label>
            <input className="input" value={form.benefitNote} onChange={(e) => set('benefitNote', e.target.value)} placeholder="Suite upgrade, breakfast…" />
          </div>
        </div>
        <div>
          <label className="field-label">Booked via (leave blank if direct)</label>
          <input className="input" value={form.bookingChannel} onChange={(e) => set('bookingChannel', e.target.value)} placeholder="e.g. Expedia" />
        </div>
        <div>
          <label className="field-label">Trip</label>
          {!manualTripOverride ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', padding: '11px 12px' }}>
              <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700 }}>
                {autoSuggestion.tripId ? autoSuggestion.suggestedTitle : `New trip: ${autoSuggestion.suggestedTitle}`}
                <span
                  style={{
                    marginLeft: 8, fontSize: 'var(--fs-micro)', fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-pill)',
                    background: autoSuggestion.tripType === 'work' ? 'var(--brand-soft)' : 'var(--green-soft)',
                    color: autoSuggestion.tripType === 'work' ? 'var(--brand)' : 'var(--green)',
                  }}
                >
                  {autoSuggestion.tripType}
                </span>
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 3 }}>{autoSuggestion.reason}</div>
              <button
                type="button"
                onClick={() => setManualTripOverride(true)}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer', padding: '6px 0 0' }}
              >
                Choose a different trip
              </button>
            </div>
          ) : (
            <>
              <select className="input" value={form.tripId} onChange={(e) => set('tripId', e.target.value)}>
                <option value="">No trip — standalone</option>
                {trips.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.start})</option>)}
              </select>
              {!presetTripId && !editing && (
                <button
                  type="button"
                  onClick={() => setManualTripOverride(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer', padding: '6px 0 0' }}
                >
                  Use automatic detection instead
                </button>
              )}
            </>
          )}
        </div>

        {extractNote && (
          <div style={{ background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 'var(--fs-small)', padding: '10px 14px', borderRadius: 'var(--r-control)', fontWeight: 600 }}>
            {extractNote}
          </div>
        )}
        {overlapWarning && (
          <div style={{ background: 'var(--amber-soft)', border: '1px solid rgba(156,95,8,.25)', borderRadius: 'var(--r-control)', padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--amber)', fontWeight: 600, marginBottom: 8 }}>
              These dates overlap with "{overlapWarning}", already logged on this trip. Save anyway?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setConfirmedOverlap(true);
                  setOverlapWarning(null);
                }}
                style={{ padding: '6px 12px', borderRadius: 'var(--r-xs)', border: 'none', background: 'var(--amber)', color: 'var(--on-dark)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
              >
                Save anyway
              </button>
              <button
                type="button"
                onClick={() => setOverlapWarning(null)}                style={{ padding: '6px 12px', borderRadius: 'var(--r-xs)', border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
              >
                Let me fix it
              </button>
            </div>
          </div>
        )}
        {dupWarning && (
          <div style={{ background: 'var(--amber-soft)', border: '1px solid rgba(156,95,8,.25)', borderRadius: 'var(--r-control)', padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--amber)', fontWeight: 600, marginBottom: 8 }}>
              This looks like it might already be logged as "{dupWarning}": same brand, similar date. Save anyway?
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
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save stay'}
        </Button>

        {editing && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="btn ghost" style={{ color: 'var(--red)', fontSize: 'var(--fs-body)', fontWeight: 600, padding: '6px 0', justifyContent: 'flex-start' }}
          >
            Delete this stay
          </button>
        )}
        {editing && confirmingDelete && (
          <div style={{ background: 'var(--red-soft)', border: '1px solid rgba(210,60,60,.25)', borderRadius: 'var(--r-control)', padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--red)', fontWeight: 600, marginBottom: 8 }}>
              Delete "{editing.name}" permanently? This can't be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteHotel(editing.id);
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
