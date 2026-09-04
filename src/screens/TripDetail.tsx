import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips, useLoyaltyProgrammes, usePromotions } from '../lib/useLiveData';
import { uploadTripPhoto, fetchTripPhotos, splitTrip, deleteHotel, deleteFlight } from '../lib/queries';
import { SwipeToDelete } from '../components/SwipeToDelete';
import type { TripPhoto } from '../lib/queries';
import { BackIcon, CameraIcon, ChevronDownIcon, BedIcon, PlaneIcon, EditIcon } from '../components/Icons';
import { DestinationPhoto } from '../components/DestinationPhoto';
const TripMap = lazy(() => import('../components/TripMap').then((m) => ({ default: m.TripMap })));
import { destinationQuery } from '../components/TripCard';
import { TripMemories } from '../components/TripMemories';
import { formatDateRange, formatMoney } from '../lib/format';
import { computeTripPoints, computeTripSavings, groupDestinations, findGaps, suggestTripSplit } from '../lib/tripStats';
import { tripDayInfo } from '../lib/tripDay';

type Seg = 'overview' | 'itinerary' | 'expenses' | 'notes';

function fmt(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seg, setSeg] = useState<Seg>('overview');
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
          : 'Upload failed (unknown error — check browser console)';
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
        const checkOut = new Date(new Date(h.date + 'T00:00:00').getTime() + h.nights * 86400000).toISOString().slice(0, 10);
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
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div
        className="tdhero"
        style={heroImage ? { backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!heroImage && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <DestinationPhoto query={destinationQuery(trip)} seed={trip.id} height={340} />
          </div>
        )}
        <div className="grad" />
        <button className="tdback" onClick={() => navigate('/trips')}>
          <BackIcon size={18} color="#fff" />
        </button>
        <button
          className="tdback"
          style={{ left: 'auto', right: 64 }}
          onClick={() => navigate('/log-trip', { state: { trip } })}
        >
          <EditIcon size={17} color="#fff" />
        </button>
        <button
          className="tdback"
          style={{ left: 'auto', right: 16 }}
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? '…' : <CameraIcon size={18} color="#fff" />}
        </button>
        <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        <div className="tdtitle">
          <span className="tdbadge">{heroBadge}</span>
          <h1>{trip.title}</h1>
          <div className="s">{formatDateRange(trip.start, trip.end)}</div>
          {stayingNow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 12.5, fontWeight: 700, opacity: 0.95 }}>
              <BedIcon size={14} color="#fff" />
              {stayingNow.name}
            </div>
          )}
        </div>
      </div>

      {uploadError && <div style={{ padding: '8px 20px', color: 'var(--red)', fontSize: 12.5 }}>{uploadError}</div>}

      {(sortedHotels.length > 0 || sortedFlights.length > 0) && (
        <div style={{ padding: '18px 20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--brand)', marginBottom: 10 }}>Itinerary</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {legs.map((leg) =>
              leg.kind === 'hotel' ? (
                <div key={`h-${leg.data.id}`} onClick={() => navigate('/log-hotel', { state: { hotel: leg.data, tripId: trip.id } })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', cursor: 'pointer' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <BedIcon size={17} color="var(--ink2)" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leg.data.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2, fontWeight: 500 }}>{fmt(leg.data.date)} · {leg.data.nights} night{leg.data.nights === 1 ? '' : 's'}</div>
                  </div>
                  {leg.data.total != null && <div style={{ fontSize: 13, fontWeight: 800, flexShrink: 0 }}>£{leg.data.total}</div>}
                </div>
              ) : (
                <div key={`f-${leg.data.id}`} onClick={() => navigate('/log-flight', { state: { flight: leg.data, tripId: trip.id } })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', cursor: 'pointer' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--card2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <PlaneIcon size={17} color="var(--ink2)" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {leg.data.from} → {leg.data.to}
                      {leg.role && (
                        <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--brand)', background: 'rgba(30,58,143,.08)', borderRadius: 99, padding: '2px 7px' }}>
                          {leg.role}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2, fontWeight: 500 }}>
                      {fmt(leg.data.date)}{leg.data.airline ? ` · ${leg.data.airline}` : ''}{leg.data.flightNo ? ` ${leg.data.flightNo}` : ''} · {leg.data.cabin}
                    </div>
                  </div>
                  {leg.data.cost != null && <div style={{ fontSize: 13, fontWeight: 800, flexShrink: 0 }}>£{leg.data.cost}</div>}
                </div>
              )
            )}
          </div>
          {sortedFlights.length > 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 8 }}>Departure/arrival times aren't tracked yet — only the date.</div>
          )}
        </div>
      )}

      {(() => {
        const suggestion = suggestTripSplit(trip);
        if (!suggestion) return null;
        return (
          <div style={{ margin: '14px 20px 0', padding: '12px 14px', borderRadius: 14, background: 'rgba(156,95,8,.08)', border: '1px solid rgba(156,95,8,.25)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>This looks like two trips</div>
            <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 3 }}>
              A long gap and a country change between {suggestion.beforeCountry} and {suggestion.afterCountry} — want to split this into two separate trips?
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
              style={{ marginTop: 8, padding: '7px 14px', borderRadius: 99, border: 'none', background: 'var(--amber)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              {splitting ? 'Splitting…' : `Split at ${suggestion.splitDate}`}
            </button>
          </div>
        );
      })()}

      <div className="tdseg">
        {(['overview', 'itinerary', 'expenses', 'notes'] as Seg[]).map((k) => (
          <button key={k} className={seg === k ? 'won' : ''} onClick={() => setSeg(k)}>
            {k.charAt(0).toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>

      <div className="tdpane">
        {seg === 'overview' && (
          <>
            <div style={{ marginBottom: 14 }}>
              <Suspense fallback={<div style={{ height: 220, background: '#DCE7F5', borderRadius: 16 }} />}>
                <TripMap hotels={trip.hotels} flights={trip.flights} photos={tripPhotos} />
              </Suspense>
            </div>
            <div style={{ marginBottom: 14 }}>
              <TripMemories tripId={trip.id} />
            </div>
            <div className="card">
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Trip summary</div>
            <div style={{ display: 'grid', gap: 9 }}>
              <SummaryRow label="Total cash spent" value={formatMoney(spend)} />
              <SummaryRow label="Points earned" value={`${points.totalPoints.toLocaleString()} pts`} />
              <SummaryRow label="Value of points earned" value={formatMoney(points.totalValue)} />
              <SummaryRow label="Total savings" value={formatMoney(savings)} valueColor="var(--green)" />
              <SummaryRow label="Pence per point (earned)" value={points.totalPoints > 0 ? `${points.centsPerPoint.toFixed(2)}p` : '—'} />
            </div>
            {trip.flights.some((f) => f.award) && (
              <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 10 }}>
                This trip includes an award flight — points redeemed aren't tracked as a value yet.
              </div>
            )}
            </div>
          </>
        )}
        {seg === 'itinerary' && (
          <>
            {[...trip.hotels, ...trip.flights]
              .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
              .map((leg, i) => {
                const isHotel = 'name' in leg;
                return (
                  <SwipeToDelete
                    key={i}
                    wrapperStyle={{ borderRadius: 0, borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}
                    onClick={() =>
                      isHotel
                        ? navigate('/log-hotel', { state: { hotel: leg, tripId: trip.id } })
                        : navigate('/log-flight', { state: { flight: leg, tripId: trip.id } })
                    }
                    onDelete={async () => {
                      const label = isHotel ? (leg as typeof trip.hotels[number]).name : `this flight`;
                      if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
                      if (isHotel) await deleteHotel(leg.id);
                      else await deleteFlight(leg.id);
                      refetchTrips();
                    }}
                  >
                    <div className="itin" style={{ cursor: 'pointer' }}>
                      <span
                        style={{
                          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                          background: 'var(--card2)',
                          display: 'grid', placeItems: 'center',
                        }}
                      >
                        {isHotel ? <BedIcon size={14} color="var(--ink2)" /> : <PlaneIcon size={14} color="var(--ink2)" />}
                      </span>
                      <div className="line">
                        <div className="t">{isHotel ? leg.name : `${leg.from} → ${leg.to}`}</div>
                        <div className="s">{fmt(leg.date)}</div>
                      </div>
                    </div>
                  </SwipeToDelete>
                );
              })}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                onClick={() => navigate('/log-hotel', { state: { tripId: trip.id } })}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--ink)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                + Add hotel
              </button>
              <button
                onClick={() => navigate('/log-flight', { state: { tripId: trip.id } })}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card2)', color: 'var(--ink)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                + Add flight
              </button>
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
        {seg === 'notes' && <p style={{ fontSize: 13.5, color: 'var(--ink2)' }}>{trip.notes || 'No notes yet.'}</p>}
      </div>

      {gaps.length > 0 && (
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
                  padding: '12px 14px', borderRadius: 12, background: 'rgba(156,95,8,.08)', border: '1px solid rgba(156,95,8,.2)',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>
                    {formatDateRange(g.start, g.end)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
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
                    flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: 'none',
                    background: 'var(--amber)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
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
                <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div
                    style={{ display: 'flex', gap: 12, cursor: 'pointer' }}
                    onClick={() => setExpandedDest(isOpen ? null : i)}
                  >
                    <div style={{ width: 90, flexShrink: 0 }}>
                      <DestinationPhoto query={d.place} seed={`${trip.id}-${d.place}`} height={90} />
                    </div>
                    <div style={{ padding: '10px 12px 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{d.place}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 3 }}>
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
                          <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--card2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <BedIcon size={13} color="var(--ink2)" />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{h.name}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--ink3)' }}>
                              {fmt(h.date)} · {h.nights} night{h.nights === 1 ? '' : 's'}
                            </div>
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>{h.total != null ? `£${h.total}` : '—'}</div>
                        </div>
                      ))}
                      {d.hotels.length > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--line)' }}>
                          <span style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 600 }}>Total</span>
                          <span style={{ fontSize: 12.5, fontWeight: 800 }}>£{destTotal}</span>
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 8 }}>Other costs (transfers, activities) aren't tracked yet.</div>
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

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--ink2)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: valueColor }}>{value}</span>
    </div>
  );
}
