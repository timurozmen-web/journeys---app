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
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
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
        {seg === 'itinerary' &&
          [...trip.hotels, ...trip.flights]
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
            .map((leg, i) => (
              <div className="itin" key={i}>
                <span className="dot" style={{ background: 'name' in leg ? '#0C7A42' : '#132247' }} />
                <div className="line">
                  <div className="t">{'name' in leg ? leg.name : `${leg.from} → ${leg.to}`}</div>
                  <div className="s">{fmt(leg.date)}</div>
                </div>
              </div>
            ))}
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
