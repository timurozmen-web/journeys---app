import { useState, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviews, useAllHotels, useAllFlights, useTrips } from '../lib/useLiveData';
import { findHotelsNeedingReview } from '../lib/reviewScoring';
import { flightDistanceKm, estimateFlightHours } from '../lib/travelStats';
const WorldMap = lazy(() => import('../components/WorldMap').then((m) => ({ default: m.WorldMap })));

const CATEGORIES = [
  { key: 'overall', label: 'Overall' },
  { key: 'service', label: 'Service' },
  { key: 'value', label: 'Value' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'food', label: 'Food' },
  { key: 'shower', label: 'Shower' },
];

type SortMode = 'score' | 'recent' | 'az';
const SHOW_INITIALLY = 10;

function yearOf(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const y = Number(dateStr.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function rankBadge(rank: number) {
  if (rank === 1) return { bg: '#F4C430', fg: '#5C4300' };
  if (rank === 2) return { bg: '#D6DCE5', fg: '#3A4150' };
  if (rank === 3) return { bg: '#E3A76F', fg: '#5C3A17' };
  return null;
}

export function Profile() {
  const navigate = useNavigate();
  const [cat, setCat] = useState('overall');
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [year, setYear] = useState<'all' | number>('all');

  const { data: reviews } = useReviews();
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const { data: trips } = useTrips();
  const today = new Date().toISOString().slice(0, 10);
  const needsReview = findHotelsNeedingReview(trips, reviews, today);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const h of hotels) { const y = yearOf(h.date); if (y) set.add(y); }
    for (const f of flights) { const y = yearOf(f.date); if (y) set.add(y); }
    return [...set].sort((a, b) => b - a);
  }, [hotels, flights]);

  const firstYear = years.length > 0 ? Math.min(...years) : null;

  const filteredHotels = useMemo(
    () => (year === 'all' ? hotels : hotels.filter((h) => yearOf(h.date) === year)),
    [hotels, year]
  );
  const filteredFlights = useMemo(
    () => (year === 'all' ? flights : flights.filter((f) => yearOf(f.date) === year)),
    [flights, year]
  );
  const filteredReviews = useMemo(
    () => (year === 'all' ? reviews : reviews.filter((r) => yearOf(r.date) === year)),
    [reviews, year]
  );

  const visitedCountries = new Set(filteredHotels.map((h) => h.country.trim()).filter(Boolean));
  const totalNights = filteredHotels.reduce((s, h) => s + h.nights, 0);
  const totalStays = filteredHotels.length;
  const totalFlights = filteredFlights.length;

  const { totalDistanceKm, totalHours } = useMemo(() => {
    let km = 0, hrs = 0;
    for (const f of filteredFlights) {
      if (f.status !== 'Completed') continue;
      km += flightDistanceKm(f);
      hrs += estimateFlightHours(f);
    }
    return { totalDistanceKm: km, totalHours: hrs };
  }, [filteredFlights]);

  const regionTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of filteredHotels) {
      const region = regionFor(h.country);
      m.set(region, (m.get(region) ?? 0) + h.nights);
    }
    return [...m.entries()].map(([n, nights]) => ({ n, nights })).sort((a, b) => b.nights - a.nights);
  }, [filteredHotels]);
  const maxRegion = Math.max(1, ...regionTotals.map((r) => r.nights));
  const focusCountries = regionFilter
    ? [...new Set(filteredHotels.filter((h) => regionFor(h.country) === regionFilter).map((h) => h.country))]
    : null;

  const categoryReviews = filteredReviews
    .filter((r) => r.category === cat)
    .filter((r) => !regionFilter || regionFor(r.country) === regionFilter);
  const sorted = useMemo(() => {
    const arr = [...categoryReviews];
    if (sortMode === 'score') arr.sort((a, b) => b.score - a.score);
    else if (sortMode === 'recent') arr.sort((a, b) => (b.date > a.date ? 1 : -1));
    else arr.sort((a, b) => a.hotelName.localeCompare(b.hotelName));
    return arr;
  }, [categoryReviews, sortMode]);
  const visible = showAll ? sorted : sorted.slice(0, SHOW_INITIALLY);

  return (
    <div>
      <div style={{ background: '#fff', height: 'env(safe-area-inset-top, 0px)' }} />
      <div style={{ background: 'linear-gradient(165deg,#4A3189 0%,#5B3FA6 100%)', padding: '24px 20px 4px', color: '#fff', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.28)', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800, flexShrink: 0 }}>T</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.6px' }}>Timur</div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginTop: 2 }}>
              {firstYear ? `Travelling since ${firstYear}` : 'Traveller'} · {reviews.filter((r) => r.category === 'overall').length} reviews
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 20, paddingBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.8px' }}>{visitedCountries.size}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>countries</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.8px' }}>{totalNights}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>nights</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.8px' }}>{totalDistanceKm >= 1000 ? `${Math.round(totalDistanceKm / 1000)}k` : totalDistanceKm}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>km flown</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.8px' }}>
              {(() => {
                const overall = reviews.filter((r) => r.category === 'overall');
                return overall.length ? (overall.reduce((s, r) => s + r.score, 0) / overall.length).toFixed(1) : '—';
              })()}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>avg score</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 20px 4px' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          <button
            onClick={() => setYear('all')}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 99, border: '1px solid var(--line)',
              background: year === 'all' ? 'var(--brand)' : 'var(--card2)', color: year === 'all' ? '#fff' : 'var(--ink2)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            All time
          </button>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 99, border: '1px solid var(--line)',
                background: year === y ? 'var(--brand)' : 'var(--card2)', color: year === y ? '#fff' : 'var(--ink2)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {needsReview.length > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Outstanding
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {needsReview.map((h) => (
              <button
                key={h.hotelId}
                onClick={() => navigate('/review-trip', { state: { hotel: h } })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(91,63,166,.15)',
                  background: 'rgba(91,63,166,.05)', textAlign: 'left', cursor: 'pointer', width: '100%',
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>Rate your stay at {h.hotelName}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{h.tripTitle} · {h.date}</div>
                </div>
                <span style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Rate ›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sect"><h2>{year === 'all' ? 'All time' : year} at a glance</h2></div>
      <div className="stack">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatTile label="Stays" value={totalStays.toLocaleString()} />
          <StatTile label="Flights" value={totalFlights.toLocaleString()} />
          <StatTile label="Distance flown" value={`${Math.round(totalDistanceKm).toLocaleString()} km`} />
          <StatTile label="Hours flown" value={`${Math.round(totalHours)}h`} />
        </div>
      </div>

      <div className="stack">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 4px' }}>
            <div style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>Countries visited</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{visitedCountries.size}</div>
          </div>
          <Suspense fallback={<div style={{ height: 200, background: '#DCE7F5' }} />}>
            <WorldMap hotels={filteredHotels} flights={filteredFlights} reviews={filteredReviews} focusCountries={focusCountries} />
          </Suspense>
        </div>
      </div>

      {regionTotals.length > 0 && (
        <>
          <div className="sect" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2>Time by region</h2>
            {regionFilter && (
              <button
                onClick={() => setRegionFilter(null)}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="stack">
            <div className="card">
              {regionTotals.map((r, i) => {
                const active = regionFilter === r.n;
                return (
                  <button
                    key={r.n}
                    onClick={() => setRegionFilter(active ? null : r.n)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      marginBottom: i === regionTotals.length - 1 ? 0 : 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700 }}>
                      <span style={{ color: active ? 'var(--brand)' : 'var(--ink)' }}>{r.n}</span>
                      <span style={{ color: 'var(--ink2)' }}>{r.nights}n</span>
                    </div>
                    <div className="hbar" style={{ background: 'var(--card2)' }}>
                      <i style={{ width: `${(r.nights / maxRegion) * 100}%`, background: active ? 'var(--brand)' : 'rgba(91,63,166,.45)' }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {regionFilter && (
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', padding: '0 4px' }}>
                Showing reviews from {regionFilter} only — tap the region again, or "Clear filter" above, to see everything.
              </div>
            )}
          </div>
        </>
      )}

      <div className="sect"><h2>Reviews{regionFilter ? ` · ${regionFilter}` : ''}</h2></div>
      <div className="catchip">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={cat === c.key ? 'won' : ''} onClick={() => { setCat(c.key); setShowAll(false); }}>
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '10px 20px 0', display: 'flex', gap: 6 }}>
        {([['score', 'Top rated'], ['recent', 'Most recent'], ['az', 'A–Z']] as [SortMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            style={{
              padding: '5px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              border: sortMode === mode ? '1px solid var(--brand)' : '1px solid var(--line)',
              background: sortMode === mode ? 'rgba(91,63,166,.08)' : 'var(--card)',
              color: sortMode === mode ? 'var(--brand)' : 'var(--ink2)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="stack">
        <div style={{ display: 'grid', gap: 8 }}>
          {sorted.length === 0 && (
            <div style={{ padding: '14px 4px', fontSize: 12.5, color: 'var(--ink3)' }}>No reviews yet in this category.</div>
          )}
          {visible.map((r, i) => {
            const rank = sortMode === 'score' ? i + 1 : null;
            const badge = rank ? rankBadge(rank) : null;
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                  borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)',
                }}
              >
                {rank && (
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                      fontSize: 11, fontWeight: 800,
                      background: badge ? badge.bg : 'var(--card2)', color: badge ? badge.fg : 'var(--ink3)',
                    }}
                  >
                    {rank}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.hotelName}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 1 }}>{r.country} · {r.date}</div>
                </div>
                <div
                  style={{
                    fontSize: 14, fontWeight: 800, flexShrink: 0,
                    color: r.score >= 6.7 ? 'var(--green)' : r.score >= 3.4 ? 'var(--amber)' : 'var(--red)',
                  }}
                >
                  {r.score.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>

        {sorted.length > SHOW_INITIALLY && (
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              marginTop: 10, width: '100%', padding: '11px 0', borderRadius: 12, border: '1px solid var(--line)',
              background: 'var(--card)', color: 'var(--brand)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showAll ? 'Show top 10' : `Show all ${sorted.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink2)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const REGION_MAP: Record<string, string> = {
  Indonesia: 'Oceania & SE Asia', Australia: 'Oceania & SE Asia', Thailand: 'Oceania & SE Asia',
  Singapore: 'Oceania & SE Asia', Malaysia: 'Oceania & SE Asia', Vietnam: 'Oceania & SE Asia',
  Turkey: 'Europe & Middle East', Türkiye: 'Europe & Middle East', UAE: 'Europe & Middle East',
  Qatar: 'Europe & Middle East', France: 'Europe & Middle East', Spain: 'Europe & Middle East',
  Italy: 'Europe & Middle East', Portugal: 'Europe & Middle East', Greece: 'Europe & Middle East',
  Germany: 'Europe & Middle East', Austria: 'Europe & Middle East', Czechia: 'Europe & Middle East',
  Sweden: 'Europe & Middle East', Ireland: 'Europe & Middle East', 'United Kingdom': 'Europe & Middle East',
  Canada: 'Americas', 'United States': 'Americas', Mexico: 'Americas', Peru: 'Americas', Chile: 'Americas',
  India: 'South Asia', 'Sri Lanka': 'South Asia', Nepal: 'South Asia', Maldives: 'South Asia',
};
function regionFor(country: string): string {
  return REGION_MAP[country.trim()] ?? 'Other';
}
