import { useTrips } from '../lib/useLiveData';

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function Home() {
  const { data: trips, isLive } = useTrips();
  const today = '2026-07-30';
  const currentTrip = trips.find((t) => t.section === 'current') ?? trips[0];

  if (!currentTrip) return <div className="head"><div className="h1">No trips yet</div></div>;

  const isUnderway = currentTrip.start <= today && currentTrip.end >= today;
  const dayNum = isUnderway ? daysBetween(currentTrip.start, today) + 1 : 0;
  const span = daysBetween(currentTrip.start, currentTrip.end);
  const nextLeg = [...currentTrip.hotels, ...currentTrip.flights]
    .filter((x) => (x.date ?? '') >= today)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0];

  return (
    <div>
      <div className="head">
        <div className="h1">Good morning, Timur 👋</div>
        <div className="h-sub">
          Here's your travel snapshot {!isLive && <span style={{ opacity: 0.6 }}>· sample data</span>}
        </div>
      </div>

      <div className="stack" style={{ marginTop: 4 }}>
        <div className="hero">
          <div className="k">{isUnderway ? 'Under way' : 'Next trip'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="brand">{currentTrip.title}</div>
              <div className="tier">{isUnderway ? `Day ${dayNum} of ${span}` : `${span} days`}</div>
            </div>
          </div>
          {nextLeg && (
            <div className="note" style={{ color: 'rgba(255,255,255,.9)' }}>
              Next: {'name' in nextLeg ? nextLeg.name : `${nextLeg.from} → ${nextLeg.to}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
