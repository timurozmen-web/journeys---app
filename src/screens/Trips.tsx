import { useState } from 'react';
import { useTrips } from '../lib/useLiveData';
import { TripCard } from '../components/TripCard';

export function Trips() {
  const { data: allTrips, isLive } = useTrips();
  const [tripType, setTripType] = useState<'work' | 'leisure'>('leisure');
  const trips = allTrips.filter((t) => t.tripType === tripType);

  const current = trips.filter((t) => t.section === 'current');
  const upcoming = trips.filter((t) => t.section === 'upcoming');
  const past = trips.filter((t) => t.section === 'past').sort((a, b) => b.start.localeCompare(a.start));

  return (
    <div>
      <div className="head">
        <div className="h1">Trips</div>
        <div className="h-sub">
          {trips.length} trips {!isLive && '(sample data)'}
        </div>
      </div>

      <div style={{ padding: '4px 20px 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
          You're travelling for…
        </div>
        <div
          onClick={() => setTripType((v) => (v === 'work' ? 'leisure' : 'work'))}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: tripType === 'leisure' ? 'var(--ink)' : 'var(--ink3)', flex: 1 }}>
            Leisure
          </span>
          <span
            style={{
              width: 46, height: 26, borderRadius: 99, position: 'relative', flexShrink: 0,
              background: tripType === 'work' ? 'var(--brand)' : 'var(--line)',
              transition: 'background .18s ease',
            }}
          >
            <span
              style={{
                position: 'absolute', top: 3, left: tripType === 'work' ? 23 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .18s ease',
              }}
            />
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: tripType === 'work' ? 'var(--ink)' : 'var(--ink3)', flex: 1, textAlign: 'right' }}>
            Work
          </span>
        </div>
      </div>

      {current.length > 0 && (
        <div className="stack">
          {current.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <>
          <div className="sect">
            <h2>Upcoming</h2>
          </div>
          <div className="stack">
            {upcoming.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        </>
      )}
      {past.length > 0 && (
        <>
          <div className="sect">
            <h2>Past</h2>
          </div>
          <div className="stack">
            {past.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
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
