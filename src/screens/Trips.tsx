import { useNavigate } from 'react-router-dom';
import { useTrips } from '../lib/useLiveData';
import type { Trip } from '../types';

function fmt(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function nightsOf(t: Trip) {
  return t.hotels.reduce((s, h) => s + h.nights, 0);
}

export function Trips() {
  const navigate = useNavigate();
  const { data: trips, isLive } = useTrips();
  const current = trips.filter((t) => t.section === 'current');
  const upcoming = trips.filter((t) => t.section === 'upcoming');
  const past = trips.filter((t) => t.section === 'past');

  const card = (t: Trip) => (
    <div key={t.id} className="trip" onClick={() => navigate(`/trips/${t.id}`)} style={{ cursor: 'pointer' }}>
      <div className="body">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t" style={{ fontSize: 15, fontWeight: 700 }}>
            {t.title}
          </div>
          <div className="s">
            {fmt(t.start)} – {fmt(t.end)} · {nightsOf(t)} nights logged
          </div>
        </div>
        <span className={`pill ${t.section === 'current' ? 'live' : t.section === 'upcoming' ? 'brand' : 'grey'}`}>
          {t.section === 'current' ? 'Under way' : t.section === 'upcoming' ? 'Upcoming' : 'Completed'}
        </span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="head">
        <div className="h1">Trips</div>
        <div className="h-sub">
          {trips.length} trips {!isLive && '(sample data)'}
        </div>
      </div>
      {current.length > 0 && <div className="stack">{current.map(card)}</div>}
      {upcoming.length > 0 && (
        <>
          <div className="sect">
            <h2>Upcoming</h2>
          </div>
          <div className="stack">{upcoming.map(card)}</div>
        </>
      )}
      <div className="sect">
        <h2>Past</h2>
      </div>
      <div className="stack">{past.map(card)}</div>
    </div>
  );
}
