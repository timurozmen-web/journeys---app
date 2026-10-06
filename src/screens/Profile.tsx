import { useState, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteHotel } from '../lib/queries';
import { useReviews, useAllHotels, useAllFlights, useTrips } from '../lib/useLiveData';
import { findHotelsNeedingReview, findHotelsMissingCategories, REVIEW_CATEGORIES } from '../lib/reviewScoring';
import { flightDistanceKm, estimateFlightHours } from '../lib/travelStats';
import { PlaneIcon, SettingsIcon, StarIcon } from '../components/Icons';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { destinationQuery } from '../lib/tripHotels';
import { formatShortRange } from '../lib/format';
import { pastTripsByYear } from '../lib/tripTimeline';
import { Segmented } from '../components/ui';
import { averageOverall, completedStays, nightsByCountry, nightsByYear, shareOfWorld, travellingSince, tripsTaken } from '../lib/logbook';
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

// Then: where you've been. A world map scratched off country by country,
// your past trips as a scrapbook, and the logbook and ratings below.
export function Profile() {
  const navigate = useNavigate();
  const [cat, setCat] = useState('overall');
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [year, setYear] = useState<'all' | number>('all');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const { data: reviews, isLive: reviewsLive } = useReviews();
  const { data: hotels, isLive: hotelsLive } = useAllHotels();
  const { data: flights, isLive: flightsLive } = useAllFlights();
  const { data: trips, isLive: tripsLive } = useTrips();
  const showingMockData = !reviewsLive || !hotelsLive || !flightsLive || !tripsLive;
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

  // The logbook: completed stays and trips already begun (see lib/logbook).
  // The map shades the same completed stays the count is made from, so
  // a booked-but-not-taken trip never colours a country the logbook
  // doesn't count.
  const loggedStays = useMemo(() => completedStays(filteredHotels), [filteredHotels]);
  const countryNights = useMemo(() => nightsByCountry(filteredHotels), [filteredHotels]);
  const yearNights = useMemo(() => nightsByYear(hotels), [hotels]);
  const countryCount = countryNights.length;
  const totalNights = countryNights.reduce((s, c) => s + c.nights, 0);
  const totalStays = countryNights.reduce((s, c) => s + c.stays, 0);
  const tripCount = tripsTaken(year === 'all' ? trips : trips.filter((t) => yearOf(t.start) === year), today).length;
  const rating = averageOverall(filteredReviews);
  const since = travellingSince(hotels);
  const scrapbook = useMemo(() => pastTripsByYear(trips, today), [trips, today]);
  const completedFlights = useMemo(() => filteredFlights.filter((f) => f.status === 'Completed'), [filteredFlights]);

  const { totalDistanceKm, totalHours } = useMemo(() => {
    let km = 0, hrs = 0;
    for (const f of completedFlights) {
      km += flightDistanceKm(f);
      hrs += estimateFlightHours(f);
    }
    return { totalDistanceKm: km, totalHours: hrs };
  }, [completedFlights]);

  const topCountries = countryNights.slice(0, 6);
  const maxCountryNights = Math.max(1, ...topCountries.map((c) => c.nights));
  const maxYearNights = Math.max(1, ...yearNights.map((y) => y.nights));
  const focusCountries = countryFilter ? [countryFilter] : null;

  const categoryReviews = filteredReviews
    .filter((r) => r.category === cat)
    .filter((r) => !countryFilter || r.country.trim() === countryFilter);

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
      <div style={{ padding: '20px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="h1" style={{ margin: 0 }}>Then</h1>
          {since && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink2)', marginTop: 2 }}>Since {since}</div>}
        </div>
        <button className="lb-iconbtn" onClick={() => navigate('/settings')} aria-label="Settings">
          <SettingsIcon size={20} color="currentColor" />
        </button>
      </div>

      {showingMockData && (
        <div className="lb-notice">
          <span className="lb-dot" aria-hidden="true" />
          Showing sample data: the live connection didn't load. Try reopening the app.
        </div>
      )}

      {/* The world leads: every country you've stayed in, scratched off. */}
      <div className="lb-map scratchmap">
        <div className="lb-map-count">
          <span className="scratch-count">{countryCount}</span>
          <span className="scratch-cap">
            {countryCount === 1 ? 'country' : 'countries'} scratched off · {shareOfWorld(countryCount)}% of the world
          </span>
        </div>
        <Suspense fallback={<div style={{ height: 200, background: 'var(--map-bg)' }} />}>
          <WorldMap hotels={loggedStays} flights={completedFlights} reviews={filteredReviews} focusCountries={focusCountries} scratch />
        </Suspense>
      </div>

      {scrapbook.length > 0 && (
        <div className="scrapbook">
          {scrapbook.map((g) => (
            <section key={g.year}>
              <div className="scrap-year">{g.year}</div>
              <div className="scrap-grid">
                {g.trips.map((t, i) => (
                  <button key={t.id} className="polaroid" style={{ rotate: `${[-1.6, 1.2, -0.6, 1.8][i % 4]}deg` }} onClick={() => navigate(`/trips/${t.id}`)}>
                    <span className="polaroid-photo">
                      {t.heroImageUrl
                        ? <img src={t.heroImageUrl} alt="" />
                        : <DestinationPhoto query={destinationQuery(t)} seed={t.id} height={118} />}
                    </span>
                    <span className="polaroid-title">{t.title}</span>
                    <span className="polaroid-date">{formatShortRange(t.start, t.end, today)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {years.length > 1 && (
        <div style={{ padding: '14px 16px 0' }}>
          <Segmented<string>
            variant="pills" tone="brand"
            options={[{ value: 'all', label: 'All time' }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
            value={year === 'all' ? 'all' : String(year)}
            onChange={(v) => setYear(v === 'all' ? 'all' : Number(v))}
          />
        </div>
      )}

      <div className="nf-eyebrow lb-label">{year === 'all' ? 'The logbook' : `The logbook · ${year}`}</div>
      <div className="lb-grid">
        <div className="glass lb-tile"><span className="lb-num">{totalNights}</span><span className="lb-cap">nights away</span></div>
        <div className="glass lb-tile"><span className="lb-num">{totalStays}</span><span className="lb-cap">hotel stays</span></div>
        <div className="glass lb-tile"><span className="lb-num">{tripCount}</span><span className="lb-cap">trip{tripCount === 1 ? '' : 's'}</span></div>
        <div className="glass lb-tile">
          <span className="lb-num" style={{ color: 'var(--brand)' }}>{rating.avg != null ? rating.avg.toFixed(1) : '—'}</span>
          <span className="lb-cap">{rating.count > 0 ? `avg of ${rating.count} rating${rating.count === 1 ? '' : 's'}` : 'no ratings yet'}</span>
        </div>
      </div>
      {completedFlights.length > 0 && (
        <div className="glass lb-air">
          <PlaneIcon size={18} color="var(--brand)" />
          <span><strong>{completedFlights.length}</strong> flight{completedFlights.length === 1 ? '' : 's'}</span>
          <span><strong>{Math.round(totalDistanceKm).toLocaleString()}</strong> km</span>
          <span><strong>{Math.round(totalHours)}</strong>h in the air</span>
        </div>
      )}

      {topCountries.length > 0 && (
        <>
          <div className="lb-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="nf-eyebrow">Where the nights went</span>
            {countryFilter && (
              <button onClick={() => setCountryFilter(null)} className="btn ghost" style={{ padding: 0, fontSize: 'var(--fs-small)' }}>Clear</button>
            )}
          </div>
          <div className="lb-bars">
            {topCountries.map((c) => {
              const active = countryFilter === c.country;
              return (
                <button key={c.country} className={`lb-bar${active ? ' on' : ''}`} onClick={() => setCountryFilter(active ? null : c.country)} aria-pressed={active}>
                  <span className="lb-bar-name">{c.country}</span>
                  <span className="lb-bar-track"><i style={{ width: `${(c.nights / maxCountryNights) * 100}%` }} /></span>
                  <span className="lb-bar-val">{c.nights}</span>
                </button>
              );
            })}
          </div>
          {countryFilter && (
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink3)', padding: '8px 24px 0' }}>
              Map and ratings below show {countryFilter} only.
            </div>
          )}
        </>
      )}

      {year === 'all' && yearNights.length > 1 && (
        <>
          <div className="nf-eyebrow lb-label">By year</div>
          <div className="lb-years">
            {yearNights.map((y, i) => {
              const latest = i === yearNights.length - 1;
              return (
                <div key={y.year} className="lb-year">
                  <span className="lb-year-cap" style={{ color: latest ? 'var(--brand)' : 'var(--ink2)' }}>
                    {y.nights} night{y.nights === 1 ? '' : 's'}{y.countries > 1 ? ` · ${y.countries} countries` : ''}
                  </span>
                  <span className={`lb-year-bar${latest ? ' latest' : ''}`} style={{ height: Math.max(4, (y.nights / maxYearNights) * 100) }} />
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: latest ? 600 : 400 }}>{y.year}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(needsReview.length > 0 || missingCategories.length > 0) && (
        <>
          <div className="nf-eyebrow lb-label">To rate</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '0 16px', scrollbarWidth: 'none' }}>
            {needsReview.map((h) => (
              <div key={h.hotelId} className="glass lb-todo" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <button type="button" className="lb-todo-main" onClick={() => navigate('/review-trip', { state: { hotel: h } })}>
                  <StarIcon size={18} color="var(--brand)" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--fs-body-lg)', fontWeight: 500 }}>Rate {h.hotelName}</span>
                    <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--ink2)', marginTop: 2 }}>{h.tripTitle} · {h.date}</span>
                  </span>
                  <span style={{ color: 'var(--brand)', fontSize: 'var(--fs-small)' }}>Rate ›</span>
                </button>
                {/* A stay that was cancelled shouldn't be waiting to be rated: remove it (two taps). */}
                <button
                  type="button" className="lb-todo-cancel"
                  onClick={async () => {
                    if (cancelling !== h.hotelId) { setCancelling(h.hotelId); return; }
                    try { await deleteHotel(h.hotelId); } finally { setCancelling(null); }
                  }}
                >
                  {cancelling === h.hotelId ? 'Remove this stay' : "Didn't stay"}
                </button>
              </div>
            ))}
            {missingCategories.map((m) => (
              <button
                key={m.hotelName} className="glass lb-todo"
                onClick={() => navigate('/review-trip', {
                  state: {
                    hotel: { tripId: '', tripTitle: '', hotelId: m.hotelId, hotelName: m.hotelName, country: m.country, date: m.date },
                    onlyCategories: m.missing,
                  },
                })}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--fs-body-lg)', fontWeight: 500 }}>{m.hotelName}</span>
                  <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--ink2)', marginTop: 2 }}>Missing: {m.missing.map(categoryLabel).join(', ')}</span>
                </span>
                <span style={{ color: 'var(--brand)', fontSize: 'var(--fs-small)' }}>Complete ›</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="nf-eyebrow lb-label">Rated stays{countryFilter ? ` · ${countryFilter}` : ''}</div>
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
              padding: '6px 14px', borderRadius: 'var(--r-pill)', fontSize: 'var(--fs-caption)', fontWeight: 700, cursor: 'pointer',
              border: sortMode === mode ? 'none' : '1px solid var(--line)',
              background: sortMode === mode ? 'var(--brand)' : 'var(--card)',
              color: sortMode === mode ? 'var(--on-brand)' : 'var(--ink2)',
            }}
          >
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
                  <div
                    style={{
                      fontSize: 'var(--fs-body-lg)', fontWeight: 600, flexShrink: 0,
                      color: r.avgScore >= 6.7 ? 'var(--green)' : r.avgScore >= 3.4 ? 'var(--amber)' : 'var(--red)',
                    }}
                  >
                    {r.avgScore.toFixed(1)}
                  </div>
                </div>
                {expandedHotel === r.key && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', display: 'grid', gap: 6 }}>
                    {r.entries.length > 1 && (
                      <div style={{ fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Average rating, from {r.entries.length} visits
                      </div>
                    )}
                    {[...r.entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-small)' }}>
                        <span style={{ color: 'var(--ink2)' }}>{e.date}</span>
                        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{e.score.toFixed(1)}</span>
                      </div>
                    ))}
                    {mostRecentStay && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); navigate('/review-trip', { state: { hotel: { tripId: '', tripTitle: '', hotelId: mostRecentStay.id, hotelName: mostRecentStay.name, country: mostRecentStay.country, date: mostRecentStay.date } } } ); }}
                        style={{ marginTop: 2, background: 'none', border: 'none', color: 'var(--brand)', fontSize: 'var(--fs-caption)', fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left' }}
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
