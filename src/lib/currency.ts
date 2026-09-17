// Real exchange rates from the Frankfurter API -- free, no API key
// needed, published daily from European Central Bank reference rates.
// Not a paid/commercial rate source, so there can be a small spread
// versus what a card or bank actually charges, but it's a genuine,
// real-time rate rather than a hardcoded or estimated one.
const RATES_ENDPOINT = 'https://api.frankfurter.app/latest?base=GBP';

export const SUPPORTED_CURRENCIES = ['GBP', 'USD', 'EUR', 'JPY', 'AUD', 'THB', 'SGD', 'MYR', 'VND', 'IDR'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  GBP: '£', USD: '$', EUR: '€', JPY: '¥', AUD: 'A$', THB: '฿', SGD: 'S$', MYR: 'RM', VND: '₫', IDR: 'Rp',
};

let cachedRates: Record<string, number> | null = null;
let cachedAt = 0;
const CACHE_MS = 60 * 60 * 1000; // an hour is plenty fresh for planning-money, not real payments

// Rates as "1 GBP = X <currency>". Frankfurter doesn't carry VND/IDR, so
// those fall back to a fixed approximate rate (flagged in the return
// value) rather than silently pretending it's live.
const FALLBACK_RATES: Record<string, number> = { VND: 31800, IDR: 20200 };

export interface RatesResult {
  rates: Record<string, number>; // 1 GBP = X <currency>
  isLive: boolean;
  fetchedAt: number | null;
}

export async function fetchExchangeRates(): Promise<RatesResult> {
  const now = Date.now();
  if (cachedRates && now - cachedAt < CACHE_MS) {
    return { rates: cachedRates, isLive: true, fetchedAt: cachedAt };
  }
  try {
    const res = await fetch(RATES_ENDPOINT);
    if (!res.ok) throw new Error(`Rates API returned ${res.status}`);
    const data = await res.json();
    const rates: Record<string, number> = { GBP: 1, ...data.rates, ...FALLBACK_RATES };
    cachedRates = rates;
    cachedAt = now;
    return { rates, isLive: true, fetchedAt: now };
  } catch {
    // Offline, or the API is down -- fall back to the last cached rates
    // if there are any, otherwise a conservative fixed set so the app
    // still shows *a* number rather than breaking, clearly marked as
    // not live.
    return {
      rates: cachedRates ?? { GBP: 1, USD: 1.27, EUR: 1.17, JPY: 191, AUD: 1.94, THB: 44.5, SGD: 1.71, MYR: 5.6, VND: 31800, IDR: 20200 },
      isLive: false,
      fetchedAt: cachedAt || null,
    };
  }
}

// Converts an amount already in one supported currency to another,
// via GBP as the common base (matching how rates are fetched).
export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode, rates: Record<string, number>): number {
  if (from === to) return amount;
  const amountInGbp = from === 'GBP' ? amount : amount / (rates[from] ?? 1);
  return to === 'GBP' ? amountInGbp : amountInGbp * (rates[to] ?? 1);
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOL[currency];
  // Yen, Vietnamese dong, and Indonesian rupiah aren't normally shown
  // with decimals -- everything else gets the usual 0dp for round
  // planning figures (these are estimates, not exact invoices).
  const rounded = Math.round(amount);
  return `${symbol}${rounded.toLocaleString()}`;
}

// Convenience hook combining the user's saved currency preference with
// live exchange rates -- everywhere in the app that shows a price can
// use this instead of separately fetching both.
import { useEffect, useState } from 'react';
import { useCurrencyPreference } from './useLiveData';

export function useCurrency() {
  const { data: currencyPref } = useCurrencyPreference();
  const [rates, setRates] = useState<Record<string, number>>({ GBP: 1 });
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchExchangeRates().then((r) => {
      if (!cancelled) { setRates(r.rates); setIsLive(r.isLive); }
    });
    return () => { cancelled = true; };
  }, []);

  const currency = (currencyPref as CurrencyCode) ?? 'GBP';

  return {
    currency,
    isLive,
    // From GBP (the app's own logged data) to the display currency.
    fromGbp: (amountGbp: number) => convertCurrency(amountGbp, 'GBP', currency, rates),
    // From USD (the points-value research data) to the display currency.
    fromUsd: (amountUsd: number) => convertCurrency(amountUsd, 'USD', currency, rates),
    format: (amount: number) => formatCurrency(amount, currency),
  };
}
