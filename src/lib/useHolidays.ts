import { useEffect, useState } from 'react';
import type { Holiday, SchoolHoliday } from './holidays';

// Public and school holidays for the countries and years of a plan,
// through the app's own function (netlify/functions/holidays.js), each
// kind asked and kept apart so one source being down doesn't lose the
// other. Kept on the device for 30 days: holidays don't change, and a
// plan asks again on every edit.
const TTL_MS = 30 * 86400000;
type Kind = 'public' | 'school';
const keyOf = (kind: Kind, code: string, year: number) => `journeys-${kind === 'public' ? 'holidays' : 'school-holidays'}:${code}:${year}`;

function cached<T>(kind: Kind, code: string, year: number): T[] | null {
  try {
    const raw = localStorage.getItem(keyOf(kind, code, year));
    if (!raw) return null;
    const { at, list, holidays } = JSON.parse(raw) as { at: number; list?: T[]; holidays?: T[] };
    // Entries saved before school holidays were added keep their list as `holidays`.
    const got = list ?? (kind === 'public' ? holidays : undefined);
    return got && Date.now() - at < TTL_MS ? got : null;
  } catch {
    return null;
  }
}

function useKind<T>(kind: Kind, wanted: string): Record<string, T[]> {
  const [byKey, setByKey] = useState<Record<string, T[]>>({});
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    for (const pair of wanted.split(',')) {
      const [code, y] = pair.split(':');
      const year = Number(y);
      const hit = cached<T>(kind, code, year);
      if (hit) { setByKey((prev) => (prev[pair] ? prev : { ...prev, [pair]: hit })); continue; }
      fetch(`/.netlify/functions/holidays?country=${code}&year=${year}${kind === 'school' ? '&kind=school' : ''}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { holidays?: T[]; school?: T[] } | null) => {
          const list = kind === 'school' ? data?.school : data?.holidays;
          if (cancelled || !list) return;
          try { localStorage.setItem(keyOf(kind, code, year), JSON.stringify({ at: Date.now(), list })); } catch { /* private mode: this visit only */ }
          setByKey((prev) => ({ ...prev, [pair]: list }));
        })
        .catch(() => { /* offline or unsupported: none shown */ });
    }
    return () => { cancelled = true; };
  }, [kind, wanted]);
  return byKey;
}

/** Holidays by "CODE:year", for every pair asked; a pair that can't be fetched is simply absent. */
export function useHolidays(pairs: { code: string; year: number }[]): { holidays: Record<string, Holiday[]>; school: Record<string, SchoolHoliday[]> } {
  const wanted = [...new Set(pairs.map((p) => `${p.code}:${p.year}`))].sort().join(',');
  return { holidays: useKind<Holiday>('public', wanted), school: useKind<SchoolHoliday>('school', wanted) };
}
