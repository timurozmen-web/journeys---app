import { useState, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips, useLoyaltyProgrammes, usePromotions } from '../lib/useLiveData';
import { uploadTripPhoto } from '../lib/queries';
import { BackIcon, CameraIcon, ChevronDownIcon, BedIcon, PlaneIcon, EditIcon } from '../components/Icons';
import { DestinationPhoto } from '../components/DestinationPhoto';
const TripMap = lazy(() => import('../components/TripMap').then((m) => ({ default: m.TripMap })));
import { destinationQuery } from '../components/TripCard';
import { formatDateRange, formatMoney } from '../lib/format';
import { computeTripPoints, computeTripSavings, groupDestinations, findGaps } from '../lib/tripStats';

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
  const { data: trips } = useTrips();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: promotions } = usePromotions();
  const trip = trips.find((t) => t.id === id);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const [expandedDest, setExpandedDest] = useState<number | null>(null);

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
  const nights = trip.hotels.reduce((s, h) => s + h.nights, 0);
  const points = computeTripPoints(trip, loyaltyProgrammes, promotions);
  const savings = computeTripSavings(trip);
  const destinations = groupDestinations(trip);
  const gaps = findGaps(trip);

  return (
    <div>
      <div
        className="tdhero"
        style={heroImage ? { backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {!heroImage && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <DestinationPhoto query={destinationQuery(trip)} seed={trip.id} height={220} />
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
          <h1>{trip.title}</h1>
          <div className="s">{formatDateRange(trip.start, trip.end)}</div>
        </div>
      </div>

      {uploadError && <div style={{ padding: '8px 20px', color: 'var(--red)', fontSize: 12.5 }}>{uploadError}</div>}

      <div className="tdstats">
        <div className="tdstat">
          <div className="v">£{Math.round(spend).toLocaleString()}</div>
          <div className="k">spent</div>
        </div>
        <div className="tdstat">
          <div className="v">{points.totalPoints.toLocaleString()}</div>
          <div className="k">pts earned</div>
        </div>
        <div className="tdstat">
          <div className="v">£{Math.round(savings).toLocaleString()}</div>
          <div className="k">saved</div>
        </div>
        <div className="tdstat">
          <div className="v">{nights}</div>
          <div className="k">nights</div>
        </div>
      </div>

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
                <TripMap hotels={trip.hotels} flights={trip.flights} />
              </Suspense>
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
                  <div
                    className="itin"
                    key={i}
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      isHotel
                        ? navigate('/log-hotel', { state: { hotel: leg, tripId: trip.id } })
                        : navigate('/log-flight', { state: { flight: leg, tripId: trip.id } })
                    }
                  >
                    <span
                      style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        background: isHotel ? 'rgba(12,122,66,.1)' : 'rgba(19,34,71,.08)',
                        display: 'grid', placeItems: 'center',
                      }}
                    >
                      {isHotel ? <BedIcon size={14} color="#0C7A42" /> : <PlaneIcon size={14} color="var(--brand)" />}
                    </span>
                    <div className="line">
                      <div className="t">{isHotel ? leg.name : `${leg.from} → ${leg.to}`}</div>
                      <div className="s">{fmt(leg.date)}</div>
                    </div>
                  </div>
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
                          <span style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(12,122,66,.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <BedIcon size={13} color="#0C7A42" />
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
