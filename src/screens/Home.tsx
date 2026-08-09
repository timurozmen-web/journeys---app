import { useTrips, useAllHotels, useAllFlights, useLoyaltyProgrammes } from '../lib/useLiveData';
import { BedIcon, HotelIcon, PlaneIcon } from '../components/Icons';

const TODAY = '2026-07-30';
const THIS_YEAR = 2026;
const LAST_YEAR = 2025;

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function yearOf(date: string | null) {
  return date ? Number(date.slice(0, 4)) : null;
}
function fmt(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function delta(n: number) {
  return n === 0 ? '±0 vs last year' : n > 0 ? `+${n} vs last year` : `${n} vs last year`;
}

export function Home() {
  const { data: trips, isLive } = useTrips();
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();

  const currentTrip = trips.find((t) => t.section === 'current');
  const upcomingTrip = trips
    .filter((t) => t.section === 'upcoming')
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  // Real year-over-year deltas, completed stays/flights only.
  const completedHotels = hotels.filter((h) => h.status === 'Completed');
  const completedFlights = flights.filter((f) => f.status === 'Completed');
  const nightsThisYear = completedHotels.filter((h) => yearOf(h.date) === THIS_YEAR).reduce((s, h) => s + h.nights, 0);
  const nightsLastYear = completedHotels.filter((h) => yearOf(h.date) === LAST_YEAR).reduce((s, h) => s + h.nights, 0);
  const staysThisYear = completedHotels.filter((h) => yearOf(h.date) === THIS_YEAR).length;
  const staysLastYear = completedHotels.filter((h) => yearOf(h.date) === LAST_YEAR).length;
  const flightsThisYear = completedFlights.filter((f) => yearOf(f.date) === THIS_YEAR).length;
  const flightsLastYear = completedFlights.filter((f) => yearOf(f.date) === LAST_YEAR).length;

  // Real hotel savings: (market rate − what was actually paid) × nights,
  // only where both rates are recorded. Flights have no equivalent
  // "standard fare" baseline tracked, so they're deliberately left out
  // rather than estimated.
  let hotelSavings = 0;
  let hotelSpend = 0;
  for (const h of completedHotels) {
    if (yearOf(h.date) !== THIS_YEAR) continue;
    if (h.total) hotelSpend += h.total;
    if (h.avgRate != null && h.nightlyRate != null) hotelSavings += (h.avgRate - h.nightlyRate) * h.nights;
  }

  const marriott = loyaltyProgrammes.find((p) => p.name === 'Marriott Bonvoy');

  return (
    <div>
      <div className="head">
        <div className="h1">Good morning, Timur 👋</div>
        <div className="h-sub">
          Here's your travel snapshot {!isLive && <span style={{ opacity: 0.6 }}>· sample data</span>}
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="ic" style={{ background: 'rgba(19,34,71,.08)' }}>
            <BedIcon size={16} color="var(--brand)" />
          </div>
          <div className="lab">Nights</div>
          <div className="val">{nightsThisYear + nightsLastYear === 0 ? '—' : completedHotels.reduce((s, h) => s + h.nights, 0)}</div>
          <div className="delta" style={{ color: nightsThisYear - nightsLastYear >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta(nightsThisYear - nightsLastYear)}
          </div>
        </div>
        <div className="tile">
          <div className="ic" style={{ background: 'rgba(12,122,66,.1)' }}>
            <HotelIcon size={16} color="var(--green)" />
          </div>
          <div className="lab">Stays</div>
          <div className="val">{completedHotels.length}</div>
          <div className="delta" style={{ color: staysThisYear - staysLastYear >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta(staysThisYear - staysLastYear)}
          </div>
        </div>
        <div className="tile">
          <div className="ic" style={{ background: 'rgba(156,95,8,.1)' }}>
            <PlaneIcon size={16} color="var(--amber)" />
          </div>
          <div className="lab">Flights</div>
          <div className="val">{completedFlights.length}</div>
          <div className="delta" style={{ color: flightsThisYear - flightsLastYear >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta(flightsThisYear - flightsLastYear)}
          </div>
        </div>
      </div>

      {marriott && marriott.nextTier && (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="hero">
            <div className="k">Loyalty progress</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="brand">{marriott.name}</div>
                <div className="tier">{marriott.tier}</div>
              </div>
              {marriott.nightsNeeded != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{marriott.nightsNeeded}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    nights to<br />{marriott.nextTier}
                  </div>
                </div>
              )}
            </div>
            {marriott.nights != null && marriott.nightsNeeded != null && (
              <>
                <div className="hbar" style={{ marginTop: 12 }}>
                  <i style={{ width: `${(marriott.nights / (marriott.nights + marriott.nightsNeeded)) * 100}%` }} />
                </div>
                <div className="note" style={{ color: 'rgba(255,255,255,.85)' }}>
                  {marriott.nights} / {marriott.nights + marriott.nightsNeeded} nights
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {hotelSavings > 0 && (
        <>
          <div className="sect">
            <h2>This year you've saved</h2>
          </div>
          <div className="stack">
            <div className="chartwrap">
              <div className="big">£{Math.round(hotelSavings).toLocaleString()}</div>
              <div className="lab">vs standard hotel rates</div>
              <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--ink2)' }}>Hotel spend this year</span>
                  <span style={{ fontWeight: 700 }}>£{Math.round(hotelSpend).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 4 }}>
                  Flight and upgrade savings aren't tracked yet — this is hotel rates only.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {currentTrip && (
        <>
          <div className="sect">
            <h2>Under way</h2>
          </div>
          <div className="stack">
            <div className="trip">
              <div className="body">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t" style={{ fontSize: 15, fontWeight: 700 }}>
                    {currentTrip.title}
                  </div>
                  <div className="s">
                    Day {daysBetween(currentTrip.start, TODAY) + 1} of {daysBetween(currentTrip.start, currentTrip.end)}
                  </div>
                </div>
                <span className="pill live">Under way</span>
              </div>
            </div>
          </div>
        </>
      )}

      {upcomingTrip && (
        <>
          <div className="sect">
            <h2>Upcoming trip</h2>
          </div>
          <div className="stack">
            <div className="trip">
              <div className="body">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t" style={{ fontSize: 15, fontWeight: 700 }}>
                    {upcomingTrip.title}
                  </div>
                  <div className="s">
                    {fmt(upcomingTrip.start)} – {fmt(upcomingTrip.end)} · {upcomingTrip.hotels.length} hotels · {upcomingTrip.flights.length} flights
                  </div>
                </div>
                <span className="pill brand">in {daysBetween(TODAY, upcomingTrip.start)}d</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
