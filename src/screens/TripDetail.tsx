import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips, useLoyaltyProgrammes, usePromotions } from '../lib/useLiveData';
import { uploadTripPhoto, fetchTripPhotos, splitTrip, deleteHotel, deleteFlight } from '../lib/queries';
import { SwipeToDelete } from '../components/SwipeToDelete';
import type { TripPhoto } from '../lib/queries';
import { BackIcon, CameraIcon, ChevronDownIcon, BedIcon, EditIcon, AlertIcon, MoonIcon, PlaneIcon } from '../components/Icons';
import { airlineBadge } from '../data/airlineBrand';
import { hotelBadge } from '../lib/bookingBadge';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { DestinationPhoto } from '../components/DestinationPhoto';
const TripMap = lazyWithRetry(() => import('../components/TripMap').then((m) => ({ default: m.TripMap })));
import { destinationQuery } from '../lib/tripHotels';
import { TripMemories } from '../components/TripMemories';
import { formatDateRange, formatMoney, weekdayDay } from '../lib/format';
import { computeTripPoints, computeTripSavings, groupDestinations, findGaps, suggestTripSplit } from '../lib/tripStats';
import { tripDayInfo, addDays } from '../lib/tripDay';
import { checkTripCompleteness, flightSearchUrl, returnFlightSearchUrl, tripGapDescription } from '../lib/tripCompleteness';
import { useFlightExemptTripIds } from '../lib/homeLocation';
import { Button, ErrorText, Eyebrow, PhotoHero, Segmented } from '../components/ui';

type Seg = 'overview' | 'expenses' | 'notes';

