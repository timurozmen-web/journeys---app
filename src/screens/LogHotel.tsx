import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addHotel, updateHotel, deleteHotel, addTrip, updateTrip } from '../lib/queries';
import { withOfflineFallback } from '../lib/offlineQueue';
import { suggestTripAssignment } from '../lib/autoTrip';
import { matchProgrammeStrict, normalizeBrand } from '../data/brandMap';
import type { Hotel } from '../types';
import { useTrips, useAllHotels, useAllFlights, usePaymentCards } from '../lib/useLiveData';
import { needsPlaceFields, tripPlace } from '../lib/tripPlace';
import { loadWorldCities } from '../data/worldCitiesLoader';
import { findLikelyDuplicateHotel } from '../lib/duplicateDetection';
import { Button, Confirm, ErrorText, ScreenHeader } from '../components/ui';
import { MailIcon } from '../components/Icons';
import { useFinish } from '../lib/useFinish';
import { overlappingStay } from '../lib/stayOverlap';
import { addDays } from '../lib/tripDay';

const CATEGORIES = ['Luxury', 'Premium', 'Midscale', 'Budget'] as const;
const STATUSES = ['Completed', 'Booked', 'needs-confirm'] as const;
const RATE_TYPES = ['Standard', 'Member', 'Promotional', 'Non-refundable', 'Other'] as const;

