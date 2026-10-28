import { useState, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviews, useReviewPhotos, useAllHotels, useAllFlights, useTrips } from '../lib/useLiveData';
import { aspectPhoto, scoreColour } from '../lib/reviewSummary';
import { ScreenHeader } from '../components/ui';
import { completedStays, shareOfWorld, visitedCountries } from '../lib/logbook';
import { useGlobalAirports } from '../lib/useGlobalAirports';
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

function rankBadge(rank: number) {
  if (rank === 1) return { bg: '#F4C430', fg: '#5C4300' };
  if (rank === 2) return { bg: '#D6DCE5', fg: '#3A4150' };
  if (rank === 3) return { bg: '#E3A76F', fg: '#5C3A17' };
  return null;
}

// The map: every country you've been, scratched off, and the stays you've
// rated, best first. Past trips themselves live on Trips; stays waiting
// for a rating are on Today.
export function Places() {
  const navigate = useNavigate();
  const [cat, setCat] = useState('overall');
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [showAll, setShowAll] = useState(false);

  const { data: reviews, isLive: reviewsLive } = useReviews();
  const { data: photos } = useReviewPhotos();
  const { data: hotels, isLive: hotelsLive } = useAllHotels();
  const { data: flights, isLive: flightsLive } = useAllFlights();
  const { isLive: tripsLive } = useTrips();
  const showingMockData = !reviewsLive || !hotelsLive || !flightsLive || !tripsLive;

  // The map shades the same completed stays the count is made from, so a
  // booked-but-not-taken trip never colours a country. Countries reached
  // by flight count as well as those stayed in (connections excluded).
  const loggedStays = useMemo(() => completedStays(hotels), [hotels]);
  const airports = useGlobalAirports();
  const completedFlights = useMemo(() => flights.filter((f) => f.status === 'Completed'), [flights]);
  const visited = useMemo(
    () => visitedCountries(hotels, completedFlights, (iata) => airports?.get(iata)?.country ?? null),
    [hotels, completedFlights, airports],
  );
  const countryCount = visited.size;
  const categoryReviews = reviews.filter((r) => r.category === cat);

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
      <ScreenHeader title="Map" />

      {showingMockData && (
        <div className="lb-notice">
          <span className="lb-dot" aria-hidden="true" />
          Showing sample data: the live connection didn't load. Try reopening the app.
        </div>
      )}

      {/* The world leads: every country you've stayed in, scratched off. */}
      <div className="lb-map scratchmap">
        <Suspense fallback={<div style={{ height: 200, background: 'var(--map-bg)' }} />}>
          <WorldMap
            hotels={loggedStays} flights={completedFlights} reviews={reviews} focusCountries={null} scratch visited={visited}
            caption={<>
              <span className="scratch-count">{countryCount}</span>
              <span className="scratch-cap">{countryCount === 1 ? 'country' : 'countries'} scratched off · {shareOfWorld(countryCount)}% of the world</span>
            </>}
          />
        </Suspense>
      </div>

      <div className="nf-eyebrow lb-label">Rated stays</div>
      <div className="catchip">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={cat === c.key ? 'won' : ''} onClick={() => { setCat(c.key); setShowAll(false); }}>
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '10px 20px 0', display: 'flex', gap: 6 }}>
        {([['score', 'Top rated'], ['recent', 'Most recent'], ['az', 'A–Z']] as [SortMode, string][]).map(([mode, label]) => (
          <button key={mode} className={sortMode === mode ? 'tagbtn on' : 'tagbtn'} aria-pressed={sortMode === mode} onClick={() => setSortMode(mode)}>
            {label}
          </button>
        ))}
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {sorted.length === 0 && (
            <div style={{ padding: '14px 4px', fontSize: 'var(--fs-small)', color: 'var(--ink3)' }}>No reviews yet in this category.</div>
          )}
          {visible.map((r, i) => {
            const rank = sortMode === 'score' ? i + 1 : null;
            const badge = rank ? rankBadge(rank) : null;
            const photo = aspectPhoto(photos, r.hotelName, cat);
            return (
              <div
                key={r.key}
                onClick={() => navigate(`/review/${encodeURIComponent(r.hotelName)}`)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 0, padding: '12px 16px', cursor: 'pointer',
                  borderRadius: 'var(--r-md)', background: 'var(--card)', border: '1px solid var(--line)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {rank && (
                    <div
                      style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                        fontSize: 'var(--fs-caption)', fontWeight: 600,
                        background: badge ? badge.bg : 'var(--card2)', color: badge ? badge.fg : 'var(--ink3)',
                      }}
                    >
                      {rank}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.hotelName}
                    </div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink2)', marginTop: 1 }}>
                      {r.country} · {r.latestDate}{r.reviewCount > 1 ? ` · average rating (${r.reviewCount} reviews)` : ''}
                    </div>
                  </div>
                  {photo && <img src={photo.url} alt="" loading="lazy" className="rowthumb" />}
                  <div
                    style={{
                      fontSize: 'var(--fs-body-lg)', fontWeight: 600, flexShrink: 0,
                      color: scoreColour(r.avgScore),
                    }}
                  >
                    {r.avgScore.toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sorted.length > SHOW_INITIALLY && (
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              marginTop: 10, width: '100%', padding: '11px 0', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
              background: 'var(--card)', color: 'var(--brand)', fontSize: 'var(--fs-body)', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {showAll ? 'Show top 10' : `Show all ${sorted.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
