import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useFinish } from '../lib/useFinish';
import { addTrip, updateTrip, deleteTrip } from '../lib/queries';
import { withOfflineFallback } from '../lib/offlineQueue';
import type { Trip } from '../types';
import { Button, Confirm, ErrorText, ScreenHeader, Segmented } from '../components/ui';


export function LogTrip() {
  const location = useLocation();
  const finish = useFinish();
  const editing = (location.state as { trip?: Trip } | null)?.trip;
  // Started from the Trips screen's Work tab: default to a work trip.
  const presetType = (location.state as { tripType?: 'work' | 'leisure' } | null)?.tripType;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    title: editing?.title ?? '',
    start: editing?.start ?? '',
    end: editing?.end ?? '',
    tripType: (editing?.tripType ?? presetType ?? 'leisure') as 'work' | 'leisure',
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
        finish.done(`/trips/${editing.id}`);
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
        // The new trip's page takes the form's place.
        finish.done(`/trips/${id}`);
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
        <label className="field">
          <span className="field-label">Trip name *</span>
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Japan 2027" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <label className="field">
            <span className="field-label">Start *</span>
            <input
              className="input" type="date" value={form.start}
              // An end date before the new start is cleared rather than kept invalid.
              onChange={(e) => setForm((f) => ({ ...f, start: e.target.value, end: f.end && f.end < e.target.value ? '' : f.end }))}
            />
          </label>
          <label className="field">
            <span className="field-label">End *</span>
            <input className="input" type="date" min={form.start || undefined} value={form.end} onChange={(e) => set('end', e.target.value)} />
          </label>
        </div>

        <Segmented
          variant="pills" tone="brand"
          options={[{ value: 'leisure', label: 'Leisure' }, { value: 'work', label: 'Work' }]}
          value={form.tripType} onChange={(v) => set('tripType', v)}
        />
        <label className="field">
          <span className="field-label">Notes</span>
          <textarea
            className="input" style={{ resize: 'vertical', fontFamily: 'inherit' }}
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional"
          />
        </label>

        {error && <ErrorText>{error}</ErrorText>}

        <Button type="submit" block disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create trip'}
        </Button>

        {editing && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="removecard" style={{ justifySelf: 'start', padding: '10px 0' }}
          >
            Delete this trip
          </button>
        )}
        {editing && confirmingDelete && (
          <Confirm
            danger busy={deleting} confirmLabel={deleting ? 'Deleting…' : 'Delete trip'}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={async () => {
              setDeleting(true);
              try {
                await deleteTrip(editing.id);
                // Back past the trip's own page too: it no longer exists.
                finish.gone('/trips', 2);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete the trip.');
                setDeleting(false);
              }
            }}
          >
            Delete {editing.title}{editing.hotels.length + editing.flights.length > 0 ? ` with its ${[editing.hotels.length ? `${editing.hotels.length} stay${editing.hotels.length === 1 ? '' : 's'}` : null, editing.flights.length ? `${editing.flights.length} flight${editing.flights.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' and ')}` : ''}?
          </Confirm>
        )}
      </form>
    </div>
  );
}
