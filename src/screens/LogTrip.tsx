import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addTrip, updateTrip, deleteTrip } from '../lib/queries';
import { withOfflineFallback } from '../lib/offlineQueue';
import type { Trip } from '../types';
import { Button, ErrorText, ScreenHeader } from '../components/ui';


export function LogTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const editing = (location.state as { trip?: Trip } | null)?.trip;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
        await withOfflineFallback('updateTrip', form.title, updateTrip, editing.id, form);
        navigate(`/trips/${editing.id}`);
      } else {
        // Same pre-generated-id pattern as the hotel/flight queue: the
        // id is created client-side so navigation can go straight to
        // the trip page immediately, whether or not the actual write
        // has to queue for later.
        const id = crypto.randomUUID();
        await withOfflineFallback(
          'addTrip', form.title,
          async (input: typeof form, tripId: string) => { await addTrip(input, tripId); },
          form, id
        );
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
      <ScreenHeader title={editing ? 'Edit trip' : 'New trip'} />

      <form onSubmit={handleSubmit} style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <div>
          <label className="field-label">Trip name *</label>
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Japan 2027" />
        </div>
        <div>
          <label className="field-label">Start date *</label>
          <input className="input" type="date" value={form.start} onChange={(e) => set('start', e.target.value)} />
        </div>
        <div>
          <label className="field-label">End date *</label>
          <input className="input" type="date" value={form.end} onChange={(e) => set('end', e.target.value)} />
        </div>

        <div>
          <label className="field-label">You're travelling for…</label>
          <div
            onClick={() => set('tripType', form.tripType === 'work' ? 'leisure' : 'work')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '10px 14px',
            }}
          >
            <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: form.tripType === 'leisure' ? 'var(--ink)' : 'var(--ink3)', flex: 1 }}>
              Leisure
            </span>
            <span
              style={{
                width: 46, height: 26, borderRadius: 'var(--r-pill)', position: 'relative', flexShrink: 0,
                background: form.tripType === 'work' ? 'var(--brand)' : 'var(--line)',
                transition: 'background .18s ease',
              }}
            >
              <span
                style={{
                  position: 'absolute', top: 3, left: form.tripType === 'work' ? 23 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: 'var(--card)',
                  boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .18s ease',
                }}
              />
            </span>
            <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: form.tripType === 'work' ? 'var(--ink)' : 'var(--ink3)', flex: 1, textAlign: 'right' }}>
              Work
            </span>
          </div>
        </div>

        <div>
          <label className="field-label">Notes</label>
          <textarea
            className="input" style={{ resize: 'vertical', fontFamily: 'inherit' }}
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional"
          />
        </div>

        {error && <ErrorText>{error}</ErrorText>}

        <Button type="submit" block disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create trip'}
        </Button>

        {editing && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="btn ghost" style={{ color: 'var(--red)', fontSize: 'var(--fs-body)', fontWeight: 600, padding: '6px 0', justifyContent: 'flex-start' }}
          >
            Delete this trip
          </button>
        )}
        {editing && confirmingDelete && (
          <div style={{ background: 'var(--red-soft)', border: '1px solid rgba(240,138,126,.3)', borderRadius: 'var(--r-control)', padding: '12px 14px' }}>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--red)', fontWeight: 600, marginBottom: 8 }}>
              Delete "{editing.title}" permanently? This also removes {editing.hotels.length} stay{editing.hotels.length === 1 ? '' : 's'} and {editing.flights.length} flight{editing.flights.length === 1 ? '' : 's'} logged under it. This can't be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteTrip(editing.id);
                    navigate('/trips');
                  } catch (err) {
                    const message =
                      err instanceof Error
                        ? err.message
                        : typeof err === 'object' && err !== null && 'message' in err
                        ? String((err as { message: unknown }).message)
                        : 'Failed to delete.';
                    setError(message);
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
    </div>
  );
}
