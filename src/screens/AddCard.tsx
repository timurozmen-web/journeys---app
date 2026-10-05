import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorText, Field, ScreenHeader } from '../components/ui';
import { CARDS_STATIC } from '../data/cardDefs';
import { CARD_FACES, DEFAULT_FACE } from '../data/cardFaces';
import { usePaymentCards } from '../lib/useLiveData';
import { savePaymentCard } from '../lib/queries';

const OTHER = '__other__';

// Add a card to the wallet: pick it, say when you opened it, done. Cards
// already in the wallet aren't offered again.
export function AddCard() {
  const navigate = useNavigate();
  const { data: paymentCards, isLive } = usePaymentCards();
  const held = new Set(isLive ? paymentCards.filter((c) => !c.closedDate).map((c) => c.id) : []);
  const choices = CARDS_STATIC.filter((c) => !held.has(c.id));
  const [picked, setPicked] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState('');
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isOther = picked === OTHER;
  const ready = !!picked && !!openDate && (!isOther || (name.trim() !== '' && fee !== ''));

  async function save() {
    if (!picked || !ready) return;
    setSaving(true);
    setError('');
    try {
      const def = isOther
        ? { id: name.trim(), programmeBrand: 'Other', annualFee: Number(fee), feeLabel: Number(fee) > 0 ? `£${Number(fee)}/yr` : 'Free' }
        : CARDS_STATIC.find((c) => c.id === picked)!;
      await savePaymentCard(def, openDate);
      navigate('/wallet', { state: { seg: 'payment', tracked: [def.id] }, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the card.');
      setSaving(false);
    }
  }

  return (
    <div>
      <ScreenHeader title="Add a card" />
      <div style={{ padding: '6px 20px 30px', display: 'grid', gap: 10 }}>
        {[...choices.map((c) => ({ id: c.id, label: c.id, sub: c.feeLabel, face: CARD_FACES[c.id] ?? DEFAULT_FACE })), { id: OTHER, label: 'Another card', sub: '', face: DEFAULT_FACE }].map((c) => (
          <button
            key={c.id} type="button" className={`optionrow${picked === c.id ? ' picked' : ''}`}
            onClick={() => setPicked(c.id)} aria-pressed={picked === c.id}
          >
            <span className="minicard" style={{ background: `linear-gradient(150deg, ${c.face.from} 0%, ${c.face.to} 100%)` }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="optionrow-label" style={{ display: 'block' }}>{c.label}</span>
              {c.sub && <span style={{ display: 'block', color: 'var(--ink3)', fontSize: 'var(--fs-caption)', marginTop: 2 }}>{c.sub}</span>}
            </span>
          </button>
        ))}

        {picked && (
          <div style={{ marginTop: 8 }}>
            {isOther && (
              <>
                <Field label="Card name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
                <Field label="Annual fee (£)"><input className="input" type="number" min="0" step="1" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
              </>
            )}
            <Field label="Opened"><input className="input" type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} /></Field>
            {error && <ErrorText style={{ marginBottom: 10 }}>{error}</ErrorText>}
            <Button block disabled={!ready || saving} onClick={save}>{saving ? 'Adding…' : 'Add card'}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
