import { Fragment, useState, useEffect, useRef, Suspense } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { wasDeleted } from '../lib/deleted';
import { useTrips, useLoyaltyProgrammes, usePromotions, useAllHotels } from '../lib/useLiveData';
import { uploadTripPhoto, fetchTripPhotos, splitTrip, deleteHotel, deleteFlight } from '../lib/queries';
import { SwipeToDelete } from '../components/SwipeToDelete';
import type { TripPhoto } from '../lib/queries';
import { BackIcon, CameraIcon, BedIcon, EditIcon, AlertIcon, MoonIcon, PlaneIcon } from '../components/Icons';
import { airlineBadge } from '../data/airlineBrand';
import { hotelBadge } from '../lib/bookingBadge';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { DestinationPhoto } from '../components/DestinationPhoto';
const TripMap = lazyWithRetry(() => import('../components/TripMap').then((m) => ({ default: m.TripMap })));
import { destinationQuery } from '../lib/tripHotels';
import { TripMemories } from '../components/TripMemories';
import { formatDateRange, formatMoney, weekdayDay } from '../lib/format';
import { tripPointsLines, groupDestinations, findGaps, suggestTripSplit } from '../lib/tripStats';
import { creditPick, flightMiles, tiersFrom } from '../lib/flightCredit';
import { promosToRegister, dayMonthShort } from '../lib/today';
import { countdownLabel, daysUntil } from '../lib/tripTimeline';
import { useGlobalAirports } from '../lib/useGlobalAirports';
import { AIRPORTS } from '../data/airports';
import { tripDayInfo, addDays } from '../lib/tripDay';
import { checkTripCompleteness, flightSearchUrl, returnFlightSearchUrl } from '../lib/tripCompleteness';
import { useTripFlightGaps } from '../lib/useTripFlightGaps';
import { Button, EmptyState, ErrorText, Eyebrow, Notice, PhotoHero, ScreenHeader, SectionLabel } from '../components/ui';

