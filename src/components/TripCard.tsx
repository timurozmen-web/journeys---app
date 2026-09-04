import { useNavigate } from 'react-router-dom';
import { DestinationPhoto } from './DestinationPhoto';
import { formatDateRange } from '../lib/format';
import { BedIcon, HotelIcon, PlaneIcon } from './Icons';
import type { Trip } from '../types';

function nightsOf(t: Trip) {
  return t.hotels.reduce((s, h) => s + h.nights, 0);
}
// The hotel worth showing at a glance: whichever stay is actually
// happening right now if the trip is under way, otherwise the first stay
// chronologically -- not just whatever order the hotels happen to be in.
export function relevantHotel(t: Trip): Trip['hotels'][number] | null {
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

// Most-specific-first, same rule everywhere a destination photo is looked
// up: city + country beats country alone, which beats the trip's own
// title. A Faro stay should surface Faro's own photo, not a generic
// Portugal one.
export function destinationQuery(t: Trip) {
  const hotel = relevantHotel(t);
  if (hotel?.city) return `${hotel.city}, ${hotel.country}`;
  return hotel?.country?.trim() || t.title.split(/[·+]/)[0].trim();
}

// Compact portrait card for the "three across" past-trips row. Precision
// of the photo doesn't matter as much here as on the current-trip hero --
// first stay chronologically is a fine stand-in for "what this trip was".
export function PastTripCard({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  const nights = nightsOf(trip);
  return (
    <div
      onClick={() => navigate(`/trips/${trip.id}`)}
      style={{ flex: '0 0 110px', width: 110, height: 163, borderRadius: 14, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
    >
      {trip.heroImageUrl ? (
        <img src={trip.heroImageUrl} alt={trip.title} style={{ width: '100%', height: 163, objectFit: 'cover', display: 'block' }} />
      ) : (
        <DestinationPhoto query={destinationQuery(trip)} seed={trip.id} height={163} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.62) 100%)' }} />
      <div style={{ position: 'absolute', left: 9, right: 9, bottom: 9, color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-.1px', lineHeight: 1.15, textShadow: '0 2px 6px rgba(0,0,0,.4)' }}>{trip.title}</div>
        <div style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.9, marginTop: 2, textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>{nights} night{nights === 1 ? '' : 's'}</div>
      </div>
    </div>
  );
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
