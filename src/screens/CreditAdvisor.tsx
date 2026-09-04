import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { useLoyaltyProgrammes } from '../lib/useLiveData';
import { distanceMilesBetween } from '../lib/creditingDistance';
import {
  CARRIERS, BA_TIERS, QR_TIERS, QF_TIERS, KF_TIERS, REDEEMABLE_VALUE_PENCE,
  suggestFareLevel, runAdvisor,
  type Cabin, type FareLevel, type ProgramId, type CreditInput, type ProgramResult,
} from '../lib/creditingEngine';

const inputStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
  color: 'var(--ink)', fontSize: 15, padding: '11px 12px', width: '100%', outline: 'none', minWidth: 0, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.05em', marginBottom: 5, display: 'block',
};
const CABINS: Cabin[] = ['Economy', 'Premium Economy', 'Business', 'First'];
const PROGRAM_TIERS: Record<ProgramId, readonly string[]> = { BA: BA_TIERS, QR: QR_TIERS, QF: QF_TIERS, KF: KF_TIERS };
const PROGRAM_WALLET_NAME: Record<ProgramId, string> = {
  BA: 'British Airways Executive Club', QR: 'Qatar Privilege Club', QF: 'Qantas Frequent Flyer', KF: 'KrisFlyer / PPS Club',
};

