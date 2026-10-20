import { useEffect, useState } from 'react';
import type { Holiday } from './holidays';

// Public holidays for the countries and years of a plan, through the
// app's own function (netlify/functions/holidays.js). Kept on the device
// for 30 days: holidays don't change, and a plan asks again on every edit.
const TTL_MS = 30 * 86400000;
const keyOf = (code: string, year: number) => `journeys-holidays:${code}:${year}`;

function cached(code: string, year: number): Holiday[] | null {
  try {
    const raw = localStorage.getItem(keyOf(code, year));
    if (!raw) return null;
    const { at, holidays } = JSON.parse(raw) as { at: number; holidays: Holiday[] };
    return Date.now() - at < TTL_MS ? holidays : null;
  } catch {
    return null;
  }
}

/** Holidays by "CODE:year", for every pair asked; a pair that can't be fetched is simply absent. */
export function useHolidays(pairs: { code: string; year: number }[]): Record<string, Holiday[]> {
  const wanted = [...new Set(pairs.map((p) => `${p.code}:${p.year}`))].sort().join(',');
  const [byKey, setByKey] = useState<Record<string, Holiday[]>>({});

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    for (const pair of wanted.split(',')) {
      const [code, y] = pair.split(':');
      const year = Number(y);
      const hit = cached(code, year);
      if (hit) { setByKey((prev) => (prev[pair] ? prev : { ...prev, [pair]: hit })); continue; }
      fetch(`/.netlify/functions/holidays?country=${code}&year=${year}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { holidays?: Holiday[] } | null) => {
          if (cancelled || !data?.holidays) return;
          try { localStorage.setItem(keyOf(code, year), JSON.stringify({ at: Date.now(), holidays: data.holidays })); } catch { /* private mode: this visit only */ }
          setByKey((prev) => ({ ...prev, [pair]: data.holidays! }));
        })
        .catch(() => { /* offline or unsupported: no holidays shown */ });
    }
    return () => { cancelled = true; };
  }, [wanted]);

  return byKey;
}
