import { useTrips } from '../lib/useLiveData';
import { TripCard } from '../components/TripCard';

export function Trips() {
  const { data: trips, isLive } = useTrips();
  const current = trips.filter((t) => t.section === 'current');
  const upcoming = trips.filter((t) => t.section === 'upcoming');
  const past = trips.filter((t) => t.section === 'past');

  return (
    <div>
      <div className="head">
        <div className="h1">Trips</div>
        <div className="h-sub">
          {trips.length} trips {!isLive && '(sample data)'}
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
      <div className="sect">
        <h2>Past</h2>
      </div>
      <div className="stack">
        {past.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
      </div>
    </div>
  );
}
