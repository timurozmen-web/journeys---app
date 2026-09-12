import { useState, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviews, useAllHotels, useAllFlights, useTrips } from '../lib/useLiveData';
import { findHotelsNeedingReview, findHotelsMissingCategories, REVIEW_CATEGORIES } from '../lib/reviewScoring';
import { flightDistanceKm, estimateFlightHours } from '../lib/travelStats';
import { SettingsIcon, StarIcon } from '../components/Icons';
import { lazyWithRetry } from '../lib/lazyWithRetry';
const WorldMap = lazyWithRetry(() => import('../components/WorldMap').then((m) => ({ default: m.WorldMap })));

const CATEGORIES = [
  { key: 'overall', label: 'Overall' },
  { key: 'service', label: 'Service' },
  { key: 'value', label: 'Value' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'food', label: 'Food' },
  { key: 'shower', label: 'Shower' },
  { key: 'bed', label: 'Bed' },
  { key: 'room', label: 'Room' },
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
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);

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
  const missingCategories = findHotelsMissingCategories(trips, reviews);
  const categoryLabel = (key: string) => REVIEW_CATEGORIES.find((c) => c.key === key)?.label ?? key;

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

  // Rank by property, not by individual review -- a re-reviewed hotel's
  // score is the average of its (up to 3) reviews, since opinions can
  // genuinely change on a second or third stay rather than the latest
  // review just overwriting the story.
  type RankedProperty = { key: string; hotelName: string; country: string; avgScore: number; reviewCount: number; latestDate: string; latestId: string; entries: { id: string; date: string; score: number }[] };
  const grouped = useMemo(() => {
    const m = new Map<string, RankedProperty>();
    for (const r of categoryReviews) {
      const key = r.hotelName.trim().toLowerCase();
      const existing = m.get(key);
      if (existing) {
        const totalScore = existing.avgScore * existing.reviewCount + r.score;
        existing.reviewCount += 1;
        existing.avgScore = totalScore / existing.reviewCount;
        existing.entries.push({ id: r.id, date: r.date, score: r.score });
        if (r.date > existing.latestDate) { existing.latestDate = r.date; existing.latestId = r.id; }
      } else {
        m.set(key, { key, hotelName: r.hotelName, country: r.country, avgScore: r.score, reviewCount: 1, latestDate: r.date, latestId: r.id, entries: [{ id: r.id, date: r.date, score: r.score }] });
      }
    }
    return [...m.values()];
  }, [categoryReviews]);

  const sorted = useMemo(() => {
    const arr = [...grouped];
    if (sortMode === 'score') arr.sort((a, b) => b.avgScore - a.avgScore);
    else if (sortMode === 'recent') arr.sort((a, b) => (b.latestDate > a.latestDate ? 1 : -1));
    else arr.sort((a, b) => a.hotelName.localeCompare(b.hotelName));
    return arr;
  }, [grouped, sortMode]);
  const visible = showAll ? sorted : sorted.slice(0, SHOW_INITIALLY);

  return (
    <div>
      <div style={{ background: 'var(--bg)', height: 'env(safe-area-inset-top, 0px)' }} />
      <div style={{ padding: '20px 20px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: 'var(--brand)', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0, color: '#fff', fontFamily: 'var(--font-display)' }}>T</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--ink)' }}>Timur</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginTop: 2 }}>
              {firstYear ? `Travelling since ${firstYear}` : 'Traveller'} · {reviews.filter((r) => r.category === 'overall').length} reviews
            </div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--card)', display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer' }}
          >
            <SettingsIcon size={19} color="var(--ink2)" />
          </button>
        </div>
        <div style={{ display: 'flex', marginTop: 20, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.6px', color: 'var(--ink)' }}>{visitedCountries.size}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>countries</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.6px', color: 'var(--ink)' }}>{totalNights}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>nights</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.6px', color: 'var(--ink)' }}>{totalDistanceKm >= 1000 ? `${Math.round(totalDistanceKm / 1000)}k` : totalDistanceKm}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>km flown</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.6px', color: 'var(--ink)' }}>
              {(() => {
                const overall = reviews.filter((r) => r.category === 'overall');
                return overall.length ? (overall.reduce((s, r) => s + r.score, 0) / overall.length).toFixed(1) : '—';
              })()}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>avg score</div>
          </div>
        </div>
      </div>

      {needsReview.length > 0 && (
        <div style={{ padding: '18px 0 0' }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, padding: '0 20px' }}>
            Outstanding
          </div>
          <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '0 20px', scrollbarWidth: 'none' }}>
            {needsReview.map((h) => (
              <button
                key={h.hotelId}
                onClick={() => navigate('/review-trip', { state: { hotel: h } })}
                style={{
                  flex: '0 0 100%', width: '100%', scrollSnapAlign: 'start', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderRadius: 18,
                  border: '1px solid var(--line)', background: 'var(--card)', boxShadow: '0 4px 14px rgba(23,23,28,.06)',
                }}
              >
                <span style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--brand)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <StarIcon size={20} color="#fff" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' }}>Rate your stay at {h.hotelName}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>{h.tripTitle} · {h.date}</span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: '#fff', background: 'var(--brand)', borderRadius: 99, padding: '7px 14px' }}>Rate</span>
              </button>
            ))}
          </div>
          {needsReview.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              {needsReview.map((h) => (
                <span key={h.hotelId} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--line)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {missingCategories.length > 0 && (
        <div style={{ padding: '18px 0 0' }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, padding: '0 20px' }}>
            Complete your ratings ({missingCategories.length})
          </div>
          <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '0 20px', scrollbarWidth: 'none' }}>
            {missingCategories.map((m) => (
              <button
                key={m.hotelName}
                onClick={() => navigate('/review-trip', {
                  state: {
                    hotel: { tripId: '', tripTitle: '', hotelId: m.hotelId, hotelName: m.hotelName, country: m.country, date: m.date },
                    onlyCategories: m.missing,
                  },
                })}
                style={{
                  flex: '0 0 100%', width: '100%', scrollSnapAlign: 'start', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16,
                  border: '1px solid var(--line)', background: 'var(--card)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{m.hotelName}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>
                    Missing: {m.missing.map(categoryLabel).join(', ')}
                  </span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>Complete ›</span>
              </button>
            ))}
          </div>
          {missingCategories.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              {missingCategories.map((m) => (
                <span key={m.hotelName} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--line)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="sect" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{year === 'all' ? 'All time' : year} at a glance</h2>
        <select
          value={year === 'all' ? 'all' : String(year)}
          onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          style={{
            padding: '6px 11px', borderRadius: 99, border: '1px solid var(--line)', background: 'var(--card)',
            color: 'var(--ink)', fontSize: 12.5, fontWeight: 700, font: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="all">All time</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="stack">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatTile label="Stays" value={totalStays.toLocaleString()} />
          <StatTile label="Flights" value={totalFlights.toLocaleString()} />
          <StatTile label="Distance flown" value={`${Math.round(totalDistanceKm).toLocaleString()} km`} />
          <StatTile label="Hours flown" value={`${Math.round(totalHours)}h`} />
        </div>
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 6px 18px rgba(23,23,28,.12)' }}>
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
                      <i style={{ width: `${(r.nights / maxRegion) * 100}%`, background: active ? 'var(--brand)' : 'rgba(30,58,143,.45)' }} />
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
              padding: '6px 14px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              border: sortMode === mode ? 'none' : '1px solid var(--line)',
              background: sortMode === mode ? 'var(--brand)' : 'var(--card)',
              color: sortMode === mode ? '#fff' : 'var(--ink2)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {sorted.length === 0 && (
            <div style={{ padding: '14px 4px', fontSize: 12.5, color: 'var(--ink3)' }}>No reviews yet in this category.</div>
          )}
          {visible.map((r, i) => {
            const rank = sortMode === 'score' ? i + 1 : null;
            const badge = rank ? rankBadge(rank) : null;
            // Most recent completed stay at this hotel across every trip --
            // a re-review reflects the latest real visit, not necessarily
            // the specific stay that originally triggered the review.
            const mostRecentStay = [...hotels]
              .filter((h) => h.status === 'Completed' && h.name.trim().toLowerCase() === r.hotelName.trim().toLowerCase())
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            return (
              <div
                key={r.key}
                onClick={() => setExpandedHotel(expandedHotel === r.key ? null : r.key)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 0, padding: '11px 14px', cursor: 'pointer',
                  borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 1 }}>
                      {r.country} · {r.latestDate}{r.reviewCount > 1 ? ` · average rating (${r.reviewCount} reviews)` : ''}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 14, fontWeight: 800, flexShrink: 0,
                      color: r.avgScore >= 6.7 ? 'var(--green)' : r.avgScore >= 3.4 ? 'var(--amber)' : 'var(--red)',
                    }}
                  >
                    {r.avgScore.toFixed(1)}
                  </div>
                </div>
                {expandedHotel === r.key && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', display: 'grid', gap: 6 }}>
                    {r.entries.length > 1 && (
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Average rating, from {r.entries.length} visits
                      </div>
                    )}
                    {[...r.entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--ink2)' }}>{e.date}</span>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{e.score.toFixed(1)}</span>
                      </div>
                    ))}
                    {mostRecentStay && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); navigate('/review-trip', { state: { hotel: { tripId: '', tripTitle: '', hotelId: mostRecentStay.id, hotelName: mostRecentStay.name, country: mostRecentStay.country, date: mostRecentStay.date } } } ); }}
                        style={{ marginTop: 2, background: 'none', border: 'none', color: 'var(--brand)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left' }}
                      >
                        Review again
                      </button>
                    )}
                  </div>
                )}
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
