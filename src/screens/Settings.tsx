import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { useLoyaltyProgrammes } from '../lib/useLiveData';
import { setProgrammeTier } from '../lib/queries';
import { BA_TIERS, QR_TIERS, QF_TIERS, KF_TIERS } from '../lib/creditingEngine';

const inputStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
  color: 'var(--ink)', fontSize: 15, padding: '11px 12px', width: '100%', outline: 'none', minWidth: 0, boxSizing: 'border-box',
};

const AIRLINE_PROGRAMMES = [
  { name: 'British Airways Executive Club', tiers: BA_TIERS },
  { name: 'Qatar Privilege Club', tiers: QR_TIERS },
  { name: 'Qantas Frequent Flyer', tiers: QF_TIERS },
  { name: 'KrisFlyer / PPS Club', tiers: KF_TIERS },
] as const;

export function Settings() {
  const navigate = useNavigate();
  const { data: programmes, refetch } = useLoyaltyProgrammes();
  const [saving, setSaving] = useState<string | null>(null);

  async function onChange(name: string, tier: string, category: 'airline') {
    setSaving(name);
    try {
      await setProgrammeTier(name, tier, category);
      refetch();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Settings</div>
      </div>

      <div style={{ padding: '4px 20px 32px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink2)', marginBottom: 4 }}>
          Airline elite status
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
          Set once here — Where to Credit reads these automatically, no need to re-enter them there.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {AIRLINE_PROGRAMMES.map((p) => {
            const match = programmes.find((pr) => pr.name === p.name);
            const current = match?.tier && (p.tiers as readonly string[]).includes(match.tier) ? match.tier : p.tiers[0];
            return (
              <div key={p.name} style={{ border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{p.name}</div>
                <select
                  style={inputStyle}
                  value={current}
                  disabled={saving === p.name}
                  onChange={(e) => onChange(p.name, e.target.value, 'airline')}
                >
                  {p.tiers.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