function fmt(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seg, setSeg] = useState<Seg>('overview');
  const [view, setView] = useState<'itinerary' | 'map'>('itinerary');
  const { data: trips, refetch: refetchTrips } = useTrips();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: promotions } = usePromotions();
  const trip = trips.find((t) => t.id === id);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const [expandedDest, setExpandedDest] = useState<number | null>(null);
  const [tripPhotos, setTripPhotos] = useState<TripPhoto[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchTripPhotos(id).then(setTripPhotos).catch(() => setTripPhotos([]));
  }, [id]);

  const [splitting, setSplitting] = useState(false);
  const [legError, setLegError] = useState('');

  // Swipe a stay or flight left and tap Delete: that's the confirmation.
  async function removeLeg(kind: 'hotel' | 'flight', legId: string) {
    setLegError('');
    try {
      if (kind === 'hotel') await deleteHotel(legId);
      else await deleteFlight(legId);
      refetchTrips();
    } catch (err) {
      setLegError(err instanceof Error ? err.message : 'Could not delete it.');
    }
  }
  const flightExemptTripIds = useFlightExemptTripIds(trips);

  if (!trip) return <div className="head">Trip not found</div>;

  const heroImage = photoUrl ?? trip.heroImageUrl;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !trip) return;
    setUploading(true);
    setUploadError('');
    try {
      const url = await uploadTripPhoto(trip.id, file);
      setPhotoUrl(url);
    } catch (err) {
      console.error('Photo upload failed:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Upload failed: unknown error, check browser console';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  }

  const spend = trip.hotels.reduce((s, h) => s + (h.total ?? 0), 0) + trip.flights.reduce((s, f) => s + (f.cost ?? 0), 0);
  const points = computeTripPoints(trip, loyaltyProgrammes, promotions);
  const savings = computeTripSavings(trip);
  const destinations = groupDestinations(trip);
  const gaps = findGaps(trip);

  const TODAY = new Date().toISOString().slice(0, 10);
  const heroBadge =
    trip.section === 'current'
      ? (() => { const d = tripDayInfo(trip, TODAY); return `Current trip · Day ${d.dayIndex} of ${d.totalDays}`; })()
      : trip.section === 'upcoming'
      ? `Upcoming · ${Math.max(0, Math.round((new Date(trip.start).getTime() - Date.now()) / 86400000))} days to go`
      : 'Completed';

  // The hotel actually being stayed at right now, for a trip under way.
  const stayingNow = trip.section === 'current'
    ? trip.hotels.find((h) => {
        const checkOut = addDays(h.date, h.nights);
        return h.date <= TODAY && TODAY < checkOut;
      }) ?? null
    : null;
  const sortedHotels = [...trip.hotels].sort((a, b) => a.date.localeCompare(b.date));
  const sortedFlights = [...trip.flights].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  // Unified itinerary: outbound flight, stays in between, return flight --
  // one chronological sequence rather than two disconnected lists, so a
  // trip reads the way it was actually planned.
  type Leg = { kind: 'hotel'; date: string; data: typeof sortedHotels[number] } | { kind: 'flight'; date: string; data: typeof sortedFlights[number]; role: 'Outbound' | 'Return' | null };
  const legs: Leg[] = [
    ...sortedHotels.map((h): Leg => ({ kind: 'hotel', date: h.date, data: h })),
    ...sortedFlights.map((f, i): Leg => ({
      kind: 'flight', date: f.date ?? '', data: f,
      role: sortedFlights.length > 1 ? (i === 0 ? 'Outbound' : i === sortedFlights.length - 1 ? 'Return' : null) : null,
    })),
  ].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    // Same day: an outbound/unlabelled flight (arriving) comes before a
    // hotel check-in that day -- you land, then go to the hotel. A
    // return flight (departing) comes after -- checkout, then fly home.
    if (a.kind === 'flight' && b.kind === 'hotel') return a.role === 'Return' ? 1 : -1;
    if (a.kind === 'hotel' && b.kind === 'flight') return b.role === 'Return' ? -1 : 1;
    return 0;
  });

  const tripGap = checkTripCompleteness(trip);
  const showTripGap = tripGap && !flightExemptTripIds.has(trip.id);
  const gapDestination = trip.title.split(/[·+]/)[0].trim();
  const gapDateOut = sortedHotels[0]?.date;
  const gapDateBack = sortedHotels.length ? (() => {
    const last = sortedHotels[sortedHotels.length - 1];
    return addDays(last.date, last.nights);
  })() : undefined;

  return (
    <div>
      <PhotoHero
        scrim="dissolve" height={380}
        src={heroImage}
        fallback={<DestinationPhoto query={destinationQuery(trip)} seed={trip.id} height={380} />}
      >
        <button className="tdback" aria-label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/now'))}>
          <BackIcon size={18} color="var(--on-dark)" />
        </button>
        <button
          className="tdback"
          style={{ left: 'auto', right: 64 }}
          onClick={() => navigate('/log-trip', { state: { trip } })}
        >
          <EditIcon size={17} color="var(--on-dark)" />
        </button>
        <button
          className="tdback"
          style={{ left: 'auto', right: 16 }}
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? '…' : <CameraIcon size={18} color="var(--on-dark)" />}
        </button>
        <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <div className="ph-bottom" style={{ bottom: 16 }}>
          <div style={{ marginBottom: 8 }}><Eyebrow>{heroBadge}</Eyebrow></div>
          <h1 className="ph-title" style={{ fontSize: 'var(--fs-display)', margin: 0 }}>{trip.title}</h1>
          <span className="ph-sub">{formatDateRange(trip.start, trip.end)}</span>
          {stayingNow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 'var(--fs-small)', fontWeight: 700, opacity: 0.95 }}>
              <BedIcon size={14} color="var(--on-dark)" />
              {stayingNow.name}
            </div>
          )}
        </div>
      </PhotoHero>

      {uploadError && <div style={{ padding: '8px 20px', color: 'var(--red)', fontSize: 'var(--fs-small)' }}>{uploadError}</div>}

      {showTripGap && tripGap && (
        <div style={{ padding: '18px 20px 0' }}>
          <div style={{ border: '1px solid rgba(217,183,124,.3)', background: 'rgba(217,183,124,.1)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><AlertIcon size={18} color="var(--brand)" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink)' }}>Trip incomplete</div>
                {tripGapDescription(trip, tripGap).map((note) => (
                  <div key={note} style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', marginTop: 3 }}>{note}</div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {tripGap.missingOutbound && gapDateOut && (
                    <a
                      href={flightSearchUrl(gapDestination, gapDateOut, tripGap.missingReturn ? gapDateBack : undefined)} style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--on-brand)', background: 'var(--brand)', borderRadius: 'var(--r-pill)', padding: '7px 13px', textDecoration: 'none' }}
                    >
                      Find flights
                    </a>
                  )}
                  {!tripGap.missingOutbound && tripGap.missingReturn && gapDateBack && (
                    <a
                      href={returnFlightSearchUrl(gapDestination, gapDateBack)} style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--on-brand)', background: 'var(--brand)', borderRadius: 'var(--r-pill)', padding: '7px 13px', textDecoration: 'none' }}
                    >
                      Find return flight
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '18px 20px 0' }}>
        <div className="tabsline" role="tablist">
          {(['itinerary', 'map'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
              {v === 'itinerary' ? 'Itinerary' : 'Map'}
            </button>
          ))}
        </div>
        {view === 'map' ? (
          <Suspense fallback={<div style={{ height: 220, background: 'var(--map-bg)', borderRadius: 'var(--r-md)' }} />}>
            <TripMap hotels={trip.hotels} flights={trip.flights} photos={tripPhotos} />
          </Suspense>
        ) : (
          <>
            {legError && <ErrorText style={{ marginBottom: 8 }}>{legError}</ErrorText>}
            <div className="itin2">
              {legs.map((leg, i) => {
                const newDay = i === 0 || legs[i - 1].date !== leg.date;
                const wd = leg.date ? weekdayDay(leg.date) : null;
                return (
                  <div className="itin2-row" key={`${leg.kind}-${leg.data.id}`}>
                    <span className="itin2-day">{newDay && wd ? <>{wd.weekday}<br />{wd.day}</> : null}</span>
                    <span className={newDay ? 'itin2-dot' : 'itin2-dot ghost'} />
                    {leg.kind === 'hotel' ? (
                      <SwipeToDelete
                        itemLabel={leg.data.name} surface="var(--bg)" wrapperStyle={{ borderRadius: 'var(--r-md)' }}
                        onClick={() => navigate('/log-hotel', { state: { hotel: leg.data, tripId: trip.id } })}
                        onDelete={() => removeLeg('hotel', leg.data.id)}
                      >
                        <BookingCard
                          badge={hotelBadge(leg.data, loyaltyProgrammes)}
                          title={leg.data.name}
                          price={leg.data.total}
                          sub={<>
                            <span className="moons" aria-hidden="true">
                              {Array.from({ length: Math.min(leg.data.nights, 7) }, (_, k) => <MoonIcon key={k} size={13} />)}
                            </span>
                            {leg.data.nights} night{leg.data.nights === 1 ? '' : 's'}{leg.data.brand && leg.data.brand !== 'Independent' ? ` · ${leg.data.brand}` : ''}
                          </>}
                        />
                      </SwipeToDelete>
                    ) : (
                      <SwipeToDelete
                        itemLabel={`${leg.data.from} → ${leg.data.to}`} surface="var(--bg)" wrapperStyle={{ borderRadius: 'var(--r-md)' }}
                        onClick={() => navigate('/log-flight', { state: { flight: leg.data, tripId: trip.id } })}
                        onDelete={() => removeLeg('flight', leg.data.id)}
                      >
                        <BookingCard
                          badge={airlineBadge(leg.data.flightNo, leg.data.airline)}
                          title={`${leg.data.from}${leg.data.departureTime ? ` ${leg.data.departureTime}` : ''} → ${leg.data.to}${leg.data.arrivalTime ? ` ${leg.data.arrivalTime}` : ''}`}
                          price={leg.data.cost}
                          sub={<>
                            <PlaneIcon size={13} />
                            {[leg.data.flightNo, leg.data.airline, leg.data.cabin].filter(Boolean).join(' · ')}
                          </>}
                        />
                      </SwipeToDelete>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Button variant="secondary" small style={{ flex: 1 }} onClick={() => navigate('/add/stay', { state: { tripId: trip.id } })}>Add stay</Button>
              <Button variant="secondary" small style={{ flex: 1 }} onClick={() => navigate('/add/flight', { state: { tripId: trip.id } })}>Add flight</Button>
            </div>
          </>
        )}
      </div>

      {(() => {
        const suggestion = suggestTripSplit(trip);
        if (!suggestion) return null;
        return (
          <div style={{ margin: '14px 20px 0', padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--amber-soft)', border: '1px solid rgba(232,176,75,.3)' }}>
            <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--amber)' }}>This looks like two trips</div>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', marginTop: 3 }}>
              There's a long gap and a country change between {suggestion.beforeCountry} and {suggestion.afterCountry}. Want to split this into two separate trips?
            </div>
            <button
              disabled={splitting}
              onClick={async () => {
                setSplitting(true);
                try {
                  const newId = await splitTrip(trip.id, suggestion.splitDate, suggestion.afterCountry, trip.end, trip.tripType);
                  navigate(`/trips/${newId}`);
                } catch {
                  setSplitting(false);
                }
              }}
              style={{ marginTop: 8, padding: '7px 14px', borderRadius: 'var(--r-pill)', border: 'none', background: 'var(--amber)', color: 'var(--on-dark)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}
            >
              {splitting ? 'Splitting…' : `Split at ${suggestion.splitDate}`}
            </button>
          </div>
        );
      })()}

      <Segmented<Seg>
        style={{ margin: '20px 20px 0' }}
        options={(['overview', 'expenses', 'notes'] as Seg[]).map((k) => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))}
        value={seg} onChange={setSeg}
      />

      <div className="tdpane">
        {seg === 'overview' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <TripMemories tripId={trip.id} />
            </div>
            <div className="card">
            <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, marginBottom: 12 }}>Trip summary</div>
            <div style={{ display: 'grid', gap: 9 }}>
              <SummaryRow label="Total cash spent" value={formatMoney(spend)} />
              <SummaryRow label="Points earned" value={`${points.totalPoints.toLocaleString()} pts`} />
              <SummaryRow label="Value of points earned" value={formatMoney(points.totalValue)} />
              <SummaryRow label="Total savings" value={formatMoney(savings)} valueColor="var(--green)" />
              <SummaryRow label="Pence per point (earned)" value={points.totalPoints > 0 ? `${points.centsPerPoint.toFixed(2)}p` : '—'} />
            </div>
            {trip.flights.some((f) => f.award) && (
              <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--ink3)', marginTop: 10 }}>
                This trip includes an award flight. Points redeemed aren't tracked as a value yet.
              </div>
            )}
            </div>
          </>
        )}
        {seg === 'expenses' &&
          trip.hotels.map((h) =>
            h.total != null ? (
              <div className="exprow" key={h.id}>
                <span>{h.name}</span>
                <span>£{h.total}</span>
              </div>
            ) : null
          )}
        {seg === 'notes' && <p style={{ fontSize: 'var(--fs-body)', color: 'var(--ink2)' }}>{trip.notes || 'No notes yet.'}</p>}
      </div>

      {trip.tripType === 'leisure' && gaps.length > 0 && (
        <>
          <div className="sect">
            <h2>Missing nights</h2>
          </div>
          <div style={{ display: 'grid', gap: 8, padding: '0 20px 20px' }}>
            {gaps.map((g, i) => {
              const before = [...destinations].reverse().find((d) => d.end <= g.start);
              const guessedCountry = (before ?? destinations[0])?.hotels[0]?.country ?? '';
              return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'var(--amber-soft)', border: '1px solid rgba(232,176,75,.3)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--amber)' }}>
                    {formatDateRange(g.start, g.end)}
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 2 }}>
                    {g.nights} night{g.nights === 1 ? '' : 's'} not accounted for
                  </div>
                </div>
                <button
                  onClick={() =>
                    navigate('/log-hotel', {
                      state: { tripId: trip.id, prefill: { date: g.start, nights: g.nights, country: guessedCountry } },
                    })
                  }
                  style={{
                    flexShrink: 0, padding: '8px 14px', borderRadius: 'var(--r-control)', border: 'none',
                    background: 'var(--amber)', color: 'var(--on-dark)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  + Add hotel
                </button>
              </div>
              );
            })}
          </div>
        </>
      )}

      {destinations.length > 0 && (
        <>
          <div className="sect">
            <h2>Destinations</h2>
          </div>
          <div style={{ display: 'grid', gap: 10, padding: '0 20px 20px' }}>
            {destinations.map((d, i) => {
              const isOpen = expandedDest === i;
              const destTotal = d.hotels.reduce((s, h) => s + (h.total ?? 0), 0);
              return (
                <div key={i} style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div
                    style={{ display: 'flex', gap: 12, cursor: 'pointer' }}
                    onClick={() => setExpandedDest(isOpen ? null : i)}
                  >
                    <div style={{ width: 90, flexShrink: 0 }}>
                      <DestinationPhoto query={d.place} seed={`${trip.id}-${d.place}`} height={90} />
                    </div>
                    <div style={{ padding: '10px 12px 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                      <div>
                        <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700 }}>{d.place}</div>
                        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', marginTop: 3 }}>
                          {formatDateRange(d.start, d.end)} · {d.nights} nights
                        </div>
                      </div>
                      <ChevronDownIcon size={16} color="var(--ink3)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--line)' }}>
                      {d.hotels.map((h) => (
                        <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0' }}>
                          <span style={{ width: 24, height: 24, borderRadius: 'var(--r-xs)', background: 'var(--card2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <BedIcon size={13} color="var(--ink2)" />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700 }}>{h.name}</div>
                            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--ink3)' }}>
                              {fmt(h.date)} · {h.nights} night{h.nights === 1 ? '' : 's'}
                            </div>
                          </div>
                          <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, flexShrink: 0 }}>{h.total != null ? `£${h.total}` : '—'}</div>
                        </div>
                      ))}
                      {d.hotels.length > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--line)' }}>
                          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', fontWeight: 600 }}>Total</span>
                          <span style={{ fontSize: 'var(--fs-small)', fontWeight: 600 }}>£{destTotal}</span>
                        </div>
                      )}
                      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--ink3)', marginTop: 8 }}>Other costs (transfers, activities) aren't tracked yet.</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// One card shape for every booking: a square badge in the airline's or
// hotel programme's colour, the name, and a line that says what it is (a
// plane and the flight number, or a moon for each night).
function BookingCard({ badge, title, sub, price }: { badge: { code: string; colour: string | null }; title: string; sub: React.ReactNode; price: number | null }) {
  return (
    <div className="bookcard">
      <span className="bookcard-badge" style={{ background: badge.colour ?? 'var(--ink)' }}>{badge.code}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="bookcard-title">{title}</span>
        <span className="bookcard-sub">{sub}</span>
      </span>
      {price != null && <span className="bookcard-price">{formatMoney(price)}</span>}
    </div>
  );
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-body)' }}>
      <span style={{ color: 'var(--ink2)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: valueColor }}>{value}</span>
    </div>
  );
}
