import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../lib/useLiveData';
import { TripCard, PastTripCard } from '../components/TripCard';
import { destinationQuery } from '../lib/tripHotels';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { tripDayInfo } from '../lib/tripDay';
import { formatDateRange } from '../lib/format';
import { isTripIncomplete } from '../lib/tripCompleteness';
import { useFlightExemptTripIds } from '../lib/homeLocation';
import { AlertIcon } from '../components/Icons';
import { Eyebrow, PhotoHero, Segmented } from '../components/ui';

export function Trips() {
  const navigate = useNavigate();
  const { data: allTrips } = useTrips();
  const flightExemptTripIds = useFlightExemptTripIds(allTrips);
  const [tripType, setTripType] = useState<'work' | 'leisure'>('leisure');
  const [pastExpanded, setPastExpanded] = useState(false);
  const trips = allTrips.filter((t) => t.tripType === tripType);

  const current = trips.filter((t) => t.section === 'current').sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = trips.filter((t) => t.section === 'upcoming').sort((a, b) => a.start.localeCompare(b.start));
  const past = trips.filter((t) => t.section === 'past').sort((a, b) => b.start.localeCompare(a.start));


  return (
    <div>
      <div style={{ background: 'var(--bg)', height: 'env(safe-area-inset-top, 0px)' }} />
      <div style={{ padding: '20px 20px 14px' }}>
        <div className="h1">Trips</div>
      </div>
      <Segmented
        variant="pills" tone="brand" style={{ gap: 8, padding: '0 20px' }}
        options={[{ value: 'leisure', label: 'Leisure' }, { value: 'work', label: 'Work' }]}
        value={tripType} onChange={setTripType}
      />

      {(() => {
        const heroTrip = current[0] ?? upcoming[0];
        if (!heroTrip) return null;
        const isUnderway = heroTrip.section === 'current';
        const t = heroTrip;
        const TODAY = new Date().toISOString().slice(0, 10);
        const { dayIndex: daysDone, totalDays: totalNights } = tripDayInfo(t, TODAY);
        const daysOut = Math.max(0, Math.round((new Date(t.start).getTime() - Date.now()) / 86400000));
        return (
          <div style={{ padding: '18px 20px 0' }}>
            <PhotoHero
              rounded scrim="full" height={340}
              fallback={<DestinationPhoto query={destinationQuery(t)} seed={t.id} height={340} />}
              onClick={() => navigate(`/trips/${t.id}`)}
            >
              <span className="ph-top" style={{ top: 18, display: 'flex', gap: 8 }}>
                <Eyebrow>
                  {isUnderway ? `Under way · Day ${daysDone} of ${totalNights}` : `Upcoming · ${daysOut} day${daysOut === 1 ? '' : 's'} to go`}
                </Eyebrow>
                {isTripIncomplete(t) && !flightExemptTripIds.has(t.id) && (
                  <Eyebrow tone="alert"><AlertIcon size={12} color="var(--on-dark)" /> Trip incomplete</Eyebrow>
                )}
              </span>
              <span className="ph-bottom">
                <span className="ph-title" style={{ fontSize: 'var(--fs-display)' }}>{t.title}</span>
                <span className="ph-sub">{formatDateRange(t.start, t.end)}</span>
              </span>
            </PhotoHero>
          </div>
        );
      })()}
      {upcoming.filter((t) => current.length > 0 || t.id !== upcoming[0]?.id).length > 0 && (
        <>
          <div className="sect">
            <h2>Upcoming</h2>
          </div>
          <div className="stack">
            {upcoming.filter((t) => current.length > 0 || t.id !== upcoming[0]?.id).map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        </>
      )}
      {past.length > 0 && (
        <>
          <div className="sect" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2>Past</h2>
            <button
              onClick={() => setPastExpanded((v) => !v)}
              style={{ border: 0, background: 'none', font: 'inherit', fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--brand)', cursor: 'pointer', padding: 0 }}
            >
              {pastExpanded ? 'Show less' : `View all (${past.length})`}
            </button>
          </div>
          {pastExpanded ? (
            <div className="stack">
              {past.map((t) => (
                <TripCard key={t.id} trip={t} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, padding: '0 20px 4px' }}>
              {past.slice(0, 3).map((t) => (
                <PastTripCard key={t.id} trip={t} />
              ))}
            </div>
          )}
        </>
      )}
      {trips.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink3)', fontSize: 'var(--fs-body)' }}>
          No {tripType} trips yet.
        </div>
      )}
    </div>
  );
}
