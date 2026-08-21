import { useNavigate } from 'react-router-dom';
import { DestinationPhoto } from './DestinationPhoto';
import { formatDateRange } from '../lib/format';
import { BedIcon, HotelIcon, PlaneIcon } from './Icons';
import type { Trip } from '../types';

function nightsOf(t: Trip) {
  return t.hotels.reduce((s, h) => s + h.nights, 0);
}
export function destinationQuery(t: Trip) {
  return t.hotels[0]?.country?.trim() || t.title.split(/[·+]/)[0].trim();
}

// The hotel worth showing at a glance: whichever stay is actually
// happening right now if the trip is under way, otherwise the first stay
// chronologically -- not just whatever order the hotels happen to be in.
function relevantHotel(t: Trip): Trip['hotels'][number] | null {
  if (t.hotels.length === 0) return null;
  const sorted = [...t.hotels].sort((a, b) => a.date.localeCompare(b.date));
  if (t.section === 'current') {
    const today = new Date().toISOString().slice(0, 10);
    const ongoing = sorted.find((h) => {
      const checkOut = new Date(new Date(h.date + 'T00:00:00').getTime() + h.nights * 86400000).toISOString().slice(0, 10);
      return h.date <= today && today < checkOut;
    });
    if (ongoing) return ongoing;
  }
  return sorted[0];
}

const SECTION_PILL: Record<Trip['section'], { label: string; cls: string }> = {
  current: { label: 'Under way', cls: 'live' },
  upcoming: { label: 'Upcoming', cls: 'brand' },
  past: { label: 'Completed', cls: 'grey' },
};

export function TripCard({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  const pill = SECTION_PILL[trip.section];
  const nights = nightsOf(trip);
  const hotel = relevantHotel(trip);

  return (
    <div className="trip" onClick={() => navigate(`/trips/${trip.id}`)} style={{ cursor: 'pointer' }}>
      <div style={{ position: 'relative' }}>
        {trip.heroImageUrl ? (
          <img src={trip.heroImageUrl} alt={trip.title} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
        ) : (
          <DestinationPhoto query={destinationQuery(trip)} seed={trip.id} height={130} />
        )}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.55) 100%)',
          }}
        />
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 12, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px', textShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
              {trip.title}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.95, marginTop: 2, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
              {formatDateRange(trip.start, trip.end)}
            </div>
          </div>
          {hotel && (
            <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '45%' }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hotel.name}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.9, marginTop: 1, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
                {trip.section === 'current' ? 'Current stay' : 'First stay'}
              </div>
            </div>
          )}
        </div>
        <span className={`pill onphoto ${pill.cls}`} style={{ position: 'absolute', top: 12, right: 12 }}>
          {pill.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, padding: '11px 16px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <BedIcon size={13} color="var(--ink3)" />
          <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>{nights} nights</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <HotelIcon size={13} color="var(--ink3)" />
          <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>{trip.hotels.length} {trip.hotels.length === 1 ? 'stay' : 'stays'}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <PlaneIcon size={13} color="var(--ink3)" />
          <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>{trip.flights.length} flights</span>
        </span>
      </div>
    </div>
  );
}
