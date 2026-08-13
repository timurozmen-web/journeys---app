import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { addReview } from '../lib/queries';
import { computeBucketScore, INTENSITY_LABELS, REVIEW_CATEGORIES, type ReviewIntensity } from '../lib/reviewScoring';
import type { HotelNeedingReview } from '../lib/reviewScoring';

type Answer = { liked: boolean; intensity: ReviewIntensity } | null;

export function ReviewTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const hotel = (location.state as { hotel?: HotelNeedingReview } | null)?.hotel;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(REVIEW_CATEGORIES.map(() => null));
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
  const answer = answers[step];

  function setLiked(liked: boolean) {
    const next = [...answers];
    next[step] = { liked, intensity: 'strong' };
    setAnswers(next);
  }
  function setIntensity(intensity: ReviewIntensity) {
    if (!answer) return;
    const next = [...answers];
    next[step] = { ...answer, intensity };
    setAnswers(next);
  }

  async function handleNext() {
    if (step < REVIEW_CATEGORIES.length - 1) {
      setStep(step + 1);
      return;
    }
    // Last category answered -- save everything.
    setSaving(true);
    setError('');
    try {
      for (let i = 0; i < REVIEW_CATEGORIES.length; i++) {
        const a = answers[i];
        if (!a) continue; // category was skipped
        await addReview({
          hotelId: hotel!.hotelId, hotelName: hotel!.hotelName, country: hotel!.country,
          date: hotel!.date, category: REVIEW_CATEGORIES[i].key,
          score: computeBucketScore(a.liked, a.intensity),
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

        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, textAlign: 'center' }}>{category.label}</div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => setLiked(true)}
            style={{
              flex: 1, padding: '16px 0', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              border: answer?.liked === true ? '2px solid var(--green)' : '1px solid var(--line)',
              background: answer?.liked === true ? 'rgba(12,122,66,.08)' : 'var(--card)',
              color: answer?.liked === true ? 'var(--green)' : 'var(--ink)',
            }}
          >
            👍 Liked it
          </button>
          <button
            onClick={() => setLiked(false)}
            style={{
              flex: 1, padding: '16px 0', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              border: answer?.liked === false ? '2px solid var(--red)' : '1px solid var(--line)',
              background: answer?.liked === false ? 'rgba(210,60,60,.08)' : 'var(--card)',
              color: answer?.liked === false ? 'var(--red)' : 'var(--ink)',
            }}
          >
            👎 Not for me
          </button>
        </div>

        {answer && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
            {(['mild', 'strong', 'extreme'] as ReviewIntensity[]).map((level) => (
              <button
                key={level}
                onClick={() => setIntensity(level)}
                style={{
                  padding: '11px 14px', borderRadius: 10, textAlign: 'left', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  border: answer.intensity === level ? '1px solid var(--brand)' : '1px solid var(--line)',
                  background: answer.intensity === level ? 'rgba(19,34,71,.06)' : 'var(--card)',
                  color: 'var(--ink)',
                }}
              >
                {answer.liked ? INTENSITY_LABELS[level].liked : INTENSITY_LABELS[level].disliked}
              </button>
            ))}
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button
          onClick={handleNext}
          disabled={!answer || saving}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
            background: answer && !saving ? 'var(--brand)' : 'var(--card2)',
            color: answer && !saving ? '#fff' : 'var(--ink3)',
            cursor: answer && !saving ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Saving…' : step < REVIEW_CATEGORIES.length - 1 ? 'Next' : 'Finish'}
        </button>
      </div>
    </div>
  );
}
