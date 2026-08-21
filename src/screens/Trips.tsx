import { useState } from 'react';
import { useTrips } from '../lib/useLiveData';
import { TripCard } from '../components/TripCard';

export function Trips() {
  const { data: allTrips, isLive } = useTrips();
  const [tripType, setTripType] = useState<'work' | 'leisure'>('leisure');
  const trips = allTrips.filter((t) => t.tripType === tripType);

  const current = trips.filter((t) => t.section === 'current').sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = trips.filter((t) => t.section === 'upcoming').sort((a, b) => a.start.localeCompare(b.start));
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
          style={{
            display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)',
          }}
        >
          <button
            onClick={() => setTripType('leisure')}
            style={{
              flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
              background: tripType === 'leisure' ? 'var(--brand)' : 'var(--card)',
              color: tripType === 'leisure' ? '#fff' : 'var(--ink3)',
              fontSize: 14, fontWeight: tripType === 'leisure' ? 800 : 600,
              transition: 'background .15s ease, color .15s ease',
            }}
          >
            Leisure
          </button>
          <button
            onClick={() => setTripType('work')}
            style={{
              flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
              background: tripType === 'work' ? 'var(--brand)' : 'var(--card)',
              color: tripType === 'work' ? '#fff' : 'var(--ink3)',
              fontSize: 14, fontWeight: tripType === 'work' ? 800 : 600,
              transition: 'background .15s ease, color .15s ease',
            }}
          >
            Work
          </button>
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
