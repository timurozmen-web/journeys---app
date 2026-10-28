import { useEffect, useRef, useState } from 'react';
import { useFinish } from '../lib/useFinish';
import { useNavigate, useLocation } from 'react-router-dom';
import { addReview, addReviewPhoto } from '../lib/queries';
import { withOfflineFallback } from '../lib/offlineQueue';
import { useReviewPhotos, useReviews } from '../lib/useLiveData';
import { REVIEW_CATEGORIES, type HotelNeedingReview } from '../lib/reviewScoring';
import { aspectPhoto } from '../lib/reviewSummary';
import { sortPhotos } from '../lib/photoSort';
import { narrowRange, pickComparisonCandidate, placedScore, sameScore, type RankedItem } from '../lib/reviewRanking';
import { Button, ErrorText, ScreenHeader } from '../components/ui';
import { PhotoStrip, PhotoViewer } from '../components/ReviewPhotos';
import { ScorePicker } from '../components/ScorePicker';

// A photo picked for this review: sorted into aspects as soon as it's
// added, uploaded when the review is saved.
interface StagedPhoto { id: string; file: File; url: string; aspects: string[] }

// One aspect being placed among the stays given the same score.
interface Placing {
  key: string;
  label: string;
  score: number;
  sorted: RankedItem[];
  lo: number;
  hi: number;
  history: { lo: number; hi: number }[];
}

