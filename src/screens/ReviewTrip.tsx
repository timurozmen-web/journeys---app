import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { addReview } from '../lib/queries';
import { useReviews } from '../lib/useLiveData';
import { REVIEW_CATEGORIES } from '../lib/reviewScoring';
import {
  pickComparisonCandidate, narrowRange, computeFinalScore, sortedSameBand,
  type Sentiment, type RankedItem,
} from '../lib/reviewRanking';
import type { HotelNeedingReview } from '../lib/reviewScoring';

type Phase = 'sentiment' | 'comparing' | 'done';

interface CategoryState {
  sentiment: Sentiment | null;
  sameBand: RankedItem[];
  lo: number;
  hi: number;
  history: { lo: number; hi: number }[];
  score: number | null;
  skipped: boolean;
}

function freshCategoryState(): CategoryState {
  return { sentiment: null, sameBand: [], lo: 0, hi: 0, history: [], score: null, skipped: false };
}

const SENTIMENT_CIRCLES: { key: Sentiment; label: string; color: string }[] = [
  { key: 'liked', label: 'I liked it!', color: 'var(--green)' },
  { key: 'okay', label: 'It was fine', color: 'var(--amber)' },
  { key: 'disliked', label: "I didn't like it", color: 'var(--red)' },
];

export function ReviewTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const hotel = (location.state as { hotel?: HotelNeedingReview } | null)?.hotel;
  const { data: allReviews } = useReviews();

  const [step, setStep] = useState(0);
  const [states, setStates] = useState<CategoryState[]>(REVIEW_CATEGORIES.map(() => freshCategoryState()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!hotel) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: 'var(--ink3)', fontSize: 13.5 }}>No stay selected to review.</p>
        <button onClick={() => navigate('/profile')} style={{ color: 'var(--brand)', background: 'none', border: 'none', fontWeight: 700 }}>
          Back to Profile
        </button>
      </div>
    );
  }

  const category = REVIEW_CATEGORIES[step];
  const current = states[step];
  const phase: Phase = current.score != null || current.skipped ? 'done' : current.sentiment == null ? 'sentiment' : 'comparing';

  function updateCurrent(patch: Partial<CategoryState>) {
    setStates((prev) => prev.map((s, i) => (i === step ? { ...s, ...patch } : s)));
  }

  function chooseSentiment(sentiment: Sentiment) {
    const existingInCategory = allReviews.filter((r) => r.category === category.key).map((r) => ({ hotelName: r.hotelName, score: r.score }));
    const sameBand = sortedSameBand(sentiment, existingInCategory);
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
    updateCurrent({ skipped: true, score: null });
  }

  async function handleNext() {
    if (step < REVIEW_CATEGORIES.length - 1) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    setError('');
    try {
      for (let i = 0; i < REVIEW_CATEGORIES.length; i++) {
        const s = states[i];
        if (s.score == null) continue;
        await addReview({
          hotelId: hotel!.hotelId, hotelName: hotel!.hotelName, country: hotel!.country,
          date: hotel!.date, category: REVIEW_CATEGORIES[i].key, score: s.score,
        });
      }
      navigate('/profile');
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
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Rate {hotel.hotelName}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px 100px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
          {step + 1} of {REVIEW_CATEGORIES.length}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 28, textAlign: 'center' }}>{category.label}</div>

        {phase === 'sentiment' && (
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
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', textAlign: 'center' }}>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {phase === 'comparing' && comparisonCandidate && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, textAlign: 'center', marginBottom: 16 }}>
              Which do you prefer?
            </div>
            <div style={{ position: 'relative', display: 'flex', gap: 10 }}>
              <button
                onClick={() => answerComparison(true)}
                style={{
                  flex: 1, minHeight: 150, padding: '18px 12px', borderRadius: 14, border: '2px solid var(--brand)',
                  background: 'rgba(19,34,71,.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, textAlign: 'center' }}>{hotel.hotelName}</div>
              </button>
              <button
                onClick={() => answerComparison(false)}
                style={{
                  flex: 1, minHeight: 150, padding: '18px 12px', borderRadius: 14, border: '1px solid var(--line)',
                  background: 'var(--card)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, textAlign: 'center' }}>{comparisonCandidate.hotelName}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{comparisonCandidate.score.toFixed(2)}</div>
              </button>
              <span
                style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  width: 34, height: 34, borderRadius: '50%', background: 'var(--brand)', color: '#fff',
                  fontSize: 10.5, fontWeight: 800, display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.25)',
                }}
              >
                OR
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <button onClick={undo} style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                ‹ Undo
              </button>
              <button onClick={tooTough} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 99, padding: '7px 16px', color: 'var(--ink)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                Too tough
              </button>
              <button onClick={skipCategory} style={{ background: 'none', border: 'none', color: 'var(--ink3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                Skip ›
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center' }}>
            {current.skipped ? (
              <div style={{ fontSize: 15, color: 'var(--ink3)', fontWeight: 600 }}>Skipped</div>
            ) : (
              <>
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--brand)' }}>{current.score!.toFixed(2)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 4 }}>
                  {current.sameBand.length === 0 ? 'First rating in this category' : 'Ranked against your other stays'}
                </div>
              </>
            )}
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 13, margin: '16px 0 0', textAlign: 'center' }}>{error}</div>}

        {phase === 'done' && (
          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              width: '100%', marginTop: 28, padding: '13px 0', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
              background: saving ? 'var(--card2)' : 'var(--brand)', color: saving ? 'var(--ink3)' : '#fff',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : step < REVIEW_CATEGORIES.length - 1 ? 'Next' : 'Finish'}
          </button>
        )}
      </div>
    </div>
  );
}
