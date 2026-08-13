import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { addReview } from '../lib/queries';
import { useReviews } from '../lib/useLiveData';
import { REVIEW_CATEGORIES } from '../lib/reviewScoring';
import {
  pickComparisonCandidate, narrowRange, computeFinalScore, sortedSameBand,
  SENTIMENT_LABELS, type Sentiment, type RankedItem,
} from '../lib/reviewRanking';
import type { HotelNeedingReview } from '../lib/reviewScoring';

type Phase = 'sentiment' | 'comparing' | 'done';

interface CategoryState {
  sentiment: Sentiment | null;
  sameBand: RankedItem[];
  lo: number;
  hi: number;
  score: number | null;
}

function freshCategoryState(): CategoryState {
  return { sentiment: null, sameBand: [], lo: 0, hi: 0, score: null };
}

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
  const phase: Phase = current.score != null ? 'done' : current.sentiment == null ? 'sentiment' : 'comparing';

  function updateCurrent(patch: Partial<CategoryState>) {
    setStates((prev) => prev.map((s, i) => (i === step ? { ...s, ...patch } : s)));
  }

  function chooseSentiment(sentiment: Sentiment) {
    const existingInCategory = allReviews.filter((r) => r.category === category.key).map((r) => ({ hotelName: r.hotelName, score: r.score }));
    const sameBand = sortedSameBand(sentiment, existingInCategory);
    if (sameBand.length === 0) {
      // Nothing to compare against yet -- land on the band midpoint directly.
      updateCurrent({ sentiment, sameBand, lo: 0, hi: 0, score: computeFinalScore(sentiment, [], 0) });
      return;
    }
    updateCurrent({ sentiment, sameBand, lo: 0, hi: sameBand.length, score: null });
  }

  function answerComparison(preferredNew: boolean) {
    const mid = Math.floor((current.lo + current.hi) / 2);
    const { lo, hi } = narrowRange(current.lo, current.hi, mid, preferredNew);
    if (lo >= hi) {
      updateCurrent({ lo, hi, score: computeFinalScore(current.sentiment!, current.sameBand, lo) });
    } else {
      updateCurrent({ lo, hi });
    }
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
        if (s.score == null) continue; // category skipped
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
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, textAlign: 'center' }}>{category.label}</div>

        {phase === 'sentiment' && (
          <div style={{ display: 'grid', gap: 10 }}>
            {(['liked', 'okay', 'disliked'] as Sentiment[]).map((s) => (
              <button
                key={s}
                onClick={() => chooseSentiment(s)}
                style={{
                  padding: '15px 0', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)',
                }}
              >
                {SENTIMENT_LABELS[s]}
              </button>
            ))}
          </div>
        )}

        {phase === 'comparing' && comparisonCandidate && (
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', textAlign: 'center', marginBottom: 14 }}>
              Which did you prefer?
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                onClick={() => answerComparison(true)}
                style={{ padding: '18px 14px', borderRadius: 12, border: '2px solid var(--brand)', background: 'rgba(19,34,71,.05)', cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ fontSize: 15, fontWeight: 800 }}>This stay</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{hotel.hotelName}</div>
              </button>
              <button
                onClick={() => answerComparison(false)}
                style={{ padding: '18px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ fontSize: 15, fontWeight: 800 }}>{comparisonCandidate.hotelName}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>Your earlier rating</div>
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--brand)' }}>{current.score!.toFixed(2)}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 4 }}>
              {current.sameBand.length === 0
                ? `First ${SENTIMENT_LABELS[current.sentiment!].toLowerCase()} rating in this category`
                : 'Ranked against your other stays'}
            </div>
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