// Rating a stay: every aspect scored out of 10 on one page, photos added
// once and sorted into the aspects they show, then "which was better?"
// only where another stay has the same score in that aspect.
export function ReviewTrip() {
  const navigate = useNavigate();
  const finish = useFinish();
  const location = useLocation();
  const state = location.state as { hotel?: HotelNeedingReview; onlyCategories?: string[] } | null;
  const hotel = state?.hotel;
  const { data: allReviews } = useReviews();
  const { data: allPhotos } = useReviewPhotos();
  const categories = state?.onlyCategories ? REVIEW_CATEGORIES.filter((c) => state.onlyCategories!.includes(c.key)) : REVIEW_CATEGORIES;

  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [sorting, setSorting] = useState(false);
  const [viewing, setViewing] = useState<{ aspect: string | null; index: number } | null>(null);
  // The comparisons under way (null on the scoring page), and the stored
  // score each placed aspect came out at.
  const [placings, setPlacings] = useState<{ list: Placing[]; at: number } | null>(null);
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Set once the scores are saved: if a photo upload then fails, Save
  // tries the photos again without saving the scores twice.
  const [scoresSaved, setScoresSaved] = useState(false);
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (!hotel) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: 'var(--ink3)', fontSize: 'var(--fs-body)' }}>No stay selected to review.</p>
        <button onClick={() => navigate('/', { replace: true })} className="linkbtn">
          Back to Today
        </button>
      </div>
    );
  }

  const scored = categories.filter((c) => scores[c.key] != null);

  // The aspects still to place: scored, not placed yet, and sharing their
  // score with another stay in that aspect.
  function toPlace(): Placing[] {
    return scored
      .filter((c) => placed[c.key] == null)
      .map((c) => {
        const existing = allReviews.filter((r) => r.category === c.key).map((r) => ({ hotelName: r.hotelName, score: r.score }));
        const sorted = sameScore(scores[c.key]!, existing, hotel!.hotelName);
        return { key: c.key, label: c.label, score: scores[c.key]!, sorted, lo: 0, hi: sorted.length, history: [] };
      })
      .filter((p) => p.sorted.length > 0);
  }

  function setScore(key: string, n: number | null) {
    setScores((s) => ({ ...s, [key]: n }));
    // A changed score is placed afresh.
    setPlaced((p) => { const next = { ...p }; delete next[key]; return next; });
  }

  async function addPhotos(files: File[]) {
    setError('');
    const staged = files.map((file) => {
      const url = URL.createObjectURL(file);
      previews.current.push(url);
      return { id: url, file, url, aspects: [] as string[] };
    });
    setPhotos((prev) => [...prev, ...staged]);
    setSorting(true);
    try {
      const sorted = await sortPhotos(files);
      setPhotos((prev) => prev.map((p) => { const i = staged.findIndex((s) => s.id === p.id); return i >= 0 ? { ...p, aspects: sorted[i] } : p; }));
    } catch (err) {
      // Unsorted photos wait under Overall, to be moved by hand.
      setPhotos((prev) => prev.map((p) => (staged.some((s) => s.id === p.id) ? { ...p, aspects: ['overall'] } : p)));
      setError(err instanceof Error ? err.message : 'Photos not sorted');
    } finally {
      setSorting(false);
    }
  }

  function toggleAspect(id: string, key: string) {
    setPhotos((prev) => prev.map((p) => (p.id !== id ? p : { ...p, aspects: p.aspects.includes(key) ? p.aspects.filter((a) => a !== key) : [...p.aspects, key] })));
  }

  function next() {
    const list = toPlace();
    if (list.length === 0) { save(placed); return; }
    setPlacings({ list, at: 0 });
    // The comparison opened where the long scoring page had been scrolled to.
    window.scrollTo(0, 0);
  }

  function updatePlacing(patch: Partial<Placing>) {
    setPlacings((s) => (s ? { ...s, list: s.list.map((p, i) => (i === s.at ? { ...p, ...patch } : p)) } : s));
  }

  // The current aspect is placed at `index`: record it and move on, or
  // save once every aspect is placed.
  function settle(index: number) {
    const s = placings!;
    const p = s.list[s.at];
    const all = { ...placed, [p.key]: placedScore(p.score, p.sorted, index) };
    setPlaced(all);
    if (s.at + 1 < s.list.length) {
      setPlacings({ ...s, at: s.at + 1 });
    } else {
      setPlacings(null);
      save(all);
    }
  }

  function answer(preferredNew: boolean) {
    const p = placings!.list[placings!.at];
    const mid = Math.floor((p.lo + p.hi) / 2);
    const { lo, hi } = narrowRange(p.lo, p.hi, mid, preferredNew);
    if (lo >= hi) settle(lo);
    else updatePlacing({ lo, hi, history: [...p.history, { lo: p.lo, hi: p.hi }] });
  }

  function undo() {
    const p = placings!.list[placings!.at];
    if (p.history.length === 0) { setPlacings(null); return; }
    const prev = p.history[p.history.length - 1];
    updatePlacing({ lo: prev.lo, hi: prev.hi, history: p.history.slice(0, -1) });
  }

  async function save(final: Record<string, number>) {
    setSaving(true);
    setError('');
    try {
      if (!scoresSaved) {
        for (const c of scored) {
          await withOfflineFallback('addReview', `${hotel!.hotelName}: ${c.label}`, addReview, {
            hotelId: hotel!.hotelId, hotelName: hotel!.hotelName, country: hotel!.country,
            date: hotel!.date, category: c.key, score: final[c.key] ?? scores[c.key]!, note: notes[c.key] ?? '',
          });
        }
        setScoresSaved(true);
      }
      // Photos need a connection (they can't wait in the offline queue);
      // each one leaves the list as it goes up, so a retry sends the rest.
      for (const p of photos) {
        await addReviewPhoto(hotel!.hotelName, hotel!.hotelId || null, p.aspects, p.file);
        setPhotos((prev) => prev.filter((q) => q.id !== p.id));
      }
      finish.done('/');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to save review',
      );
    } finally {
      setSaving(false);
    }
  }

  if (placings) {
    const p = placings.list[placings.at];
    const candidate = pickComparisonCandidate(p.sorted, p.lo, p.hi)!;
    return (
      <div style={{ paddingBottom: 'var(--s7)' }}>
        <ScreenHeader title="Rate a stay" sub={hotel.hotelName} onBack={() => setPlacings(null)} />
        <div className="stack">
          <div style={{ textAlign: 'center', display: 'grid', gap: 'var(--s1)' }}>
            {placings.list.length > 1 && <span className="rowsub" style={{ justifyContent: 'center' }}>{placings.at + 1} of {placings.list.length}</span>}
            <span className="figure" style={{ fontSize: 'var(--fs-heading)', color: 'var(--brand)' }}>{p.label} · {p.score}</span>
            <span className="rowtitle">Which was better?</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 10 }}>
            <ChoiceCard
              name={hotel.hotelName} chosen
              photo={photos.find((q) => q.aspects.includes(p.key))?.url ?? aspectPhoto(allPhotos, hotel.hotelName, p.key)?.url ?? null}
              onClick={() => answer(true)}
            />
            <ChoiceCard
              name={candidate.hotelName} sub={candidate.score.toFixed(1)}
              photo={aspectPhoto(allPhotos, candidate.hotelName, p.key)?.url ?? null}
              onClick={() => answer(false)}
            />
            <span className="choice-or">OR</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="tagbtn" onClick={undo}>‹ Undo</button>
            <button type="button" className="tagbtn" onClick={() => settle(Math.floor((p.lo + p.hi) / 2))}>Same</button>
          </div>
        </div>
      </div>
    );
  }

  const viewList = viewing ? (viewing.aspect ? photos.filter((p) => p.aspects.includes(viewing.aspect!)) : photos) : [];
  const pending = toPlace().length > 0;

  return (
    <div style={{ paddingBottom: 'var(--s7)' }}>
      <ScreenHeader title="Rate a stay" sub={hotel.hotelName} />
      <div className="stack">
        <PhotoStrip
          label="stay" photos={photos} busy={sorting ? '…' : null}
          onAdd={saving ? undefined : addPhotos}
          onOpen={(index) => setViewing({ aspect: null, index })}
        />
        <div className="listcard">
          {categories.map((c) => {
            const own = photos.filter((p) => p.aspects.includes(c.key));
            return (
              <div key={c.key} className="aspectrow">
                <div className="aspectrow-head">
                  <span className="rowtitle display">{c.label}</span>
                  {!noteOpen[c.key] && (
                    <button type="button" className="tagbtn" onClick={() => setNoteOpen((o) => ({ ...o, [c.key]: true }))}>Note</button>
                  )}
                </div>
                <ScorePicker label={c.label} value={scores[c.key] ?? null} onChange={(n) => setScore(c.key, n)} />
                {noteOpen[c.key] && (
                  <textarea
                    className="input" rows={2} autoFocus aria-label={`${c.label} note`}
                    value={notes[c.key] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [c.key]: e.target.value }))}
                  />
                )}
                {own.length > 0 && <PhotoStrip label={c.label} photos={own} onOpen={(index) => setViewing({ aspect: c.key, index })} />}
              </div>
            );
          })}
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <Button block disabled={saving || sorting || (scored.length === 0 && photos.length === 0)} onClick={next}>
          {saving ? 'Saving…' : pending ? 'Next' : 'Save'}
        </Button>
      </div>

      {viewing && (
        <PhotoViewer
          photos={viewList}
          start={viewing.index}
          title={`${hotel.hotelName}${viewing.aspect ? ` · ${categories.find((c) => c.key === viewing.aspect)?.label ?? ''}` : ''}`}
          onClose={() => setViewing(null)}
          onDelete={(p) => setPhotos((prev) => prev.filter((q) => q.id !== p.id))}
          aspects={{ of: (p) => photos.find((q) => q.id === p.id)?.aspects ?? [], toggle: (p, key) => toggleAspect(p.id, key) }}
        />
      )}
    </div>
  );
}

// One side of "Which was better?": the hotel's photo of this aspect where
// there is one, so the choice is made looking at the two.
function ChoiceCard({ name, sub, photo, chosen, onClick }: { name: string; sub?: string; photo: string | null; chosen?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={['choicecard', chosen && 'chosen', photo && 'withphoto'].filter(Boolean).join(' ')}>
      {photo && <img src={photo} alt="" />}
      <span className="cc-text">
        <span className="cc-name">{name}</span>
        {sub && <span className="cc-sub">{sub}</span>}
      </span>
    </button>
  );
}
