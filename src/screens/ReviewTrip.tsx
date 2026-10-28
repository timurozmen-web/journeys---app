import { useEffect, useRef, useState } from 'react';
import { useFinish } from '../lib/useFinish';
import { useNavigate, useLocation } from 'react-router-dom';
import { addReview, addReviewPhoto } from '../lib/queries';
import { withOfflineFallback } from '../lib/offlineQueue';
import { useReviewPhotos, useReviews } from '../lib/useLiveData';
import { REVIEW_CATEGORIES } from '../lib/reviewScoring';
import { aspectPhoto } from '../lib/reviewSummary';
import {
  pickComparisonCandidate, narrowRange, computeFinalScore, sortedSameBand,
  type Sentiment, type RankedItem,
} from '../lib/reviewRanking';
import type { HotelNeedingReview } from '../lib/reviewScoring';
import { Field, ScreenHeader } from '../components/ui';
import { PhotoStrip, PhotoViewer } from '../components/ReviewPhotos';

type Phase = 'sentiment' | 'comparing' | 'done';

interface CategoryState {
  sentiment: Sentiment | null;
  sameBand: RankedItem[];
  lo: number;
  hi: number;
  history: { lo: number; hi: number }[];
  score: number | null;
  skipped: boolean;
  note: string;
  photos: StagedPhoto[]; // uploaded at Finish, once the review is saved
}

interface StagedPhoto { id: string; file: File; url: string }

function freshCategoryState(): CategoryState {
  return { sentiment: null, sameBand: [], lo: 0, hi: 0, history: [], score: null, skipped: false, note: '', photos: [] };
}

const SENTIMENT_CIRCLES: { key: Sentiment; label: string; color: string }[] = [
  { key: 'liked', label: 'I liked it!', color: 'var(--green)' },
  { key: 'okay', label: 'It was fine', color: 'var(--amber)' },
  { key: 'disliked', label: "I didn't like it", color: 'var(--red)' },
];

