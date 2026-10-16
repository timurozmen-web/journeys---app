import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { wasDeleted } from '../lib/deleted';
import { useAllHotels, useLoyaltyProgrammes, usePaymentCards, usePromotions, useTrips } from '../lib/useLiveData';
import { useCardResults } from '../lib/useCardResults';
import { computeStatusProgress } from '../lib/statusProgress';
import { withLiveOverrides } from '../lib/walletValue';
import { deleteLoyaltyProgramme, updateLoyaltyProgramme } from '../lib/queries';
import { dayMonthShort } from '../lib/today';
import { ProgrammeDetail } from '../components/ProgrammeDetail';
import { PromotionsTab } from '../components/PromotionsTab';
import { EmptyState, ErrorText, ScreenHeader, SectionLabel } from '../components/ui';

// One programme's page, opened from Status or Today: its ring and figures,
// the stays still to come this year, and its promotions.
export function Programme() {
  const { name = '' } = useParams();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rawProgrammes, refetch } = useLoyaltyProgrammes();
  const { data: hotels } = useAllHotels();
  const { data: promotions } = usePromotions();
  const { data: paymentCards } = usePaymentCards();
  const { data: trips } = useTrips();
  const cardResults = useCardResults(today);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const p = withLiveOverrides(rawProgrammes, hotels, promotions).find((x) => x.name === name);
  if (!p) return wasDeleted('programme', name) ? <Navigate to="/status" replace /> : <div><ScreenHeader title={name} /><EmptyState>Not found</EmptyState></div>;

  const progress = p.category === 'hotel' && p.nextTier && p.nights != null ? computeStatusProgress(p, hotels, promotions, cardResults) : null;
  const tier = progress?.effectiveTier ?? p.tier;
  // Booked stays still to come this year: the grey ticks on the ring.
  const toCome = hotels
    .filter((h) => h.brand === p.name && h.status === 'Booked' && h.date >= today && h.date.slice(0, 4) === today.slice(0, 4))
    .sort((a, b) => a.date.localeCompare(b.date));
  const tripOf = (hotelId: string) => trips.find((t) => t.hotels.some((h) => h.id === hotelId));

  async function save(patch: Parameters<typeof updateLoyaltyProgramme>[1]) {
    setError('');
    try {
      await updateLoyaltyProgramme(p!.name, patch);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function remove() {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    try {
      await deleteLoyaltyProgramme(p!.name);
      // Back to where it was opened from, never to the page of what's gone.
      if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1);
      else navigate('/status', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete it.');
    }
  }

  return (
    <div>
      <ScreenHeader title={p.name} right={tier ? <span className="tag">{tier.replace(/ Elite$/, '')}</span> : undefined} />
      <div className="page-body">
        {error && <ErrorText>{error}</ErrorText>}
        <div className="listcard pad">
          <ProgrammeDetail p={p} progress={progress} paymentCards={paymentCards} onSave={save} />
        </div>

        {toCome.length > 0 && (
          <section>
            <SectionLabel>To come</SectionLabel>
            <div className="listcard">
              {toCome.map((h) => {
                const trip = tripOf(h.id);
                return (
                  <button key={h.id} className="nextrow" onClick={() => trip && navigate(`/trips/${trip.id}`)}>
                    <span className="datecol">
                      <span className="datecol-wd">{dayMonthShort(h.date).split(' ')[1]}</span>
                      <span className="datecol-d">{Number(h.date.slice(8, 10))}</span>
                    </span>
                    <span className="nextrow-main"><span className="rowtitle">{h.name}</span></span>
                    <span className="figure">+{h.nights}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {p.category === 'hotel' && (
          <section>
            <SectionLabel>Promotions</SectionLabel>
            <PromotionsTab brand={p.name} />
          </section>
        )}

        <button className={confirmRemove ? 'removecard confirm' : 'removecard'} onClick={remove}>
          {confirmRemove ? `Remove ${p.name}` : 'Remove programme'}
        </button>
      </div>
    </div>
  );
}
