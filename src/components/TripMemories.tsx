import { useState, useEffect, useRef } from 'react';
import { fetchTripPhotos, addTripPhoto, deleteTripPhoto, type TripPhoto } from '../lib/queries';
import { CameraIcon, PinIcon } from './Icons';

interface ExtractedMeta {
  lat: number | null;
  lng: number | null;
  takenAt: string | null;
}

/* Reads GPS coordinates and capture timestamp directly from a photo's own
   EXIF metadata, entirely client-side -- no upload needed just to inspect
   it. Many phones strip GPS tags by default or the user may have location
   tagging off, so both fields are treated as optional throughout rather
   than assumed present. exifr is loaded on demand here rather than at the
   top of the file, since most page loads never touch it. */
async function extractExif(file: File): Promise<ExtractedMeta> {
  try {
    const exifr = (await import('exifr')).default;
    const data = await exifr.parse(file, { gps: true });
    const lat = typeof data?.latitude === 'number' ? data.latitude : null;
    const lng = typeof data?.longitude === 'number' ? data.longitude : null;
    const rawDate = data?.DateTimeOriginal ?? data?.CreateDate ?? null;
    const takenAt = rawDate instanceof Date ? rawDate.toISOString() : null;
    return { lat, lng, takenAt };
  } catch {
    // A photo with no/corrupt EXIF shouldn't block the upload -- it just
    // won't be placed on the map or ordered by real capture time.
    return { lat: null, lng: null, takenAt: null };
  }
}

export function TripMemories({ tripId }: { tripId: string }) {
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTripPhotos(tripId)
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, [tripId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    const fileArray = Array.from(files);
    setUploadProgress({ done: 0, total: fileArray.length });

    const newPhotos: TripPhoto[] = [];
    for (const file of fileArray) {
      try {
        const meta = await extractExif(file);
        const photo = await addTripPhoto(tripId, file, meta.lat, meta.lng, meta.takenAt);
        newPhotos.push(photo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'One or more photos failed to upload');
      }
      setUploadProgress((p) => (p ? { ...p, done: p.done + 1 } : null));
    }

    setPhotos((prev) => [...prev, ...newPhotos].sort((a, b) => (a.takenAt ?? '').localeCompare(b.takenAt ?? '')));
    setUploading(false);
    setUploadProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleDelete(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id)); // optimistic
    try {
      await deleteTripPhoto(id);
    } catch {
      fetchTripPhotos(tripId).then(setPhotos); // roll back on failure
    }
  }

  const geotaggedCount = photos.filter((p) => p.lat != null && p.lng != null).length;

  if (loading) return null;

  return (
    <div>
      <div className="sect" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>Memories</h2>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <CameraIcon size={14} color="var(--brand)" />
          {uploading ? `Uploading ${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? 0}…` : 'Add photos'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {error && (
        <div style={{ padding: '0 20px 8px', fontSize: 12, color: 'var(--red)' }}>{error}</div>
      )}

      {photos.length === 0 ? (
        <div style={{ padding: '4px 20px 16px', fontSize: 12.5, color: 'var(--ink3)' }}>
          No photos added yet. Photos with location data will automatically appear on the trip map.
        </div>
      ) : (
        <div className="stack">
          {geotaggedCount > 0 && geotaggedCount < photos.length && (
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginBottom: 8 }}>
              {geotaggedCount} of {photos.length} photos have location data and will show on the map.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--card2)' }}>
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {p.lat != null && (
                  <div style={{ position: 'absolute', bottom: 3, left: 3, background: 'rgba(0,0,0,.55)', borderRadius: 6, padding: '3px 5px', display: 'flex', alignItems: 'center' }}>
                    <PinIcon size={10} color="#fff" />
                  </div>
                )}
                <button
                  onClick={() => handleDelete(p.id)}
                  style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