export function ReviewTrip() {
  const navigate = useNavigate();
  const finish = useFinish();
  const location = useLocation();
  const state = location.state as { hotel?: HotelNeedingReview; onlyCategories?: string[] } | null;
  const hotel = state?.hotel;
  const { data: allReviews } = useReviews();
  const { data: allPhotos } = useReviewPhotos();
  const categories = state?.onlyCategories ? REVIEW_CATEGORIES.filter((c) => state.onlyCategories!.includes(c.key)) : REVIEW_CATEGORIES;

  const [step, setStep] = useState(0);
  const [states, setStates] = useState<CategoryState[]>(categories.map(() => freshCategoryState()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  // Set once the scores are saved: if a photo upload then fails, Finish
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

  const category = categories[step];
  const current = states[step];
  const phase: Phase = current.score != null || current.skipped ? 'done' : current.sentiment == null ? 'sentiment' : 'comparing';

  function updateCurrent(patch: Partial<CategoryState>) {
    setStates((prev) => prev.map((s, i) => (i === step ? { ...s, ...patch } : s)));
  }

  function chooseSentiment(sentiment: Sentiment) {
    const existingInCategory = allReviews.filter((r) => r.category === category.key).map((r) => ({ hotelName: r.hotelName, score: r.score }));
    const sameBand = sortedSameBand(sentiment, existingInCategory, hotel!.hotelName);
    if (sameBand.length === 0) {
      updateCurrent({ sentiment, sameBand, lo: 0, hi: 0, history: [], score: computeFinalScore(sentiment, [], 0) });
      return;
    }
    updateCurrent({ sentiment, sameBand, lo: 0, hi: sameBand.length, history: [], score: null });
  }

  function answerComparison(preferredNew: boolean) {
    const mid = Math.floor((current.lo + current.hi) / 2);
    const { lo, hi } = narrowRange(current.lo, current.hi, mid, preferredNew);
    const history = [...current.history, { lo: current.lo, hi: current.hi }];
    if (lo >= hi) {
      updateCurrent({ lo, hi, history, score: computeFinalScore(current.sentiment!, current.sameBand, lo) });
    } else {
      updateCurrent({ lo, hi, history });
    }
  }

  function tooTough() {
    // Too close to call -- settle right at this candidate's position
    // rather than continuing to narrow further.
    const mid = Math.floor((current.lo + current.hi) / 2);
    const history = [...current.history, { lo: current.lo, hi: current.hi }];
    updateCurrent({ lo: mid, hi: mid, history, score: computeFinalScore(current.sentiment!, current.sameBand, mid) });
  }

  function undo() {
    if (current.history.length === 0) {
      // Nothing to undo within comparisons -- back out of sentiment choice entirely.
      updateCurrent(freshCategoryState());
      return;
    }
    const prevState = current.history[current.history.length - 1];
    updateCurrent({ lo: prevState.lo, hi: prevState.hi, history: current.history.slice(0, -1), score: null });
  }

  function skipCategory() {
    updateCurrent({ skipped: true, score: null, photos: [] });
  }

  function stagePhotos(files: File[]) {
    const staged = files.map((file) => {
      const url = URL.createObjectURL(file);
      previews.current.push(url);
      return { id: url, file, url };
    });
    updateCurrent({ photos: [...current.photos, ...staged] });
  }

  async function handleNext() {
    if (step < categories.length - 1) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (!scoresSaved) {
        for (let i = 0; i < categories.length; i++) {
          const s = states[i];
          if (s.score == null) continue;
          await withOfflineFallback('addReview', `${hotel!.hotelName}: ${categories[i].label}`, addReview, {
            hotelId: hotel!.hotelId, hotelName: hotel!.hotelName, country: hotel!.country,
            date: hotel!.date, category: categories[i].key, score: s.score, note: s.note,
          });
        }
        setScoresSaved(true);
      }
      // Photos need a connection (they can't wait in the offline queue);
      // each one is dropped from the list as it goes up, so a retry sends
      // only the rest.
      for (let i = 0; i < categories.length; i++) {
        for (const p of states[i].photos) {
          await addReviewPhoto(hotel!.hotelName, hotel!.hotelId || null, categories[i].key, p.file);
          setStates((prev) => prev.map((s, j) => (j === i ? { ...s, photos: s.photos.filter((q) => q.id !== p.id) } : s)));
        }
      }
      finish.done('/');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to save review';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const comparisonCandidate = phase === 'comparing' ? pickComparisonCandidate(current.sameBand, current.lo, current.hi) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <ScreenHeader title="Rate a stay" sub={hotel.hotelName} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px 100px' }}>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
          {step + 1} of {categories.length}
        </div>
        <div className="figure" style={{ fontSize: 'var(--fs-heading)', marginBottom: 28, textAlign: 'center', color: 'var(--brand)' }}>{category.label}</div>

        {phase === 'sentiment' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              {SENTIMENT_CIRCLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => chooseSentiment(s.key)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1 }}
                >
                  <span
                    style={{
                      width: 68, height: 68, borderRadius: '50%', background: s.color,
                      display: 'grid', placeItems: 'center', boxShadow: '0 6px 16px rgba(0,0,0,.15)',
                    }}
                  />
                  <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--ink)', textAlign: 'center' }}>{s.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={skipCategory}
              style={{
                display: 'block', margin: '28px auto 0', background: 'none', border: 'none',
                color: 'var(--ink3)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer',
              }}
            >
              N/A for this stay
            </button>
          </div>
        )}

        {phase === 'comparing' && comparisonCandidate && (
          <div>
            <div style={{ fontSize: 'var(--fs-input)', fontWeight: 600, textAlign: 'center', marginBottom: 16, color: 'var(--brand)' }}>
              Which do you prefer?
            </div>
            <div style={{ position: 'relative', display: 'flex', gap: 10 }}>
              <ChoiceCard
                name={hotel.hotelName} chosen
                photo={aspectPhoto(allPhotos, hotel.hotelName, category.key)?.url ?? null}
                onClick={() => answerComparison(true)}
              />
              <ChoiceCard
                name={comparisonCandidate.hotelName} sub={comparisonCandidate.score.toFixed(1)}
                photo={aspectPhoto(allPhotos, comparisonCandidate.hotelName, category.key)?.url ?? null}
                onClick={() => answerComparison(false)}
              />
              <span
                style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  width: 34, height: 34, borderRadius: '50%', background: 'var(--brand)', color: 'var(--on-brand)',
                  fontSize: 'var(--fs-micro)', fontWeight: 600, display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.25)',
                }}
              >
                OR
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <button onClick={undo} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}>
                ‹ Undo
              </button>
              <button onClick={tooTough} className="tagbtn">
                Too tough
              </button>
              <button onClick={skipCategory} style={{ background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 'var(--fs-small)', fontWeight: 700, cursor: 'pointer' }}>
                Skip ›
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center' }}>
            {current.skipped ? (
              <div style={{ fontSize: 'var(--fs-input)', color: 'var(--ink3)', fontWeight: 600 }}>Skipped</div>
            ) : (
              <>
                <div className="figure" style={{ fontSize: 'var(--fs-hero)', color: 'var(--brand)' }}>{current.score!.toFixed(1)}</div>
                <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink3)', marginTop: 4 }}>
                  {current.sameBand.length === 0 ? 'First rating in this category' : 'Ranked against your other stays'}
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'done' && !current.skipped && (
          <div style={{ display: 'grid', gap: 'var(--s3)', marginTop: 'var(--s6)' }}>
            <Field label="Note">
              <textarea className="input" rows={2} value={current.note} onChange={(e) => updateCurrent({ note: e.target.value })} />
            </Field>
            <PhotoStrip
              label={category.label}
              photos={current.photos}
              onAdd={saving ? undefined : stagePhotos}
              onOpen={setViewing}
            />
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 'var(--fs-body)', margin: '16px 0 0', textAlign: 'center' }}>{error}</div>}

        {phase === 'done' && (
          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              width: '100%', marginTop: 28, padding: '13px 0', borderRadius: 'var(--r-sm)', border: 'none', fontSize: 'var(--fs-input)', fontWeight: 700,
              background: saving ? 'var(--card2)' : 'var(--brand)', color: saving ? 'var(--ink3)' : 'var(--on-brand)',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : step < categories.length - 1 ? 'Next' : 'Finish'}
          </button>
        )}
      </div>

      {viewing != null && (
        <PhotoViewer
          photos={current.photos}
          start={viewing}
          title={`${hotel.hotelName} · ${category.label}`}
          onClose={() => setViewing(null)}
          onDelete={(p) => updateCurrent({ photos: current.photos.filter((q) => q.id !== p.id) })}
        />
      )}
    </div>
  );
}

// One side of "Which do you prefer?": the hotel's photo of this aspect
// where there is one, so the choice is made looking at the two.
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
