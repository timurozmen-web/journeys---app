import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips } from '../lib/useLiveData';
import { TripCard, PastTripCard, destinationQuery } from '../components/TripCard';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { findGaps } from '../lib/tripStats';
import { tripDayInfo } from '../lib/tripDay';

export function Trips() {
  const navigate = useNavigate();
  const { data: allTrips } = useTrips();
  const [tripType, setTripType] = useState<'work' | 'leisure'>('leisure');
  const [pastExpanded, setPastExpanded] = useState(false);
  const trips = allTrips.filter((t) => t.tripType === tripType);

  const current = trips.filter((t) => t.section === 'current').sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = trips.filter((t) => t.section === 'upcoming').sort((a, b) => a.start.localeCompare(b.start));
  const past = trips.filter((t) => t.section === 'past').sort((a, b) => b.start.localeCompare(a.start));

  const CURRENT_YEAR = new Date().getFullYear();
  const yearHotels = trips.flatMap((t) => t.hotels).filter((h) => h.status === 'Completed' && Number(h.date.slice(0, 4)) === CURRENT_YEAR);
  const yearFlights = trips.flatMap((t) => t.flights).filter((f) => f.status === 'Completed' && f.date && Number(f.date.slice(0, 4)) === CURRENT_YEAR);
  const yearNights = yearHotels.reduce((s, h) => s + h.nights, 0);
  const yearSpend = yearHotels.reduce((s, h) => s + (h.total ?? 0), 0) + yearFlights.reduce((s, f) => s + (f.cost ?? 0), 0);
  const yearGaps = trips.reduce((s, t) => s + findGaps(t).length, 0);
  const tripWithMostGaps = [...trips].sort((a, b) => findGaps(b).length - findGaps(a).length)[0];
  const continents = new Set(trips.flatMap((t) => t.hotels.map((h) => h.country))).size;

  return (
    <div>
      <div style={{ background: '#fff', height: 'env(safe-area-inset-top, 0px)' }} />
      <div style={{ background: 'linear-gradient(165deg,#101B44 0%,#1E3A8F 100%)', padding: '24px 20px 20px', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, color: '#fff' }}>
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
            style={{ flex: 1, padding: '10px 0', borderRadius: 99, border: 'none', cursor: 'pointer', background: tripType === 'leisure' ? '#fff' : 'rgba(255,255,255,.16)', color: tripType === 'leisure' ? '#101B44' : '#fff', fontSize: 13.5, fontWeight: 800 }}
          >
            Leisure
          </button>
          <button
            onClick={() => setTripType('work')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 99, border: 'none', cursor: 'pointer', background: tripType === 'work' ? '#fff' : 'rgba(255,255,255,.16)', color: tripType === 'work' ? '#101B44' : '#fff', fontSize: 13.5, fontWeight: 800 }}
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
        const TODAY = new Date().toISOString().slice(0, 10);
        const { dayIndex: daysDone, totalDays: totalNights } = tripDayInfo(t, TODAY);
        const pct = Math.min(100, Math.max(0, (daysDone / totalNights) * 100));
        const daysOut = Math.max(0, Math.round((new Date(t.start).getTime() - Date.now()) / 86400000));
        return (
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: isUnderway ? 'var(--green)' : 'var(--brand)', boxShadow: isUnderway ? '0 0 0 3px rgba(12,122,66,.18)' : '0 0 0 3px rgba(30,58,143,.18)' }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em', color: isUnderway ? 'var(--green)' : 'var(--brand)' }}>
                {isUnderway ? 'Under way' : 'Coming up next'}
              </span>
            </div>
            <div onClick={() => navigate(`/trips/${t.id}`)} style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--ink)', color: '#fff', boxShadow: '0 12px 30px rgba(23,23,28,.24)', cursor: 'pointer' }}>
              <div style={{ position: 'relative', height: 150, background: '#2A1E52' }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  <DestinationPhoto query={destinationQuery(t)} seed={t.id} height={150} />
                </div>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(23,23,28,.15) 0%,rgba(23,23,28,.1) 40%,rgba(74,49,137,.75) 85%,#101B44 100%)' }} />
                <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', padding: '5px 10px', borderRadius: 99, background: 'rgba(255,255,255,.94)', color: isUnderway ? 'var(--green)' : 'var(--brand)' }}>
                    {isUnderway ? `DAY ${daysDone} OF ${totalNights}` : `${daysOut} DAYS OUT`}
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
              <div style={{ display: 'flex', padding: '13px 16px', background: 'linear-gradient(180deg,#1E3A8F,#101B44)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px' }}>£{spend.toLocaleString()}</div>
                  <div style={{ fontSize: 9, opacity: 0.75, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>spend</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px' }}>{pts.toLocaleString()}</div>
                  <div style={{ fontSize: 9, opacity: 0.75, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>points</div>
                </div>
                {gaps > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.3px', color: '#FFC15A' }}>{gaps}</div>
                    <div style={{ fontSize: 9, opacity: 0.75, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>gap nights</div>
                  </div>
                )}
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
