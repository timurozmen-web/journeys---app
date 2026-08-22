import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../lib/useLiveData';
import { TripCard } from '../components/TripCard';
import { findGaps } from '../lib/tripStats';

export function Trips() {
  const navigate = useNavigate();
  const { data: allTrips } = useTrips();
  const [tripType, setTripType] = useState<'work' | 'leisure'>('leisure');
  const trips = allTrips.filter((t) => t.tripType === tripType);

  const current = trips.filter((t) => t.section === 'current').sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = trips.filter((t) => t.section === 'upcoming').sort((a, b) => a.start.localeCompare(b.start));
  const past = trips.filter((t) => t.section === 'past').sort((a, b) => b.start.localeCompare(a.start));

  const yearNights = trips.reduce((s, t) => s + t.hotels.reduce((n, h) => n + h.nights, 0), 0);
  const yearSpend = trips.reduce((s, t) => s + t.hotels.reduce((n, h) => n + (h.total ?? 0), 0) + t.flights.reduce((n, f) => n + (f.cost ?? 0), 0), 0);
  const yearGaps = trips.reduce((s, t) => s + findGaps(t).length, 0);
  const continents = new Set(trips.flatMap((t) => t.hotels.map((h) => h.country))).size;

  return (
    <div>
      <div style={{ background: 'linear-gradient(165deg,#4A3189 0%,#5B3FA6 100%)', padding: '24px 20px 20px', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, color: '#fff' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>Your year</div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.6px', marginTop: 3 }}>{trips.length} trips, {continents} {continents === 1 ? 'country' : 'countries'}</div>
        <div style={{ display: 'flex', marginTop: 16, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,.18)', borderBottom: '1px solid rgba(255,255,255,.18)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.4px' }}>{yearNights}</div>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>nights</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.4px' }}>£{yearSpend.toLocaleString()}</div>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>spent</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.4px', color: yearGaps > 0 ? '#FFC15A' : '#fff' }}>{yearGaps}</div>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>gaps</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <button
            onClick={() => setTripType('leisure')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 99, border: 'none', cursor: 'pointer', background: tripType === 'leisure' ? '#fff' : 'rgba(255,255,255,.16)', color: tripType === 'leisure' ? '#4A3189' : '#fff', fontSize: 13.5, fontWeight: 800 }}
          >
            Leisure
          </button>
          <button
            onClick={() => setTripType('work')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 99, border: 'none', cursor: 'pointer', background: tripType === 'work' ? '#fff' : 'rgba(255,255,255,.16)', color: tripType === 'work' ? '#4A3189' : '#fff', fontSize: 13.5, fontWeight: 800 }}
          >
            Work
          </button>
        </div>
      </div>

      {current.map((t) => {
        const spend = t.hotels.reduce((s, h) => s + (h.total ?? 0), 0) + t.flights.reduce((s, f) => s + (f.cost ?? 0), 0);
        const pts = t.hotels.reduce((s, h) => s + Math.round((h.total ?? 0) * 10), 0);
        const gaps = findGaps(t).reduce((s, g) => s + g.nights, 0);
        const totalNights = t.hotels.reduce((s, h) => s + h.nights, 0) || 1;
        const daysDone = Math.round((Date.now() - new Date(t.start).getTime()) / 86400000);
        const pct = Math.min(100, Math.max(0, (daysDone / totalNights) * 100));
        return (
          <div key={t.id} style={{ padding: '20px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 3px rgba(12,122,66,.18)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--green)' }}>Under way</span>
            </div>
            <div onClick={() => navigate(`/trips/${t.id}`)} style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--ink)', color: '#fff', boxShadow: '0 12px 30px rgba(23,23,28,.24)', cursor: 'pointer' }}>
              <div style={{ position: 'relative', height: 150, background: 'linear-gradient(160deg,#5B3FA6,#2A1E52)' }}>
                <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', padding: '5px 10px', borderRadius: 99, background: 'rgba(255,255,255,.94)', color: 'var(--green)' }}>
                    DAY {daysDone + 1} OF {totalNights}
                  </span>
                </div>
                <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.8px', lineHeight: 1.05 }}>{t.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.88, marginTop: 3 }}>{t.start} - {t.end}</div>
                  <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,.28)', marginTop: 11, overflow: 'hidden' }}>
                    <i style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 99 }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', padding: '13px 16px 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px' }}>£{spend.toLocaleString()}</div>
                  <div style={{ fontSize: 9, opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>spend</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px' }}>{pts.toLocaleString()}</div>
                  <div style={{ fontSize: 9, opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>points</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px', color: gaps > 0 ? '#FFC15A' : '#9BE7C4' }}>{gaps}</div>
                  <div style={{ fontSize: 9, opacity: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>gap nights</div>
                </div>
              </div>
              <div style={{ padding: '13px 16px 14px' }} />
            </div>
          </div>
        );
      })}
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
