import { useState, useEffect, useRef } from 'react';
import { loadWorldCities, type WorldCity } from '../data/worldCitiesLoader';

// Common destination names that don't match the actual city name in the
// dataset (Okinawa is the island/prefecture; Naha is the city). Small and
// hand-curated -- extend as more gaps are found, rather than trying to
// solve this generally.
const CITY_ALIASES: Record<string, string> = {
  okinawa: 'Naha',
  bali: 'Denpasar',
  tuscany: 'Florence',
  provence: 'Marseille',
};

export function CitySearchInput({
  country, selected, onChange,
}: {
  country: string; selected: WorldCity[]; onChange: (cities: WorldCity[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [allCities, setAllCities] = useState<WorldCity[] | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWorldCities().then(setAllCities);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedNames = new Set(selected.map((c) => c.name));
  const inCountry = (allCities ?? []).filter((c) => c.country === country && !selectedNames.has(c.name));
  const q = query.trim().toLowerCase();
  const aliasTarget = CITY_ALIASES[q];
  const matches = q
    ? inCountry.filter((c) => c.name.toLowerCase().startsWith(q) || (aliasTarget && c.name === aliasTarget)).slice(0, 8)
    : inCountry.slice(0, 8); // already sorted by population, so this is "biggest cities first"

  function addCity(city: WorldCity) {
    onChange([...selected, city]);
    setQuery('');
    setOpen(false);
  }
  function removeCity(name: string) {
    onChange(selected.filter((c) => c.name !== name));
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {selected.map((c) => (
            <span
              key={c.name}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 5px 4px 10px',
                borderRadius: 99, background: 'rgba(91,63,166,.08)', border: '1px solid var(--brand)',
                fontSize: 12, fontWeight: 700, color: 'var(--brand)',
              }}
            >
              {c.name}
              <button
                onClick={() => removeCity(c.name)}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 13, padding: '0 3px', lineHeight: 1 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={selected.length > 0 ? 'Add another city…' : 'Search cities, or leave blank to let us suggest'}
        style={{
          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
          color: 'var(--ink)', fontSize: 13.5, padding: '10px 11px', width: '100%', outline: 'none', boxSizing: 'border-box',
        }}
      />

      {open && matches.length > 0 && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto',
          }}
        >
          {matches.map((c) => (
            <button
              key={c.name}
              onClick={() => addCity(c)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                background: 'none', border: 'none', borderBottom: '1px solid var(--line)',
                fontSize: 13, color: 'var(--ink)', cursor: 'pointer',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