export function CreditAdvisor() {
  const navigate = useNavigate();
  const { data: programmes } = useLoyaltyProgrammes();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [manualDistance, setManualDistance] = useState('');
  const [carrier, setCarrier] = useState('BA');
  const [cabin, setCabin] = useState<Cabin>('Economy');
  const [bookingClass, setBookingClass] = useState('');
  const [fareLevel, setFareLevel] = useState<FareLevel>('standard');
  const [fareLevelTouched, setFareLevelTouched] = useState(false);
  const [price, setPrice] = useState('');
  const [ukDeparture, setUkDeparture] = useState(true);
  const [tiers, setTiers] = useState<Partial<Record<ProgramId, string>>>({});

  // Prefill elite tiers from the wallet, once, where the person already
  // has these programmes logged -- personalised without asking twice.
  useEffect(() => {
    if (!programmes.length) return;
    setTiers((t) => {
      const next = { ...t };
      (['BA', 'QR', 'QF', 'KF'] as ProgramId[]).forEach((p) => {
        if (next[p]) return;
        const match = programmes.find((pr) => pr.name === PROGRAM_WALLET_NAME[p]);
        if (match?.tier && PROGRAM_TIERS[p].includes(match.tier)) next[p] = match.tier;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmes.length]);

  useEffect(() => {
    if (from.length === 3 && to.length === 3) {
      setDistanceLoading(true);
      distanceMilesBetween(from, to).then((mi) => { setDistanceMiles(mi); setDistanceLoading(false); });
    } else {
      setDistanceMiles(null);
    }
  }, [from, to]);

  function onBookingClassChange(v: string) {
    setBookingClass(v);
    const suggestion = suggestFareLevel(cabin, v);
    if (suggestion && !fareLevelTouched) setFareLevel(suggestion);
  }

  const effectiveDistance = distanceMiles ?? (manualDistance ? parseInt(manualDistance, 10) : null);

  const advisor = useMemo(() => {
    if (!effectiveDistance || effectiveDistance <= 0) return null;
    const input: CreditInput = {
      operatingCarrier: carrier, cabin, fareLevel,
      price: price ? parseFloat(price) : undefined,
      distanceMiles: effectiveDistance, ukDeparture, tiers,
    };
    return runAdvisor(input);
  }, [carrier, cabin, fareLevel, price, effectiveDistance, ukDeparture, tiers]);

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Where to credit</div>
      </div>
      <p style={{ padding: '0 20px', fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.5, marginTop: -4 }}>
        British Airways, Qatar, Qantas and KrisFlyer for now — more programmes coming in groups.
      </p>

      <div style={{ padding: '10px 20px', display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label style={labelStyle}>From *</label>
            <input style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value.toUpperCase())} placeholder="LHR" maxLength={3} />
          </div>
          <div>
            <label style={labelStyle}>To *</label>
            <input style={inputStyle} value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} placeholder="SYD" maxLength={3} />
          </div>
        </div>
        {from.length === 3 && to.length === 3 && !distanceLoading && distanceMiles == null && (
          <div>
            <label style={labelStyle}>Couldn't find one of those airports — distance (miles) *</label>
            <input style={inputStyle} type="number" value={manualDistance} onChange={(e) => setManualDistance(e.target.value)} placeholder="e.g. 6890" />
          </div>
        )}
        {distanceMiles != null && (
          <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{distanceMiles.toLocaleString()} miles, great-circle</div>
        )}

        <div>
          <label style={labelStyle}>Operating carrier *</label>
          <select style={inputStyle} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            <optgroup label="Oneworld">
              {CARRIERS.filter((c) => c.alliance === 'oneworld').map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </optgroup>
            <optgroup label="Star Alliance">
              {CARRIERS.filter((c) => c.alliance === 'star').map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </optgroup>
            <option value="OTHER">Other / not listed</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div>
            <label style={labelStyle}>Cabin</label>
            <select style={inputStyle} value={cabin} onChange={(e) => { setCabin(e.target.value as Cabin); setFareLevelTouched(false); }}>
              {CABINS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Booking class</label>
            <input style={inputStyle} value={bookingClass} onChange={(e) => onBookingClassChange(e.target.value.toUpperCase())} placeholder="e.g. K" maxLength={1} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Fare level {bookingClass && <span style={{ textTransform: 'none', fontWeight: 400 }}>(suggested from booking class — adjust if it's off)</span>}</label>
          <select style={inputStyle} value={fareLevel} onChange={(e) => { setFareLevel(e.target.value as FareLevel); setFareLevelTouched(true); }}>
            <option value="lowest">Lowest / deep discount</option>
            <option value="standard">Standard</option>
            <option value="flex">Flexible / full fare</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Price paid (£, optional)</label>
          <input style={inputStyle} type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Only needed for BA's spend-based earning" />
        </div>

        {carrier === 'BA' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink2)' }}>
            <input type="checkbox" checked={ukDeparture} onChange={(e) => setUkDeparture(e.target.checked)} />
            Departing the UK (affects BA's tax-exclusion estimate)
          </label>
        )}

        <div>
          <label style={labelStyle}>Elite tier held</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
            {(['BA', 'QR', 'QF', 'KF'] as ProgramId[]).map((p) => (
              <select key={p} style={inputStyle} value={tiers[p] ?? PROGRAM_TIERS[p][0]} onChange={(e) => setTiers((t) => ({ ...t, [p]: e.target.value }))}>
                {PROGRAM_TIERS[p].map((t) => <option key={t} value={t}>{p} · {t}</option>)}
              </select>
            ))}
          </div>
        </div>
      </div>

      {advisor && <Results advisor={advisor} />}
    </div>
  );
}

function Results({ advisor }: { advisor: ReturnType<typeof runAdvisor> }) {
  const { results, bestValue, bestValueGBP } = advisor;
  return (
    <div style={{ padding: '4px 20px 32px', display: 'grid', gap: 12 }}>
      {bestValue && (
        <div style={{ background: 'var(--brand)', borderRadius: 14, padding: '14px 16px', color: '#fff' }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '.05em' }}>Best value</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{bestValue.name}</div>
          <div style={{ fontSize: 13.5, opacity: 0.9, marginTop: 2 }}>
            {bestValue.redeemable?.amount.toLocaleString()} {bestValue.redeemable?.name} · roughly £{bestValueGBP.toFixed(0)} of value
          </div>
        </div>
      )}
      {results.map((r) => <ProgramCard key={r.program} r={r} isBest={r.program === bestValue?.program} />)}
      <p style={{ fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
        Value estimates use rough per-point rates ({(['BA', 'QR', 'QF', 'KF'] as ProgramId[]).map((p) => `${p} ${REDEEMABLE_VALUE_PENCE[p]}p`).join(' · ')}) —
        for comparing options here, not a guarantee of redemption value.
      </p>
    </div>
  );
}

function ProgramCard({ r, isBest }: { r: ProgramResult; isBest: boolean }) {
  if (r.relationship === 'none') {
    return (
      <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', opacity: 0.6 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{r.name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 2 }}>{r.notes[0]}</div>
      </div>
    );
  }
  return (
    <div style={{ border: isBest ? '1.5px solid var(--brand)' : '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{r.name}</div>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase' }}>
          {r.relationship === 'own' ? 'Own metal' : 'Partner'}{r.estimated ? ' · estimated' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
        {r.redeemable && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{r.redeemable.amount.toLocaleString()}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>{r.redeemable.name}</div>
          </div>
        )}
        {r.status && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{r.status.amount.toLocaleString()}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>{r.status.name}</div>
          </div>
        )}
      </div>
      {r.notes.length > 0 && (
        <div style={{ marginTop: 8, display: 'grid', gap: 3 }}>
          {r.notes.map((n, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.4 }}>{n}</div>)}
        </div>
      )}
    </div>
  );
}
