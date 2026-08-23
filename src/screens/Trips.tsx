import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../lib/useLiveData';
import { TripCard, destinationQuery } from '../components/TripCard';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { findGaps } from '../lib/tripStats';

export function Trips() {
  const navigate = useNavigate();
  const { data: allTrips } = useTrips();
  const [tripType, setTripType] = useState<'work' | 'leisure'>('leisure');
  const [pastFilter, setPastFilter] = useState('');
  const trips = allTrips.filter((t) => t.tripType === tripType);

  const current = trips.filter((t) => t.section === 'current').sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = trips.filter((t) => t.section === 'upcoming').sort((a, b) => a.start.localeCompare(b.start));
  const past = trips.filter((t) => t.section === 'past').sort((a, b) => b.start.localeCompare(a.start));

  const yearNights = trips.reduce((s, t) => s + t.hotels.reduce((n, h) => n + h.nights, 0), 0);
  const yearSpend = trips.reduce((s, t) => s + t.hotels.reduce((n, h) => n + (h.total ?? 0), 0) + t.flights.reduce((n, f) => n + (f.cost ?? 0), 0), 0);
  const yearGaps = trips.reduce((s, t) => s + findGaps(t).length, 0);
  const tripWithMostGaps = [...trips].sort((a, b) => findGaps(b).length - findGaps(a).length)[0];
  const continents = new Set(trips.flatMap((t) => t.hotels.map((h) => h.country))).size;

  return (
    <div>
      <div style={{ background: '#fff', height: 'env(safe-area-inset-top, 0px)' }} />
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
          <button
            onClick={() => yearGaps > 0 && tripWithMostGaps && navigate(`/trips/${tripWithMostGaps.id}`)}
            style={{ flex: 1, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: yearGaps > 0 ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.4px', color: yearGaps > 0 ? '#FFC15A' : '#fff', textDecoration: yearGaps > 0 ? 'underline' : 'none' }}>{yearGaps}</div>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>gaps{yearGaps > 0 ? ' · tap to fix' : ''}</div>
          </button>
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

      {(() => {
        const heroTrip = current[0] ?? upcoming[0];
        if (!heroTrip) return null;
        const isUnderway = heroTrip.section === 'current';
        const t = heroTrip;
        const spend = t.hotels.reduce((s, h) => s + (h.total ?? 0), 0) + t.flights.reduce((s, f) => s + (f.cost ?? 0), 0);
        const pts = t.hotels.reduce((s, h) => s + Math.round((h.total ?? 0) * 10), 0);
        const gaps = findGaps(t).reduce((s, g) => s + g.nights, 0);
        const totalNights = t.hotels.reduce((s, h) => s + h.nights, 0) || 1;
        const daysDone = Math.round((Date.now() - new Date(t.start).getTime()) / 86400000);
        const pct = Math.min(100, Math.max(0, (daysDone / totalNights) * 100));
        const daysOut = Math.round((new Date(t.start).getTime() - Date.now()) / 86400000);
        return (
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: isUnderway ? 'var(--green)' : 'var(--brand)', boxShadow: isUnderway ? '0 0 0 3px rgba(12,122,66,.18)' : '0 0 0 3px rgba(91,63,166,.18)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em', color: isUnderway ? 'var(--green)' : 'var(--brand)' }}>
                {isUnderway ? 'Under way' : 'Coming up next'}
              </span>
            </div>
            <div onClick={() => navigate(`/trips/${t.id}`)} style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--ink)', color: '#fff', boxShadow: '0 12px 30px rgba(23,23,28,.24)', cursor: 'pointer' }}>
              <div style={{ position: 'relative', height: 150, background: '#2A1E52' }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  <DestinationPhoto query={destinationQuery(t)} seed={t.id} height={150} />
                </div>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(23,23,28,.15) 0%,rgba(23,23,28,.1) 40%,rgba(74,49,137,.75) 85%,#4A3189 100%)' }} />
                <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', padding: '5px 10px', borderRadius: 99, background: 'rgba(255,255,255,.94)', color: isUnderway ? 'var(--green)' : 'var(--brand)' }}>
                    {isUnderway ? `DAY ${daysDone + 1} OF ${totalNights}` : `${daysOut} DAYS OUT`}
                  </span>
                </div>
                <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.8px', lineHeight: 1.05 }}>{t.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.88, marginTop: 3 }}>{t.start} - {t.end}</div>
                  {isUnderway && (
                    <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,.28)', marginTop: 11, overflow: 'hidden' }}>
                      <i style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 99 }} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', padding: '13px 16px', background: 'linear-gradient(180deg,#5B3FA6,#4A3189)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px' }}>£{spend.toLocaleString()}</div>
                  <div style={{ fontSize: 9, opacity: 0.75, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>spend</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px' }}>{pts.toLocaleString()}</div>
                  <div style={{ fontSize: 9, opacity: 0.75, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>points</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px', color: gaps > 0 ? '#FFC15A' : '#9BE7C4' }}>{gaps}</div>
                  <div style={{ fontSize: 9, opacity: 0.75, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>gap nights</div>
                </div>
              </div>
            </div>
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
            {past.length > 3 && (
              <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{past.length} trips</span>
            )}
          </div>
          {past.length > 3 && (
            <div style={{ padding: '0 20px 10px' }}>
              <input
                value={pastFilter}
                onChange={(e) => setPastFilter(e.target.value)}
                placeholder="Search past trips (name or year)…"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, font: 'inherit' }}
              />
            </div>
          )}
          <div className="stack">
            {(pastFilter
              ? past.filter((t) => (t.title + ' ' + t.start).toLowerCase().includes(pastFilter.toLowerCase()))
              : past.slice(0, 3)
            ).map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
            {!pastFilter && past.length > 3 && (
              <div style={{ fontSize: 12, color: 'var(--ink3)', textAlign: 'center', padding: '4px 0' }}>
                Showing 3 most recent · search above to find an older trip
              </div>
            )}
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
