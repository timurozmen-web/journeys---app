import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../lib/useLiveData';
import { TripCard, PastTripCard, destinationQuery } from '../components/TripCard';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { tripDayInfo } from '../lib/tripDay';
import { formatDateRange } from '../lib/format';

export function Trips() {
  const navigate = useNavigate();
  const { data: allTrips } = useTrips();
  const [tripType, setTripType] = useState<'work' | 'leisure'>('leisure');
  const [pastExpanded, setPastExpanded] = useState(false);
  const trips = allTrips.filter((t) => t.tripType === tripType);

  const current = trips.filter((t) => t.section === 'current').sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = trips.filter((t) => t.section === 'upcoming').sort((a, b) => a.start.localeCompare(b.start));
  const past = trips.filter((t) => t.section === 'past').sort((a, b) => b.start.localeCompare(a.start));


  return (
    <div>
      <div style={{ background: 'var(--bg)', height: 'env(safe-area-inset-top, 0px)' }} />
      <div className="head" style={{ paddingBottom: 14 }}>
        <div className="h1">Trips</div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 20px' }}>
        <button
          onClick={() => setTripType('leisure')}
          style={{ flex: 1, padding: '10px 0', borderRadius: 99, border: tripType === 'leisure' ? 'none' : '1px solid var(--line)', cursor: 'pointer', background: tripType === 'leisure' ? 'var(--brand)' : 'var(--card)', color: tripType === 'leisure' ? '#fff' : 'var(--ink2)', fontSize: 13.5, fontWeight: 800 }}
        >
          Leisure
        </button>
        <button
          onClick={() => setTripType('work')}
          style={{ flex: 1, padding: '10px 0', borderRadius: 99, border: tripType === 'work' ? 'none' : '1px solid var(--line)', cursor: 'pointer', background: tripType === 'work' ? 'var(--brand)' : 'var(--card)', color: tripType === 'work' ? '#fff' : 'var(--ink2)', fontSize: 13.5, fontWeight: 800 }}
        >
          Work
        </button>
      </div>

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
            <button
              onClick={() => navigate(`/trips/${t.id}`)}
              style={{
                position: 'relative', display: 'block', width: '100%', height: 340, border: 0, padding: 0, borderRadius: 24,
                overflow: 'hidden', cursor: 'pointer', textAlign: 'left', font: 'inherit', background: '#15161B',
                boxShadow: '0 14px 32px rgba(21,22,27,.28)',
              }}
            >
              <span style={{ position: 'absolute', inset: 0 }}>
                <DestinationPhoto query={destinationQuery(t)} seed={t.id} height={340} />
              </span>
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(21,22,27,.5) 0%,rgba(21,22,27,.05) 30%,rgba(21,22,27,.05) 55%,rgba(21,22,27,.7) 82%,rgba(21,22,27,.94) 100%)' }} />
              <span style={{ position: 'absolute', top: 18, left: 20, fontSize: 10.5, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.1em', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 99, padding: '5px 11px', backdropFilter: 'blur(6px)' }}>
                {isUnderway ? `Under way · Day ${daysDone} of ${totalNights}` : `Upcoming · ${daysOut} day${daysOut === 1 ? '' : 's'} to go`}
              </span>
              <span style={{ position: 'absolute', left: 20, right: 20, bottom: 24, color: '#fff' }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, letterSpacing: '-.3px', lineHeight: 1.05 }}>{t.title}</span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, opacity: 0.9, marginTop: 6 }}>{formatDateRange(t.start, t.end)}</span>
              </span>
            </button>
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
              style={{ border: 0, background: 'none', font: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--brand)', cursor: 'pointer', padding: 0 }}
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
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
              {past.map((t) => (
                <PastTripCard key={t.id} trip={t} />
              ))}
            </div>
          )}
        </>
      )}
      {trips.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13.5 }}>
          No {tripType} trips yet.
        </div>
      )}
    </div>
  );
}
