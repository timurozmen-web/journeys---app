import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../lib/useLiveData';
import { deleteTrip } from '../lib/queries';
import { SwipeToDelete } from '../components/SwipeToDelete';
import type { Trip } from '../types';
import { destinationQuery, relevantHotel } from '../lib/tripHotels';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { formatShortRange } from '../lib/format';
import { isTripIncomplete } from '../lib/tripCompleteness';
import { useFlightExemptTripIds } from '../lib/homeLocation';
import {
  buildTripTimeline, countdownLabel, emptyMonthsBetween, monthKey, monthLabel, spanLabel, tonightStay,
} from '../lib/tripTimeline';
import { PlusIcon } from '../components/Icons';
import { EmptyState, ErrorText } from '../components/ui';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function todayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `Today · ${DAY_NAMES[dow]} ${d} ${MONTH_NAMES[m - 1]}`;
}

// "Aug", or "Jan" over "2027" when it isn't this year.
function MonthLabel({ month, today, quiet }: { month: string; today: string; quiet?: boolean }) {
  const [name, year] = monthLabel(month, today).split(' ');
  return <span className={quiet ? 'tl-month quiet' : 'tl-month'}>{name}{year && <small>{year}</small>}</span>;
}

function TripPhoto({ trip, height }: { trip: Trip; height: number }) {
  return trip.heroImageUrl
    ? <img src={trip.heroImageUrl} alt="" style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
    : <DestinationPhoto query={destinationQuery(trip)} seed={trip.id} height={height} />;
}