export function LogHotel() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { hotel?: Hotel; tripId?: string; prefill?: Partial<Hotel>; extractNote?: string } | null;
  const finish = useFinish();
  const editing = state?.hotel;
  const presetTripId = state?.tripId;
  const prefill = state?.prefill;
  const extractNote = state?.extractNote as string | undefined;
  const src = editing ?? prefill; // either populates the form; only `editing` triggers update-mode
  const { data: trips } = useTrips();
  const { data: allHotels } = useAllHotels();
  const { data: allFlights } = useAllFlights();
  const { data: paymentCards } = usePaymentCards();
  const presetTrip = trips.find((t) => t.id === presetTripId);
  // A trip with no stays yet is placed by its title, from the city list.
  const [cities, setCities] = useState<{ name: string; country: string }[]>([]);
  useEffect(() => {
    if (presetTrip && presetTrip.hotels.length === 0) loadWorldCities().then((c) => setCities(c.map((x) => ({ name: x.name, country: x.country }))));
  }, [presetTrip]);
  // Active cards from the wallet; a card already on this stay stays choosable even if since closed.
  const cardOptions = [...new Set([...paymentCards.filter((c) => !c.closedDate).map((c) => c.id), ...(src?.card ? [src.card] : [])])];
  const place = presetTrip ? tripPlace(presetTrip, cities) : null;
  // Country and city are only asked for when the trip doesn't already say.
  const showPlace = needsPlaceFields(place);
  const knownHotels = Array.from(new Map(allHotels.map((h) => [h.name, h])).values());
  const [manualTripOverride, setManualTripOverride] = useState(!!presetTripId || !!editing);
  const [saving, setSaving] = useState(false);
  // Less-used fields stay folded away until asked for (open when editing).
  const [more, setMore] = useState(!!editing);
  const [error, setError] = useState('');
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [confirmedOverlapState, setConfirmedOverlap] = useState(false);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [confirmedDupState, setConfirmedDup] = useState(false);
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

  // What gets saved: the typed place, or the trip's when the fields are hidden.
  const effectiveCountry = showPlace ? form.country : form.country || place?.country || '';
  const effectiveCity = showPlace ? form.city : form.city || place?.city || '';

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setConfirmedOverlap(false);
    setOverlapWarning(null);
  }

  const autoSuggestion = suggestTripAssignment(form.date || TODAY, effectiveCity || null, effectiveCountry, trips, allFlights);

  function findOverlap(): string | null {
    const trip = form.tripId && form.date ? trips.find((t) => t.id === form.tripId) : null;
    return trip ? overlappingStay(trip.hotels, form.date, parseInt(form.nights, 10) || 1, editing?.id)?.name ?? null : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save({});
  }

  // "Save anyway" on a warning saves straight away, rather than leaving
  // the Save button to be pressed again.
  async function save(allow: { overlap?: boolean; dup?: boolean }) {
    const confirmedOverlap = allow.overlap || confirmedOverlapState;
    const confirmedDup = allow.dup || confirmedDupState;
    if (allow.overlap) setConfirmedOverlap(true);
    if (allow.dup) setConfirmedDup(true);
    if (!form.name || !effectiveCountry || !form.date) {
      setError(showPlace ? 'Name, country and date are required.' : 'Name and date are required.');
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
            const newEndStr = addDays(form.date, nights);
            if (newEndStr > existingTrip.end) {
              await withOfflineFallback('updateTrip', `Extend ${existingTrip.title}`, updateTrip, existingTrip.id, {
                title: existingTrip.title, start: existingTrip.start, end: newEndStr,
                tripType: existingTrip.tripType, notes: existingTrip.notes,
              });
            }
          }
        } else {
          const newTripInput = {
            title: autoSuggestion.suggestedTitle, start: form.date, end: addDays(form.date, nights),
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
        name: form.name, country: effectiveCountry, city: effectiveCity || null, brand: normalizeBrand(form.brand || 'Other'),
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
      finish.done(resolvedTripId ? `/trips/${resolvedTripId}` : '/trips');
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
        title={editing ? 'Edit stay' : 'New stay'} sub={presetTrip?.title}
        right={editing ? undefined : (
          <button type="button" className="iconbtn" aria-label="Import from an email or screenshot" onClick={() => navigate('/scan-email', { replace: true, state: { tripId: presetTripId, back: (location.state as { back?: boolean } | null)?.back } })}>
            <MailIcon size={20} />
          </button>
        )}
      />

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <label className="field">
          <span className="field-label">Hotel name *</span>
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
            onBlur={(e) => {
              // Fill the brand from the hotel's name when it's a known chain ("Courtyard ..." -> Marriott Bonvoy).
              const brand = !form.brand && matchProgrammeStrict(e.target.value);
              if (brand) set('brand', brand);
            }}
            placeholder="e.g. Marriott Marble Arch"
          />
          <datalist id="known-hotels">
            {knownHotels.map((h) => (
              <option key={h.id} value={h.name} />
            ))}
          </datalist>
        </label>
        {showPlace && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <label className="field">
            <span className="field-label">Country *</span>
            <input className="input" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="United Kingdom" />
          </label>
          <label className="field">
            <span className="field-label">City</span>
            <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="London" />
          </label>
        </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 10 }}>
          <label className="field">
            <span className="field-label">Check-in date *</span>
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
          </label>
          <label className="field">
            <span className="field-label">Nights</span>
            <input className="input" type="number" min="1" value={form.nights} onChange={(e) => set('nights', e.target.value)} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <label className="field">
            <span className="field-label">Total cost (£)</span>
            <input className="input" type="number" step="0.01" value={form.total} onChange={(e) => set('total', e.target.value)} placeholder="Optional" />
          </label>
          <label className="field">
            <span className="field-label">Card used</span>
            <select className="input" value={form.card} onChange={(e) => set('card', e.target.value)}>
              <option value="">None</option>
              {cardOptions.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-body)', color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.award} onChange={(e) => set('award', e.target.checked)} />
          Paid with points or a certificate
        </label>
        <button type="button" className="btn ghost small" style={{ justifySelf: 'start', padding: '4px 0' }} onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? 'Fewer details' : 'More details'}
        </button>
        {more && (
          <>
            <label className="field">
              <span className="field-label">Brand</span>
              <input
                className="input"
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                onBlur={(e) => e.target.value && set('brand', normalizeBrand(e.target.value))}
                placeholder="Marriott Bonvoy"
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
              <label className="field">
                <span className="field-label">Status</span>
                <select className="input" value={form.status} onChange={(e) => { setStatusTouched(true); set('status', e.target.value as (typeof STATUSES)[number]); }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Category</span>
                <select className="input" value={form.category} onChange={(e) => set('category', e.target.value as (typeof CATEGORIES)[number])}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="field-label">Room type</span>
              <input className="input" value={form.roomType} onChange={(e) => set('roomType', e.target.value)} placeholder="e.g. Deluxe King, City View" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
              <label className="field">
                <span className="field-label">Rate type</span>
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
              </label>
              <label className="field">
                <span className="field-label">Standard rate (£/night)</span>
                <input
                  className="input" style={{ opacity: form.rateType === 'Standard' ? 0.6 : 1 }}
                  type="number"
                  step="0.01"
                  value={form.rateType === 'Standard' && form.total ? (parseFloat(form.total) / (parseInt(form.nights, 10) || 1)).toFixed(2) : form.avgRate}
                  onChange={(e) => set('avgRate', e.target.value)}
                  disabled={form.rateType === 'Standard'}
                  placeholder="What it would've cost at standard rate"
                />
              </label>
            </div>
            {editing && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
              <label className="field">
                <span className="field-label">Benefit value (£)</span>
                <input className="input" type="number" step="0.01" value={form.benefitValue} onChange={(e) => set('benefitValue', e.target.value)} placeholder="e.g. upgrade, breakfast" />
              </label>
              <label className="field">
                <span className="field-label">Benefit type</span>
                <select className="input" value={form.benefitType} onChange={(e) => set('benefitType', e.target.value)}>
                  <option value="">Not set</option>
                  <option value="breakfast">Free breakfast</option>
                  <option value="upgrade">Room/suite upgrade</option>
                  <option value="lounge">Lounge access</option>
                  <option value="late-checkout">Late checkout</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">What was it</span>
                <input className="input" value={form.benefitNote} onChange={(e) => set('benefitNote', e.target.value)} placeholder="Suite upgrade, breakfast…" />
              </label>
            </div>
            )}
            <label className="field">
              <span className="field-label">Booked via (leave blank if direct)</span>
              <input className="input" value={form.bookingChannel} onChange={(e) => set('bookingChannel', e.target.value)} placeholder="e.g. Expedia" />
            </label>
          </>
        )}
        {!presetTripId && (
        <div>
          <div className="field-label">Trip</div>
          {!manualTripOverride ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)', padding: '11px 12px' }}>
              <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700 }}>
                {autoSuggestion.tripId ? autoSuggestion.suggestedTitle : `New trip: ${autoSuggestion.suggestedTitle}`}
                <span className="tag" style={{ marginLeft: 8, verticalAlign: 'middle' }}>{autoSuggestion.tripType}</span>
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
        )}

        {extractNote && <div className="formnote">{extractNote}</div>}
        {overlapWarning && (
          <Confirm confirmLabel="Save anyway" cancelLabel="Let me fix it" onConfirm={() => save({ overlap: true })} onCancel={() => setOverlapWarning(null)}>
            Overlaps {overlapWarning} on this trip.
          </Confirm>
        )}
        {dupWarning && (
          <Confirm confirmLabel="Save anyway" cancelLabel="Let me check" onConfirm={() => save({ overlap: true, dup: true })} onCancel={() => setDupWarning(null)}>
            Looks like {dupWarning}, already logged.
          </Confirm>
        )}
        {error && <ErrorText>{error}</ErrorText>}

        <Button type="submit" block disabled={saving} style={{ marginTop: 6 }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save stay'}
        </Button>

        {editing && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="removecard" style={{ justifySelf: 'start', padding: '10px 0' }}
          >
            Delete this stay
          </button>
        )}
        {editing && confirmingDelete && (
          <Confirm
            danger busy={deleting} confirmLabel={deleting ? 'Deleting…' : 'Delete stay'}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={async () => {
              setDeleting(true);
              try {
                await deleteHotel(editing.id);
                finish.gone(form.tripId ? `/trips/${form.tripId}` : '/trips');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete it.');
                setDeleting(false);
              }
            }}
          >
            Delete {editing.name}?
          </Confirm>
        )}
      </form>
      <div style={{ height: 30 }} />
    </div>
  );
}
