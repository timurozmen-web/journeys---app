// An aspect's score out of 10: one tap. Tapping the chosen score again
// clears it (an aspect left unscored is skipped).
export function ScorePicker({ value, onChange, label }: { value: number | null; onChange: (n: number | null) => void; label: string }) {
  return (
    <div className="scorepick" role="group" aria-label={`${label} out of 10`}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n} type="button" className={value === n ? 'on' : undefined} aria-pressed={value === n}
          onClick={() => onChange(value === n ? null : n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
