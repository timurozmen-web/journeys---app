import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { usePromotionCandidates } from '../lib/useLiveData';
import { acceptPromotionCandidate, dismissPromotionCandidate } from '../lib/queries';

export function Discover() {
  const navigate = useNavigate();
  const { data: candidates, refetch } = usePromotionCandidates();

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Discover</div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 16 }}>
          A daily scan checks for new hotel loyalty promotions and lists them here. Scan a screenshot yourself for anything it misses.
        </p>

        <button
          onClick={() => navigate('/scan-promotion')}
          style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 20 }}
        >
          📷 Scan a promotion
        </button>

        <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Detected ({candidates.length})
        </div>

        {candidates.length === 0 ? (
          <div style={{ padding: '20px 4px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
            Nothing new since the last scan.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {candidates.map((c) => (
              <div key={c.id} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(19,34,71,.15)', background: 'rgba(19,34,71,.04)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.title}</div>
                {c.brand && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{c.brand}</div>}
                {c.description && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>{c.description}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={async () => {
                      await acceptPromotionCandidate(c);
                      refetch();
                    }}
                    style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Add
                  </button>
                  <button
                    onClick={async () => {
                      await dismissPromotionCandidate(c.id);
                      refetch();
                    }}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
