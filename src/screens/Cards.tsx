import { useLocation, useNavigate } from 'react-router-dom';
import { useAllHotels, useBankLinks, useLoyaltyProgrammes, usePaymentCards, usePromotions } from '../lib/useLiveData';
import { useCardResults } from '../lib/useCardResults';
import { withLiveOverrides } from '../lib/walletValue';
import { PaymentTab } from '../components/PaymentTab';
import { BankStatus } from '../components/BankStatus';
import { PlusIcon } from '../components/Icons';

// Cards: the ring carousel with the lead card's goals and earning below,
// then memberships and archived cards. Bank sync sits on top.
export function Cards() {
  const navigate = useNavigate();
  // Arriving from bank setup or a new card: open with that card in front.
  const arrival = (useLocation().state ?? null) as { tracked?: string[] } | null;
  const today = new Date().toISOString().slice(0, 10);
  const { data: rawProgrammes } = useLoyaltyProgrammes();
  const { data: hotels } = useAllHotels();
  const { data: promotions } = usePromotions();
  const { refetch: refetchCards } = usePaymentCards();
  const { connections, accounts } = useBankLinks();
  const cardResults = useCardResults(today);

  return (
    <div>
      <div className="topspace" />
      <div className="homehead">
        <h1 className="h1" style={{ margin: 0 }}>Cards</h1>
        <button className="iconbtn" aria-label="Add a card" onClick={() => navigate('/add-card', { state: { back: true } })}><PlusIcon size={20} /></button>
      </div>
      <div style={{ paddingTop: 4 }}>
        <BankStatus connections={connections} accounts={accounts} onOpen={() => navigate('/bank-sync')} />
        <PaymentTab
          cardResults={cardResults}
          loyaltyProgrammes={withLiveOverrides(rawProgrammes, hotels, promotions)}
          refetchCards={refetchCards}
          initialOpen={arrival?.tracked?.[0] ?? null}
        />
      </div>
    </div>
  );
}
