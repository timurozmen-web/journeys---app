// Tries Supabase first, falls back to mock data if the schema hasn't been
// run yet (or a table is empty) — so the app keeps working today, and
// switches over to real data the moment `supabase/schema.sql` is applied
// and rows exist.
import { useCallback, useEffect, useState } from 'react';
import * as mock from '../data/mock';
import { fetchTrips, fetchLoyaltyProgrammes, fetchPaymentCards, fetchReviews } from './queries';

function useLive<T>(fetcher: () => Promise<T[]>, fallback: T[]) {
  const [data, setData] = useState<T[]>(fallback);
  const [isLive, setIsLive] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    fetcher()
      .then((rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          setData(rows);
          setIsLive(true);
        }
      })
      .catch(() => {
        // table doesn't exist yet, or user isn't signed in — stay on fallback
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  useEffect(() => load(), [load]);

  return { data, isLive, refetch: load };
}

export const useTrips = () => useLive(fetchTrips, mock.trips);
export const useLoyaltyProgrammes = () => useLive(fetchLoyaltyProgrammes, mock.loyaltyProgrammes);
export const usePaymentCards = () => useLive(fetchPaymentCards, mock.paymentCards);
export const useReviews = () => useLive(fetchReviews, mock.reviews);
