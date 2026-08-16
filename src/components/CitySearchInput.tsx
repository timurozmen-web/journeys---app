import { useState, useEffect, useRef } from 'react';
import { loadWorldCities, type WorldCity } from '../data/worldCitiesLoader';
import { fetchLandmarksForCountry, type Landmark } from '../lib/queries';

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
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWorldCities().then(setAllCities);
  }, []);

  useEffect(() => {
    fetchLandmarksForCountry(country).then(setLandmarks).catch(() => setLandmarks([]));
  }, [country]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedNames = new Set(selected.map((c) => c.name));
  const inCountry = (allCities ?? []).filter((c) => c.country === country && !selectedNames.has(c.name));
  const availableLandmarks = landmarks.filter((l) => !selectedNames.has(l.name));
  const q = query.trim().toLowerCase();
  const aliasTarget = CITY_ALIASES[q];
  const cityMatches = q
    ? inCountry.filter((c) => c.name.toLowerCase().startsWith(q) || (aliasTarget && c.name === aliasTarget)).slice(0, 8)
    : inCountry.slice(0, 6); // already sorted by population, so this is "biggest cities first"
  const landmarkMatches = q
    ? availableLandmarks.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 4)
    : availableLandmarks.slice(0, 3);

  function addCity(city: WorldCity) {
    onChange([...selected, city]);
    setQuery('');
    setOpen(false);
  }
  function addLandmark(l: Landmark) {
    onChange([...selected, { name: l.name, lat: l.lat, lng: l.lng, country: l.country, pop: 0 }]);
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

      {open && (cityMatches.length > 0 || landmarkMatches.length > 0) && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 260, overflowY: 'auto',
          }}
        >
          {cityMatches.map((c) => (
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
          {landmarkMatches.map((l) => (
            <button
              key={l.name}
              onClick={() => addLandmark(l)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>{l.name}</span>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, color: 'var(--brand)', background: 'rgba(91,63,166,.1)',
                  padding: '1px 6px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.04em',
                }}>
                  {l.category}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{l.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
