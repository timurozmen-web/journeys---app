// Tries Supabase first, falls back to mock data if the schema hasn't been
// run yet (or a table is empty) — so the app keeps working today, and
// switches over to real data the moment `supabase/schema.sql` is applied
// and rows exist.
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as mock from '../data/mock';
import { getCached, setCached } from './localCache';
import type { BankLinks } from './queries';
import { groupBankSpend } from './bankSpend';
import { fetchTrips, fetchLoyaltyProgrammes, fetchPaymentCards, fetchReviews, fetchAllHotels, fetchAllFlights, fetchVouchers, fetchPromotions, fetchBankLinks, fetchPromotionCandidates, fetchDiscoverItems, fetchHomeLocation, fetchClimateData, fetchCrowdPriceData, fetchPointsValueData, fetchCityCashRates, fetchCurrencyPreference } from './queries';

function useLive<T>(cacheKey: string, fetcher: () => Promise<T[]>, fallback: T[]) {
  // Synchronous on first render, not an effect -- this is what makes
  // reopening the app show real data immediately instead of a blank or
  // mock flash while the network call is still in flight. cacheKey is
  // an explicit string, not fetcher.name -- production builds minify
  // function names, so the same function can get a different .name
  // across builds (confirmed directly: 'fetchTrips' doesn't appear
  // anywhere in the built bundle at all), which would silently break
  // the cache lookup or invalidate it on every deploy.
  const [data, setData] = useState<T[]>(() => getCached<T[]>(cacheKey)?.data ?? fallback);
  const [isLive, setIsLive] = useState(() => getCached<T[]>(cacheKey) != null);
  const [cachedAt, setCachedAt] = useState<number | null>(() => getCached<T[]>(cacheKey)?.cachedAt ?? null);

  const load = useCallback(() => {
    let cancelled = false;
    fetcher()
      .then((rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          setData(rows);
          setIsLive(true);
          setCachedAt(Date.now());
          setCached(cacheKey, rows);
        }
      })
      .catch((err) => {
        // A real error here (not just no rows yet) is exactly the kind
        // of thing that has been hard to diagnose remotely -- log it so
        // it shows up in the browser console instead of silently
        // falling back to mock data with no trace of why. The state
        // itself is deliberately left untouched -- whatever was already
        // showing (cached real data, or the mock fallback) stays put
        // rather than being reset, since a failed refresh shouldn't
        // erase a perfectly good cached result.
        console.error(`[useLive] ${cacheKey} failed, keeping cached/mock data:`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, fetcher]);

  useEffect(() => load(), [load]);

  return { data, isLive, cachedAt, refetch: load };
}

// Same idea as useLive, but for a single-object fetch (e.g. one row of
// preferences) rather than a list -- useLive's "rows.length > 0" check
// doesn't apply to a plain object/null result.
function useLiveSingle<T>(cacheKey: string, fetcher: () => Promise<T | null>, fallback: T) {
  const [data, setData] = useState<T>(() => getCached<T>(cacheKey)?.data ?? fallback);
  const [isLive, setIsLive] = useState(() => getCached<T>(cacheKey) != null);

  const load = useCallback(() => {
    let cancelled = false;
    fetcher()
      .then((row) => {
        if (cancelled) return;
        if (row != null) {
          setData(row);
          setIsLive(true);
          setCached(cacheKey, row);
        }
      })
      .catch((err) => {
        console.error(`[useLiveSingle] ${cacheKey} failed, keeping cached/mock data:`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, cacheKey]);

  useEffect(() => load(), [load]);

  return { data, isLive, refetch: load };
}

export const useTrips = () => useLive('trips', fetchTrips, mock.trips);
export const useLoyaltyProgrammes = () => useLive('loyaltyProgrammes', fetchLoyaltyProgrammes, mock.loyaltyProgrammes);
export const usePaymentCards = () => useLive('paymentCards', fetchPaymentCards, mock.paymentCards);
export const useReviews = () => useLive('reviews', fetchReviews, mock.reviews);
export const useAllHotels = () => useLive('allHotels', fetchAllHotels, mock.trips.flatMap((t) => t.hotels));
export const useAllFlights = () => useLive('allFlights', fetchAllFlights, mock.trips.flatMap((t) => t.flights));
export const useVouchers = () => useLive('vouchers', fetchVouchers, []);
export const usePromotions = () => useLive('promotions', fetchPromotions, []);

const NO_BANK_LINKS: BankLinks = { connections: [], accounts: [], spend: [] };

// Bank connections, their accounts and synced card purchases. Not built on
// useLive: that hook keeps old data when a fetch returns nothing, which
// would leave a disconnected bank showing until the cache expired. Here an
// empty result is a real answer (nothing connected).
export function useBankLinks() {
  const [data, setData] = useState<BankLinks>(() => getCached<BankLinks>('bankLinks')?.data ?? NO_BANK_LINKS);
  const [loaded, setLoaded] = useState(false);
  // Resolves once fresh data is in (and cached for other screens), so a
  // flow can wait for it before moving on.
  const refetch = useCallback(() =>
    fetchBankLinks()
      .then((d) => { setData(d); setLoaded(true); setCached('bankLinks', d); })
      .catch((err) => console.error('[useBankLinks] fetch failed, keeping the cached copy:', err)),
  []);
  useEffect(() => { void refetch(); }, [refetch]);
  // The bank link can finish in another browser tab or the installed app
  // while this one sits in the background, so look again on return.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refetch(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);
  const bankSpend = useMemo(() => groupBankSpend(data.accounts, data.spend), [data]);
  return { ...data, bankSpend, loaded, refetch };
}
export const usePromotionCandidates = () => useLive('promotionCandidates', fetchPromotionCandidates, []);
export const useDiscoverItems = () => useLive('discoverItems', fetchDiscoverItems, mock.discoverItems);
export const useHomeLocation = () => useLiveSingle('homeLocation', fetchHomeLocation, { city: 'London', country: 'United Kingdom' });
export const useClimateData = () => useLive('climateData', fetchClimateData, []);
export const useCrowdPriceData = () => useLive('crowdPriceData', fetchCrowdPriceData, []);
export const usePointsValueData = () => useLive('pointsValueData', fetchPointsValueData, []);
export const useCityCashRates = () => useLive('cityCashRates', fetchCityCashRates, []);
export const useCurrencyPreference = () => useLiveSingle('currencyPreference', fetchCurrencyPreference, 'GBP');