export function Trips() {
  const navigate = useNavigate();
  const { data: trips, refetch } = useTrips();
  const [error, setError] = useState('');
  const [showEarlier, setShowEarlier] = useState(false);
  const flightExemptTripIds = useFlightExemptTripIds(trips);
  const today = new Date().toISOString().slice(0, 10);
  const timeline = useMemo(() => buildTripTimeline(trips, today), [trips, today]);
  const tonight = useMemo(() => tonightStay(trips, today), [trips, today]);

  // Swipe a trip left and tap Delete: its stays and flights go with it.
  async function removeTrip(id: string) {
    setError('');
    try { await deleteTrip(id); refetch(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete the trip.'); }
  }

  // The timeline opens at today, with a little of the recent past above.
  const todayRef = useRef<HTMLDivElement>(null);
  const anchored = useRef(false);
  useLayoutEffect(() => {
    if (anchored.current || !todayRef.current || trips.length === 0) return;
    anchored.current = true;
    const y = todayRef.current.getBoundingClientRect().top + window.scrollY - 200;
    if (y > 0) window.scrollTo(0, y);
  }, [trips.length]);

  // Scrolling back up to the top unfolds the older trips, keeping your
  // place, so the history carries on rather than ending at a button.
  function unfoldEarlier() {
    const before = document.documentElement.scrollHeight;
    flushSync(() => setShowEarlier(true));
    window.scrollBy(0, document.documentElement.scrollHeight - before);
  }
  const earlierRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = earlierRef.current;
    if (showEarlier || !el) return;
    // Only on a scroll upward that brings the row into view, so opening
    // the screen (which lands on today) never unfolds it by itself.
    let lastY = window.scrollY;
    const onScroll = () => {
      const up = window.scrollY < lastY;
      lastY = window.scrollY;
      const r = el.getBoundingClientRect();
      if (up && r.bottom > 0 && r.top < window.innerHeight) unfoldEarlier();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showEarlier, timeline.earlier.length]);

  const above = showEarlier ? [...timeline.earlier, ...timeline.recent] : timeline.recent;
  let lastMonth = '';
  const monthCell = (date: string) => {
    const m = monthKey(date);
    if (m === lastMonth) return <span />;
    lastMonth = m;
    return <MonthLabel month={m} today={today} />;
  };

  return (
    <div>
      <div style={{ background: 'var(--bg)', height: 'env(safe-area-inset-top, 0px)' }} />
      <div style={{ padding: '20px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="h1" style={{ margin: 0 }}>Trips</h1>
        <button className="lb-iconbtn" aria-label="New trip" onClick={() => navigate('/log-trip')}><PlusIcon size={20} /></button>
      </div>
      {error && <ErrorText style={{ padding: '0 20px 10px' }}>{error}</ErrorText>}
      {trips.length === 0 && <EmptyState>No trips yet.</EmptyState>}

      {trips.length > 0 && (
        <div className="tl">
          {!showEarlier && timeline.earlier.length > 0 && (
            <div className="tl-row">
              <span />
              <span />
              <button ref={earlierRef} className="tl-earlier" onClick={unfoldEarlier}>
                <span className="tl-stack" aria-hidden="true">
                  {timeline.earlier.slice(-3).map((t) => <span key={t.id} className="tl-thumb"><TripPhoto trip={t} height={36} /></span>)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="tl-title">{spanLabel(timeline.earlier)}</span>
                  <span className="tl-sub">{timeline.earlier.length} trip{timeline.earlier.length === 1 ? '' : 's'}</span>
                </span>
                <span className="tl-up" aria-hidden="true">↑</span>
              </button>
            </div>
          )}

          {above.map((t) => {
            const underway = t.end >= today;
            return (
              <div className="tl-row" key={t.id}>
                {monthCell(t.start)}
                <span className={underway ? 'tl-dot solid' : 'tl-dot'} />
                <SwipeToDelete itemLabel={t.title} surface="var(--bg)" wrapperStyle={{ borderRadius: 'var(--r-sm)' }} onClick={() => navigate(`/trips/${t.id}`)} onDelete={() => removeTrip(t.id)}>
                  <div className={underway ? 'tl-past now' : 'tl-past'}>
                    <span className="tl-thumb"><TripPhoto trip={t} height={44} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="tl-title">{t.title}</span>
                      <span className="tl-sub">{formatShortRange(t.start, t.end, today)} · {t.tripType}</span>
                    </span>
                    {underway && <span className="tl-chip">Ends {t.end === today ? 'today' : countdownLabel(today, t.end).toLowerCase()}</span>}
                  </div>
                </SwipeToDelete>
              </div>
            );
          })}

          <div className="tl-row tl-today" ref={todayRef}>
            <span />
            <span className="tl-today-dot" />
            <span className="tl-today-label">{todayLabel(today)}</span>
          </div>
          {tonight && (
            <div className="tl-row">
              <span />
              <span />
              <button className="tl-tonight" onClick={() => navigate(`/trips/${tonight.trip.id}`)}>
                <span className="k">Tonight</span>
                <span className="n">{tonight.hotel.name}</span>
                <span className="s">{tonight.hotel.brand && tonight.hotel.brand !== 'Independent' ? `${tonight.hotel.brand} · ` : ''}{tonight.hotel.nights} night{tonight.hotel.nights === 1 ? '' : 's'}</span>
              </button>
            </div>
          )}

          {timeline.upcoming.map((t, i) => {
            const prevDate = i === 0 ? today : timeline.upcoming[i - 1].start;
            const gaps = emptyMonthsBetween(prevDate, t.start, trips);
            const hotel = relevantHotel(t);
            const incomplete = isTripIncomplete(t) && !flightExemptTripIds.has(t.id);
            return (
              <div key={t.id} style={{ display: 'contents' }}>
                {gaps.map((m) => (
                  <div className="tl-row" key={m}>
                    <MonthLabel month={m} today={today} quiet />
                    <span />
                    <span />
                  </div>
                ))}
                <div className="tl-row top">
                  {monthCell(t.start)}
                  <span className="tl-dot solid" />
                  <SwipeToDelete itemLabel={t.title} surface="var(--bg)" wrapperStyle={{ borderRadius: 'var(--r-md)' }} onClick={() => navigate(`/trips/${t.id}`)} onDelete={() => removeTrip(t.id)}>
                    <div className="tl-card">
                      <TripPhoto trip={t} height={176} />
                      <div className="tl-card-scrim" />
                      <span className="tl-card-chips">
                        <span className={i === 0 ? 'chip' : 'chip light'}>{countdownLabel(today, t.start)}</span>
                        {incomplete && <span className="chip light">Incomplete</span>}
                      </span>
                      <span className="tl-card-name">{t.title}</span>
                      <span className="tl-card-meta">{formatShortRange(t.start, t.end, today)}{hotel ? ` · ${hotel.name}` : ''}</span>
                    </div>
                  </SwipeToDelete>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
