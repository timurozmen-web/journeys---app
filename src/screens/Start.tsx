import { useNavigate } from 'react-router-dom';
import { useLoyaltyProgrammes, useAllHotels, usePromotions, useTrips } from '../lib/useLiveData';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { destinationQuery } from '../lib/tripHotels';
import { withLiveOverrides } from '../lib/walletValue';
import { countdownLabel } from '../lib/tripTimeline';
import { MODE_HOME, writeMode, type AppMode } from '../lib/appMode';

// The front door: Travel on the top half, Loyalty on the bottom, each a
// photo with its name, what it's for, and one live line from your data.
export function Start() {
  const navigate = useNavigate();
  const { data: trips } = useTrips();
  const { data: programmes } = useLoyaltyProgrammes();
  const { data: hotels } = useAllHotels();
  const { data: promotions } = usePromotions();
  const today = new Date().toISOString().slice(0, 10);
  const next = trips.filter((t) => t.end >= today).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
  const value = withLiveOverrides(programmes, hotels, promotions).reduce((s, p) => s + (p.points * p.ptValue) / 100, 0);
  const half = typeof window === 'undefined' ? 420 : Math.ceil(window.innerHeight / 2) + 40;

  const open = (mode: AppMode) => { writeMode(mode); navigate(MODE_HOME[mode]); };

  return (
    <div className="start">
      <button className="start-half travel" onClick={() => open('travel')}>
        <span className="start-photo"><DestinationPhoto query={next ? destinationQuery(next) : 'coastline travel'} seed={next?.id ?? 'travel'} height={half} /></span>
        <span className="start-scrim" />
        <span className="start-text">
          <span className="start-title travel">Travel</span>
          <span className="start-desc">Trips coming up, and the ones behind you.</span>
          {next && (
            <span className="start-live">
              {next.title} · {next.start <= today ? 'under way' : countdownLabel(today, next.start).toLowerCase()}
            </span>
          )}
        </span>
      </button>
      <button className="start-half loyalty" onClick={() => open('loyalty')}>
        <span className="start-photo"><DestinationPhoto query="hotel lobby" seed="loyalty" height={half} /></span>
        <span className="start-scrim" />
        <span className="start-text">
          <span className="start-title loyalty">Loyalty</span>
          <span className="start-desc">Points, status and the cards that earn them.</span>
          {programmes.length > 0 && <span className="start-live">£{Math.round(value).toLocaleString()} across {programmes.length} programmes</span>}
        </span>
      </button>
    </div>
  );
}
