import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrips } from '../lib/useLiveData';
import { uploadTripPhoto } from '../lib/queries';
import { BackIcon } from '../components/Icons';

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
  const trip = trips.find((t) => t.id === id);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

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

  return (
    <div>
      <div
        className="tdhero"
        style={
          heroImage
            ? { backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: 'linear-gradient(135deg,#132247,#3A4C82)' }
        }
      >
        <div className="grad" />
        <button className="tdback" onClick={() => navigate('/trips')}>
          <BackIcon size={18} color="#fff" />
        </button>
        <button
          className="tdback"
          style={{ left: 'auto', right: 16 }}
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? '…' : '📷'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <div className="tdtitle">
          <h1>{trip.title}</h1>
          <div className="s">
            {fmt(trip.start)} – {fmt(trip.end)}
          </div>
        </div>
      </div>

      {uploadError && (
        <div style={{ padding: '8px 20px', color: 'var(--red)', fontSize: 12.5 }}>{uploadError}</div>
      )}

      <div className="tdstats">
        <div className="tdstat">
          <div className="v">£{spend}</div>
          <div className="k">spent</div>
        </div>
        <div className="tdstat">
          <div className="v">{nights}</div>
          <div className="k">nights</div>
        </div>
        <div className="tdstat">
          <div className="v">{trip.hotels.length}</div>
          <div className="k">hotels</div>
        </div>
        <div className="tdstat">
          <div className="v">{trip.flights.length}</div>
          <div className="k">flights</div>
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
          <p style={{ fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.6 }}>
            Real spend, nights and leg counts above — computed from the trip's own hotels and flights, not hardcoded.
          </p>
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
                    <span className="dot" style={{ background: isHotel ? '#0C7A42' : '#132247' }} />
                    <div className="line">
                      <div className="t">{isHotel ? leg.name : `${leg.from} → ${leg.to}`}</div>
                      <div className="s">{fmt(leg.date)}</div>
                    </div>
                  </div>
                );
              })}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, marginBottom: 100 }}>
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
    </div>
  );
}
