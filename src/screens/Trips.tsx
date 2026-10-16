import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllFlights, useAllHotels, useTrips } from '../lib/useLiveData';
import { deleteTrip } from '../lib/queries';
import { SwipeToDelete } from '../components/SwipeToDelete';
import type { Trip } from '../types';
import { destinationQuery, relevantHotel } from '../lib/tripHotels';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { formatShortRange } from '../lib/format';
import { buildTripTimeline, countdownLabel, pastTripsByYear } from '../lib/tripTimeline';
import { tripDayInfo } from '../lib/tripDay';
import { tripNights } from '../lib/today';
import { visitedInYear } from '../lib/logbook';
import { useGlobalAirports } from '../lib/useGlobalAirports';
import { useTripFlightGaps } from '../lib/useTripFlightGaps';
import { ChevronRightIcon, GlobeIcon, PlaneIcon } from '../components/Icons';
import { ErrorText, SectionLabel } from '../components/ui';

function TripPhoto({ trip, height }: { trip: Trip; height: number }) {
  return trip.heroImageUrl
    ? <img src={trip.heroImageUrl} alt="" style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
    : <DestinationPhoto query={destinationQuery(trip)} seed={trip.id} height={height} />;
}

// The end of what's planned: an open invitation to the next trip, with the
// two ways to start one right there.
function NextTrip({ onAdd, onPlan }: { onAdd: () => void; onPlan: () => void }) {
  return (
    <div className="tl-next">
      <svg className="tl-next-route" viewBox="0 0 120 40" aria-hidden="true">
        <path d="M4 34 C 34 2, 78 2, 108 22" fill="none" stroke="var(--brand2)" strokeWidth="1.6" strokeDasharray="4 4" strokeLinecap="round" />
        <circle cx="4" cy="34" r="3" fill="var(--ink)" />
      </svg>
      <span className="tl-next-plane" aria-hidden="true"><PlaneIcon size={18} color="var(--brand2)" /></span>
      <span className="tl-next-title">Where next?</span>
      <span className="tl-next-actions">
        <button className="tagbtn on" onClick={onAdd}>Add a trip</button>
        <button className="tagbtn" onClick={onPlan}>Plan one</button>
      </span>
    </div>
  );
}

