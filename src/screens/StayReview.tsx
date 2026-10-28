import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAllHotels, useReviewPhotos, useReviews } from '../lib/useLiveData';
import { propertyKey, propertyReview, scoreColour, aspectPhoto, distinctPhotos, photoAspects } from '../lib/reviewSummary';
import { addReviewPhoto, deleteReviewPhoto, setReviewPhotoAspects, updateReviewNote } from '../lib/queries';
import { sortPhotos } from '../lib/photoSort';
import { monthYear } from '../lib/format';
import { Button, EmptyState, ErrorText, PhotoHero, ScreenHeader } from '../components/ui';
import { PhotoStrip, PhotoViewer } from '../components/ReviewPhotos';
import type { ReviewPhoto } from '../types';

// One hotel's review: its score in each aspect over every visit, the
// latest note, and photos of each aspect. Photos are added once, at the
// top, and sorted into the aspects they show; a photo's tags in the viewer
// move it between aspects.
export function StayReview() {
  const navigate = useNavigate();
  const { name = '' } = useParams();
  const { data: reviews } = useReviews();
  const { data: photos } = useReviewPhotos();
  const { data: hotels } = useAllHotels();
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  // Which photos the viewer pages through: one aspect's, or (null) all.
  const [viewing, setViewing] = useState<{ aspect: string | null; index: number } | null>(null);
  const [error, setError] = useState('');

  const review = propertyReview(name, reviews, photos);
  if (!review) return <div><ScreenHeader title="Review" /><EmptyState>Not found</EmptyState></div>;

  // The latest completed stay: what a new photo is filed against, and
  // what "Review again" rates.
  const lastStay = hotels
    .filter((h) => h.status === 'Completed' && propertyKey(h.name) === propertyKey(review.hotelName))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const cover = aspectPhoto(photos, review.hotelName, 'overall');
  const all = [review.overall, ...review.aspects];
  const everyPhoto = distinctPhotos(photos, review.hotelName);
  const viewList = viewing ? (viewing.aspect ? all.find((a) => a.key === viewing.aspect)?.photos ?? [] : everyPhoto) : [];

  // Sorted first; any that can't be go under Overall, to be moved by hand.
  async function add(files: File[]) {
    setError('');
    setUploading({ done: 0, total: files.length });
    try {
      let sorted = files.map(() => ['overall']);
      try {
        sorted = await sortPhotos(files);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Photos not sorted');
      }
      for (const [i, file] of files.entries()) {
        await addReviewPhoto(review!.hotelName, lastStay?.id ?? null, sorted[i], file);
        setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo not saved');
    } finally {
      setUploading(null);
    }
  }

  async function toggle(photo: ReviewPhoto, key: string) {
    const current = photoAspects(photos, photo.path);
    const next = current.includes(key) ? current.filter((a) => a !== key) : [...current, key];
    setError('');
    try {
      await setReviewPhotoAspects(photo, current, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo not moved');
    }
  }

  async function remove(photo: ReviewPhoto) {
    setError('');
    try {
      await deleteReviewPhoto(photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo not deleted');
    }
  }

  return (
    <div style={{ paddingBottom: 'var(--s7)' }}>
      <ScreenHeader title={review.hotelName} sub={review.country || undefined} />
      <div className="stack">
        {cover && (
          <PhotoHero src={cover.url} height={220} rounded scrim="bottom" onClick={() => setViewing({ aspect: null, index: everyPhoto.findIndex((p) => p.path === cover.path) })}>
            {review.overall.score != null && (
              <div style={{ marginTop: 'auto', padding: 'var(--s4)' }}>
                <span className="figure big">{review.overall.score.toFixed(1)}</span>
              </div>
            )}
          </PhotoHero>
        )}
        {!cover && review.overall.score != null && (
          <div className="figure big" style={{ color: scoreColour(review.overall.score) }}>{review.overall.score.toFixed(1)}</div>
        )}
        {review.visits.length > 0 && (
          <div className="rowsub">{review.visits.map(monthYear).join(' · ')}</div>
        )}
        <PhotoStrip
          label={review.hotelName}
          photos={everyPhoto}
          busy={uploading ? `${uploading.done}/${uploading.total}` : null}
          onAdd={uploading ? undefined : add}
          onOpen={(index) => setViewing({ aspect: null, index })}
        />
        {error && <ErrorText>{error}</ErrorText>}

        <div className="listcard">
          {all.map((a) => (
            <div key={a.key} className="aspectrow">
              <div className="aspectrow-head">
                <span className="rowtitle display">{a.label}</span>
                {a.score != null
                  ? <span className="figure" style={{ fontSize: 'var(--fs-title)', color: scoreColour(a.score) }}>{a.score.toFixed(1)}</span>
                  : <span className="rowsub">Not rated</span>}
              </div>
              {a.noteReviewId && <NoteLine key={`${a.noteReviewId}:${a.note ?? ''}`} note={a.note} reviewId={a.noteReviewId} onError={setError} />}
              <PhotoStrip
                label={a.label}
                photos={a.photos}
                onOpen={(index) => setViewing({ aspect: a.key, index })}
              />
            </div>
          ))}
        </div>

        {lastStay && (
          <Button
            variant="secondary" block
            onClick={() => navigate('/review-trip', { state: { back: true, hotel: { tripId: '', tripTitle: '', hotelId: lastStay.id, hotelName: lastStay.name, country: lastStay.country, date: lastStay.date } } })}
          >
            Review again
          </Button>
        )}
      </div>

      {viewing && (
        <PhotoViewer
          // Follows the live list, so a deleted or moved photo drops out of view.
          photos={viewList}
          start={viewing.index}
          title={`${review.hotelName}${viewing.aspect ? ` · ${all.find((a) => a.key === viewing.aspect)?.label ?? ''}` : ''}`}
          onClose={() => setViewing(null)}
          onDelete={(p) => remove(p as ReviewPhoto)}
          aspects={{ of: (p) => photoAspects(photos, (p as ReviewPhoto).path), toggle: (p, key) => toggle(p as ReviewPhoto, key) }}
        />
      )}
    </div>
  );
}

// The latest visit's note for an aspect: tap to write or change it, saved
// when you leave the box.
function NoteLine({ note, reviewId, onError }: { note: string | null; reviewId: string; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (text.trim() === (note ?? '')) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateReviewNote(reviewId, text);
      setEditing(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Note not saved');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <textarea
        className="input" rows={2} autoFocus value={text} disabled={saving} aria-label="Note"
        onChange={(e) => setText(e.target.value)} onBlur={save}
      />
    );
  }
  return note
    ? <button type="button" className="notebtn" onClick={() => setEditing(true)}>{note}</button>
    : <button type="button" className="tagbtn" style={{ justifySelf: 'start' }} onClick={() => setEditing(true)}>Add note</button>;
}