export function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState<'itinerary' | 'map'>('itinerary');
  const { data: trips, refetch: refetchTrips } = useTrips();
  const { data: allHotels } = useAllHotels();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: promotions } = usePromotions();
  const airports = useGlobalAirports();
  const trip = trips.find((t) => t.id === id);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

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
  const flightGaps = useTripFlightGaps(trips, new Date().toISOString().slice(0, 10));

  // A trip deleted this session moves on to the list; one not loaded yet
  // (just created) waits on the same page.
  if (!trip) return wasDeleted('trip', id ?? '') ? <Navigate to="/trips" replace /> : <div><ScreenHeader title="Trip" /><EmptyState>Not found</EmptyState></div>;

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

  const stayCost = trip.hotels.reduce((s, h) => s + (h.total ?? 0), 0);
  const flightCost = trip.flights.reduce((s, f) => s + (f.cost ?? 0), 0);
  const unpricedFlights = trip.flights.filter((f) => f.cost == null && !f.award);
  const upcoming = trip.start > new Date().toISOString().slice(0, 10);
  const pointLines = tripPointsLines(trip, loyaltyProgrammes, promotions, allHotels, upcoming);
  const totalPoints = pointLines.reduce((s, l) => s + l.points, 0);
  const toRegister = promosToRegister(promotions, allHotels, new Date().toISOString().slice(0, 10), trip.hotels);
  // Status nights this trip adds, per programme working toward a tier.
  const statusNights = loyaltyProgrammes
    .filter((p) => p.category === 'hotel' && p.nextTier)
    .map((p) => ({ name: p.name, nights: trip.hotels.filter((h) => h.brand === p.name && !h.award && (upcoming ? h.status !== 'needs-confirm' : h.status === 'Completed')).reduce((n, h) => n + h.nights, 0) }))
    .filter((x) => x.nights > 0);

  // Where each flight earns most (the crediting advisor, on the flight).
  const locate = (iata: string) => airports?.get(iata) ?? AIRPORTS[iata] ?? null;
  const tiers = tiersFrom(loyaltyProgrammes);
  const creditFor = (f: (typeof trip.flights)[number]) =>
    creditPick(f, flightMiles(f, locate), tiers, airports?.get(f.from.trim().toUpperCase())?.country === 'United Kingdom');
  const destinations = groupDestinations(trip);
  const gaps = findGaps(trip);

  const TODAY = new Date().toISOString().slice(0, 10);
  const heroBadge =
    trip.section === 'current'
      ? (() => { const d = tripDayInfo(trip, TODAY); return `Current trip · Day ${d.dayIndex} of ${d.totalDays}`; })()
      : trip.section === 'upcoming'
      // Whole calendar days, as Today and Trips count them: rounding the
      // milliseconds to the start said "6 days" on the afternoon Today said 7.
      ? `Upcoming · ${countdownLabel(TODAY, trip.start).toLowerCase()}${daysUntil(TODAY, trip.start) > 1 ? ' to go' : ''}`
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

  // The same check Today and Trips use, so all three agree.
  const flightGap = flightGaps.get(trip.id) ?? null;
  const tripGap = checkTripCompleteness(trip);
  const gapDestination = trip.title.split(/[·+]/)[0].trim();
  const gapDateOut = sortedHotels[0]?.date;
  const gapDateBack = sortedHotels.length ? (() => {
    const last = sortedHotels[sortedHotels.length - 1];
    return addDays(last.date, last.nights);
  })() : undefined;
  const searchUrl = !tripGap ? null
    : tripGap.missingOutbound && gapDateOut ? flightSearchUrl(gapDestination, gapDateOut, tripGap.missingReturn ? gapDateBack : undefined)
    : tripGap.missingReturn && gapDateBack ? returnFlightSearchUrl(gapDestination, gapDateBack)
    : null;

  return (
    <div>
      <PhotoHero
        scrim="dissolve" height={380}
        src={heroImage}
        fallback={<DestinationPhoto query={destinationQuery(trip)} seed={trip.id} height={380} />}
      >
        <button className="tdback" aria-label="Back" onClick={() => (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0 ? navigate(-1) : navigate('/trips', { replace: true }))}>
          <BackIcon size={18} color="var(--on-dark)" />
        </button>
        <button
          className="tdback"
          style={{ left: 'auto', right: 64 }}
          aria-label="Edit trip"
          onClick={() => navigate('/log-trip', { state: { trip, back: true } })}
        >
          <EditIcon size={17} color="var(--on-dark)" />
        </button>
        <button
          className="tdback"
          style={{ left: 'auto', right: 16 }}
          aria-label="Add a cover photo"
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

      {flightGap && (
        <div style={{ padding: '18px 20px 0' }}>
          <Notice
            icon={<AlertIcon size={18} />} title={flightGap}
            action={<>
              {searchUrl && <a className="tagbtn" href={searchUrl} target="_blank" rel="noreferrer">Search</a>}
              <button className="tagbtn on" onClick={() => navigate('/log-flight', { state: { tripId: trip.id, back: true } })}>Add</button>
            </>}
          />
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
                // A note where the trip moves somewhere new, to break the
                // itinerary into places (only when there's more than one).
                const arrival = destinations.length > 1 && leg.kind === 'hotel'
                  ? destinations.find((d) => d.hotels[0]?.id === leg.data.id) ?? null
                  : null;
                return (
                  <Fragment key={`${leg.kind}-${leg.data.id}`}>
                  {arrival && (
                    <div className="itin2-row">
                      <span />
                      <span />
                      <span className="destnote">{arrival.place} · {arrival.nights} night{arrival.nights === 1 ? '' : 's'}</span>
                    </div>
                  )}
                  <div className="itin2-row">
                    <span className="itin2-day">{newDay && wd ? <>{wd.weekday}<br />{wd.day}</> : null}</span>
                    <span className={newDay ? 'itin2-dot' : 'itin2-dot ghost'} />
                    {leg.kind === 'hotel' ? (
                      <SwipeToDelete
                        itemLabel={leg.data.name} surface="var(--bg)" wrapperStyle={{ borderRadius: 'var(--r-md)' }}
                        onClick={() => navigate('/log-hotel', { state: { hotel: leg.data, tripId: trip.id, back: true } })}
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
                            {leg.data.nights} night{leg.data.nights === 1 ? '' : 's'}{leg.data.brand && !['Independent', 'Other'].includes(leg.data.brand) ? ` · ${leg.data.brand}` : ''}
                          </>}
                        />
                      </SwipeToDelete>
                    ) : (
                      <SwipeToDelete
                        itemLabel={`${leg.data.from} → ${leg.data.to}`} surface="var(--bg)" wrapperStyle={{ borderRadius: 'var(--r-md)' }}
                        onClick={() => navigate('/log-flight', { state: { flight: leg.data, tripId: trip.id, back: true } })}
                        onDelete={() => removeLeg('flight', leg.data.id)}
                      >
                        <BookingCard
                          badge={airlineBadge(leg.data.flightNo, leg.data.airline)}
                          title={`${leg.data.from}${leg.data.departureTime ? ` ${leg.data.departureTime}` : ''} → ${leg.data.to}${leg.data.arrivalTime ? ` ${leg.data.arrivalTime}` : ''}`}
                          price={leg.data.cost}
                          sub={<>
                            <PlaneIcon size={13} />
                            {[leg.data.flightNo, leg.data.via.length ? `via ${leg.data.via.join(', ')}` : null, leg.data.award ? `${leg.data.cabin} award` : leg.data.cabin !== 'Economy' ? leg.data.cabin : null].filter(Boolean).join(' · ')}
                          </>}
                          extra={(() => {
                            const pick = creditFor(leg.data);
                            if (!pick) return null;
                            const flight = leg.data;
                            return (
                              <button className="creditchip" onClick={(e) => { e.stopPropagation(); navigate('/credit', { state: { flight, miles: flightMiles(flight, locate) } }); }}>
                                Credit to {pick.label}<span>~{pick.amount.toLocaleString()} {pick.unit}</span>
                              </button>
                            );
                          })()}
                        />
                      </SwipeToDelete>
                    )}
                  </div>
                  </Fragment>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Button variant="secondary" small style={{ flex: 1 }} onClick={() => navigate('/log-hotel', { state: { tripId: trip.id, back: true } })}>Add stay</Button>
              <Button variant="secondary" small style={{ flex: 1 }} onClick={() => navigate('/log-flight', { state: { tripId: trip.id, back: true } })}>Add flight</Button>
            </div>
          </>
        )}
      </div>

      {(() => {
        const suggestion = suggestTripSplit(trip);
        if (!suggestion) return null;
        return (
          <div style={{ padding: '14px 20px 0' }}>
            <Notice
              icon={<AlertIcon size={18} />} title="Looks like two trips"
              action={(
                <button
                  className="tagbtn" disabled={splitting}
                  onClick={async () => {
                    setSplitting(true);
                    try {
                      const newId = await splitTrip(trip.id, suggestion.splitDate, suggestion.afterCountry, trip.end, trip.tripType);
                      navigate(`/trips/${newId}`, { replace: true });
                    } catch {
                      setSplitting(false);
                    }
                  }}
                >
                  {splitting ? 'Splitting…' : 'Split'}
                </button>
              )}
            >
              {suggestion.beforeCountry} and {suggestion.afterCountry}, split at {dayMonthShort(suggestion.splitDate)}
            </Notice>
          </div>
        );
      })()}

      <div className="page-body" style={{ paddingTop: 20 }}>
        {totalPoints > 0 && (
          <section className="listcard pad">
            <div className="sectionhead">
              <SectionLabel>{upcoming ? 'Points to earn' : 'Points earned'}</SectionLabel>
              <span className="figure big">{upcoming ? '~' : ''}{totalPoints.toLocaleString()}</span>
            </div>
            <div className="lines">
              {pointLines.map((l) => {
                const reg = l.key === 'promos' ? toRegister[0] : null;
                return (
                  <div key={l.key} className="line">
                    <span>{l.label}{reg && <span className="line-note">Register by {dayMonthShort(reg.deadline)}</span>}</span>
                    <span className="figure">{l.points.toLocaleString()}</span>
                  </div>
                );
              })}
              {statusNights.map((x) => (
                <div key={x.name} className="line">
                  <span>{x.name} nights</span>
                  <span className="figure">+{x.nights}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(stayCost > 0 || flightCost > 0 || unpricedFlights.length > 0) && (
          <section className="listcard pad">
            <div className="sectionhead">
              <SectionLabel>Cost</SectionLabel>
              <span className="figure big">{formatMoney(stayCost + flightCost)}</span>
            </div>
            <div className="lines">
              {stayCost > 0 && <div className="line"><span>Stays</span><span>{formatMoney(stayCost)}</span></div>}
              {flightCost > 0 && <div className="line"><span>Flights</span><span>{formatMoney(flightCost)}</span></div>}
              {unpricedFlights.map((f) => (
                <div key={f.id} className="line">
                  <span>{f.flightNo ?? `${f.from} → ${f.to}`}</span>
                  <button className="linkbtn" onClick={() => navigate('/log-flight', { state: { flight: f, tripId: trip.id, back: true } })}>Add price</button>
                </div>
              ))}
            </div>
          </section>
        )}

        <TripMemories tripId={trip.id} />
        {trip.notes && (
          <section>
            <SectionLabel>Notes</SectionLabel>
            <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', margin: 0, lineHeight: 1.5 }}>{trip.notes}</p>
          </section>
        )}
      </div>

      {trip.tripType === 'leisure' && gaps.length > 0 && (
        <section style={{ display: 'grid', gap: 10, padding: '0 20px 20px' }}>
          <SectionLabel>Nights not booked</SectionLabel>
          {gaps.map((g, i) => {
            const before = [...destinations].reverse().find((d) => d.end <= g.start);
            const guessedCountry = (before ?? destinations[0])?.hotels[0]?.country ?? '';
            return (
              <Notice
                key={i} icon={<MoonIcon size={16} />} title={formatDateRange(g.start, g.end)}
                action={(
                  <button className="tagbtn on" onClick={() => navigate('/log-hotel', { state: { tripId: trip.id, back: true, prefill: { date: g.start, nights: g.nights, country: guessedCountry } } })}>
                    Add
                  </button>
                )}
              >
                {g.nights} night{g.nights === 1 ? '' : 's'}
              </Notice>
            );
          })}
        </section>
      )}

    </div>
  );
}

// One card shape for every booking: a square badge in the airline's or
// hotel programme's colour, the name, and a line that says what it is (a
// plane and the flight number, or a moon for each night).
function BookingCard({ badge, title, sub, price, extra }: { badge: { code: string; colour: string | null }; title: string; sub: React.ReactNode; price: number | null; extra?: React.ReactNode }) {
  return (
    <div className="bookcard">
      <span className="bookcard-badge" style={{ background: badge.colour ?? 'var(--ink)' }}>{badge.code}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="bookcard-title">{title}</span>
        <span className="bookcard-sub">{sub}</span>
      </span>
      {price != null && <span className="bookcard-price">{formatMoney(price)}</span>}
      {extra && <span className="bookcard-extra">{extra}</span>}
    </div>
  );
}