// Trips: the one under way, what's coming, where next, and everything
// behind you by year (this year open as polaroids, earlier years folded).
// The scratch map is a tap away.
export function Trips() {
  const navigate = useNavigate();
  const { data: trips, refetch } = useTrips();
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const airports = useGlobalAirports();
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const timeline = useMemo(() => buildTripTimeline(trips, today), [trips, today]);
  const underway = [...timeline.earlier, ...timeline.recent].filter((t) => t.end >= today);
  const [lead, ...later] = timeline.upcoming;
  const past = useMemo(() => pastTripsByYear(trips, today), [trips, today]);
  const flightGaps = useTripFlightGaps(trips, today);
  const [openYears, setOpenYears] = useState<Set<string>>(new Set());
  const countryOf = (iata: string) => airports?.get(iata)?.country ?? null;

  // Swipe a trip left and tap Delete: its stays and flights go with it.
  async function removeTrip(id: string) {
    setError('');
    try { await deleteTrip(id); refetch(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete the trip.'); }
  }

  const row = (t: Trip, sub: string, extra?: React.ReactNode) => (
    <SwipeToDelete key={t.id} itemLabel={t.title} surface="var(--card)" wrapperStyle={{ borderRadius: 0 }} onClick={() => navigate(`/trips/${t.id}`)} onDelete={() => removeTrip(t.id)}>
      <div className="triprow">
        <span className="triprow-thumb"><TripPhoto trip={t} height={56} /></span>
        <span className="triprow-main">
          <span className="rowtitle display">{t.title}</span>
          <span className="rowsub">{sub}</span>
          {extra}
        </span>
        <ChevronRightIcon size={18} color="var(--ink3)" />
      </div>
    </SwipeToDelete>
  );

  return (
    <div>
      <div className="topspace" />
      <div className="homehead">
        <h1 className="h1" style={{ margin: 0 }}>Trips</h1>
        <button className="iconbtn" aria-label="Map" onClick={() => navigate('/map')}><GlobeIcon size={20} /></button>
      </div>
      {error && <ErrorText style={{ padding: '0 20px 10px' }}>{error}</ErrorText>}

      <div className="page-body">
        {underway.length > 0 && (
          <section>
            <SectionLabel>Now</SectionLabel>
            <div className="listcard">
              {underway.map((t) => {
                const d = tripDayInfo(t, today);
                return row(t, `${formatShortRange(t.start, t.end, today)} · Day ${d.dayIndex} of ${d.totalDays}`,
                  <span className="bar ink" aria-hidden="true"><i style={{ width: `${(d.dayIndex / d.totalDays) * 100}%` }} /></span>);
              })}
            </div>
          </section>
        )}

        {lead && (
          <section>
            <SectionLabel>Coming up</SectionLabel>
            <SwipeToDelete itemLabel={lead.title} surface="var(--bg)" wrapperStyle={{ borderRadius: 'var(--r-md)' }} onClick={() => navigate(`/trips/${lead.id}`)} onDelete={() => removeTrip(lead.id)}>
              <div className="tl-card">
                <TripPhoto trip={lead} height={190} />
                <div className="tl-card-scrim" />
                <span className="tl-card-chips">
                  <span className="tag light">{countdownLabel(today, lead.start)}</span>
                  {flightGaps.has(lead.id) && <span className="tag light">{flightGaps.get(lead.id)}</span>}
                </span>
                <span className="tl-card-name">{lead.title}</span>
                <span className="tl-card-meta">{formatShortRange(lead.start, lead.end, today)}{(() => { const n = tripNights(lead); return n > 0 ? ` · ${n} night${n === 1 ? '' : 's'}` : ''; })()}{relevantHotel(lead) ? ` · ${relevantHotel(lead)!.name}` : ''}</span>
              </div>
            </SwipeToDelete>
            {later.length > 0 && (
              <div className="listcard" style={{ marginTop: 10 }}>
                {later.map((t) => {
                  const n = tripNights(t);
                  return row(t, `${formatShortRange(t.start, t.end, today)}${n > 0 ? ` · ${n} night${n === 1 ? '' : 's'}` : ''}`,
                    flightGaps.has(t.id) ? <span className="tag warn">{flightGaps.get(t.id)}</span> : null);
                })}
              </div>
            )}
          </section>
        )}

        <NextTrip onAdd={() => navigate('/log-trip')} onPlan={() => navigate('/plan')} />

        {past.map((g, gi) => {
          const open = gi === 0 || openYears.has(g.year);
          const countries = visitedInYear(g.year, hotels, flights, countryOf).size;
          const summary = [countries > 0 ? `${countries} ${countries === 1 ? 'country' : 'countries'}` : null, `${g.trips.length} trip${g.trips.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
          if (!open) {
            return (
              <button key={g.year} className="yearrow" aria-expanded={false} onClick={() => setOpenYears((s) => new Set(s).add(g.year))}>
                <span className="figure">{g.year}</span>
                <span className="rowsub">{summary}</span>
                <ChevronRightIcon size={18} color="var(--ink3)" />
              </button>
            );
          }
          return (
            <section key={g.year}>
              <div className="sectionhead">
                <SectionLabel>{g.year}</SectionLabel>
                <span className="sectionmeta">{summary}</span>
              </div>
              <div className="scrap-grid three">
                {g.trips.map((t, i) => (
                  <button key={t.id} className="polaroid" style={{ rotate: `${[-1.6, 1.2, -0.6, 1.8][i % 4]}deg` }} onClick={() => navigate(`/trips/${t.id}`)}>
                    <span className="polaroid-photo">
                      {t.heroImageUrl ? <img src={t.heroImageUrl} alt="" /> : <DestinationPhoto query={destinationQuery(t)} seed={t.id} height={96} />}
                    </span>
                    <span className="polaroid-title">{t.title}</span>
                    <span className="polaroid-date">{formatShortRange(t.start, t.end, today)}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
