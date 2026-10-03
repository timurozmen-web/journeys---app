import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, EmptyState, ErrorText, ScreenHeader } from '../components/ui';
import { useTrips } from '../lib/useLiveData';
import { eventToText, parseIcs } from '../lib/ics';
import type { CalendarEvent } from '../lib/ics';
import { bookingRoute } from '../lib/bookingPrefill';
import type { ExtractedBooking } from '../lib/bookingPrefill';
import { addDays } from '../lib/tripDay';
import { formatDate, formatDateRange } from '../lib/format';

const MAX_SHOWN = 100;

// Import a booking from a calendar export (.ics from Apple or Google
// Calendar, or a confirmation's calendar attachment): pick the event, its
// details are read like a confirmation and open prefilled for review.
export function ImportCalendar() {
  const navigate = useNavigate();
  const tripId = (useLocation().state as { tripId?: string } | null)?.tripId;
  const { data: trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const file = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load(f: File | undefined) {
    if (!f) return;
    setError('');
    try {
      const parsed = parseIcs(await f.text());
      if (parsed.length === 0) setError('No events found in that file.');
      setEvents(parsed);
    } catch {
      setError('Could not read that file.');
    }
  }

  // With a trip, start with events around its dates.
  const visible = useMemo(() => {
    if (!events) return [];
    const q = query.trim().toLowerCase();
    const window = trip && !showAll ? { from: addDays(trip.start, -14), to: addDays(trip.end, 14) } : null;
    return events
      .filter((e) => !window || (e.start <= window.to && (e.end ?? e.start) >= window.from))
      .filter((e) => !q || `${e.summary} ${e.location}`.toLowerCase().includes(q))
      .slice(0, MAX_SHOWN);
  }, [events, query, trip, showAll]);

  async function pick(e: CalendarEvent) {
    setError('');
    setBusy(e.uid);
    try {
      const res = await fetch('/.netlify/functions/extract-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText: eventToText(e) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read that event');
      const found: ExtractedBooking[] = data.bookings ?? [];
      if (found.length === 0) {
        setError('That event doesn’t look like a booking. Pick another, or enter it manually.');
      } else if (found.length === 1) {
        const r = bookingRoute(found[0], { tripId, returnTo: { pathname: '/import-calendar', state: { tripId } } });
        navigate(r.to, { state: r.state });
      } else {
        navigate('/scan-email', { state: { tripId, resumeBookings: found, resumeSaved: [] } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ScreenHeader title="Import from calendar" />
      <div style={{ padding: '10px 20px', display: 'grid', gap: 12 }}>
        <input ref={file} type="file" accept=".ics,text/calendar" hidden onChange={(e) => load(e.target.files?.[0])} />
        <Button variant={events ? 'secondary' : 'primary'} onClick={() => file.current?.click()}>
          {events ? 'Choose a different file' : 'Choose a calendar file'}
        </Button>
        {error && <ErrorText>{error}</ErrorText>}
        {events && events.length > 0 && (
          <>
            <input className="input" placeholder="Search events" value={query} onChange={(e) => setQuery(e.target.value)} />
            {visible.length === 0 && <EmptyState>No matching events.</EmptyState>}
            {visible.map((e) => (
              <button
                key={e.uid} type="button" className="optionrow" disabled={busy !== null} onClick={() => pick(e)}
                style={{ opacity: busy && busy !== e.uid ? 0.5 : 1 }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--fs-body)' }}>{e.summary || 'Untitled event'}</span>
                  <span style={{ display: 'block', color: 'var(--ink3)', fontSize: 'var(--fs-caption)', marginTop: 2 }}>
                    {e.end && e.end !== e.start ? formatDateRange(e.start, e.end) : formatDate(e.start)}{e.location ? ` · ${e.location}` : ''}
                  </span>
                </span>
                {busy === e.uid && <span style={{ color: 'var(--brand)', fontSize: 'var(--fs-caption)', fontWeight: 700 }}>Reading…</span>}
              </button>
            ))}
            {trip && !showAll && <Button variant="ghost" small onClick={() => setShowAll(true)}>Show all events</Button>}
          </>
        )}
      </div>
    </div>
  );
}
