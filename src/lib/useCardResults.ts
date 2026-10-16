import { useEffect, useMemo } from 'react';
import { useAllFlights, useAllHotels, useBankLinks, useLoyaltyProgrammes, usePaymentCards } from './useLiveData';
import { useCurrency } from './currency';
import { computeCardResults, computeCardVoucherCandidates, type CardResult } from './cardMath';
import { syncCardVouchers } from './queries';

// What was last written, shared by every screen using this, so opening
// Today then Cards doesn't write the same vouchers twice.
let lastSynced = '';

/**
 * Every card held (the catalogue is bigger), with its spend, points,
 * milestones and bonus nights this card-year. Vouchers a card has newly
 * earned are recorded as soon as the results are known, from whichever
 * screen worked them out first.
 */
export function useCardResults(today: string): CardResult[] {
  const { data: programmes } = useLoyaltyProgrammes();
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const { data: paymentCards } = usePaymentCards();
  const { bankSpend } = useBankLinks();
  const { rates } = useCurrency();

  const results = useMemo(
    () => computeCardResults(hotels, flights, paymentCards, programmes, today, { bankSpend, rates }).filter((r) => r.cardRow),
    [hotels, flights, paymentCards, programmes, today, bankSpend, rates],
  );

  // Written once per change in what's earned, not on every refetch.
  const candidates = useMemo(() => computeCardVoucherCandidates(results), [results]);
  const key = candidates.map((c) => `${c.sourceKey}:${c.earnedDate}:${c.expiryDate}`).join('|');
  useEffect(() => {
    if (candidates.length === 0 || key === lastSynced) return;
    lastSynced = key;
    syncCardVouchers(candidates).catch(() => { lastSynced = ''; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return results;
}
