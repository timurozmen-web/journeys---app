import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviews, useAllHotels, useAllFlights, useTrips } from '../lib/useLiveData';
import { findHotelsNeedingReview } from '../lib/reviewScoring';
const WorldMap = lazy(() => import('../components/WorldMap').then((m) => ({ default: m.WorldMap })));

const REGIONS = [
  { n: 'Oceania & SE Asia', nights: 21, c: '#5B3FA6' },
  { n: 'Europe & Middle East', nights: 10, c: '#8560D6' },
  { n: 'Americas', nights: 12, c: '#6B7FA8' },
  { n: 'South Asia', nights: 8, c: '#8797BC' },
];
const maxR = Math.max(...REGIONS.map((r) => r.nights));

const CATEGORIES = [
  { key: 'overall', label: 'Overall' },
  { key: 'service', label: 'Service' },
  { key: 'value', label: 'Value' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'food', label: 'Food' },
];

export function Profile() {
  const navigate = useNavigate();
  const [cat, setCat] = useState('overall');
  const { data: reviews } = useReviews();
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const { data: trips } = useTrips();
  const today = new Date().toISOString().slice(0, 10);
  const needsReview = findHotelsNeedingReview(trips, reviews, today);
  const visitedCountries = new Set(hotels.map((h) => h.country.trim()).filter(Boolean));
  const filtered = reviews.filter((r) => r.category === cat).sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(140deg,#5B3FA6,#8560D6)',
            display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800, color: '#fff',
          }}
        >
          T
        </div>
        <div>
          <div className="h1" style={{ fontSize: 21 }}>
            Timur
          </div>
          <div className="h-sub">32 countries · 97 nights · since 2015</div>
        </div>
      </div>

      {needsReview.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
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
                  padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(19,34,71,.15)',
                  background: 'rgba(19,34,71,.04)', textAlign: 'left', cursor: 'pointer', width: '100%',
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

      <div className="stack">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 4px' }}>
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Countries visited</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{visitedCountries.size}</div>
          </div>
          <Suspense fallback={<div style={{ height: 200, background: '#DCE7F5' }} />}>
            <WorldMap hotels={hotels} flights={flights} />
          </Suspense>
        </div>
      </div>

      <div className="sect">
        <h2>Time by region</h2>
      </div>
      <div className="stack">
        <div className="card">
          {REGIONS.map((r) => (
            <div key={r.n} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700 }}>
                <span>{r.n}</span>
                <span style={{ color: 'var(--ink3)' }}>{r.nights}n</span>
              </div>
              <div className="hbar" style={{ background: 'var(--card2)' }}>
                <i style={{ width: `${(r.nights / maxR) * 100}%`, background: r.c }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sect">
        <h2>Reviews</h2>
      </div>
      <div className="catchip">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={cat === c.key ? 'won' : ''} onClick={() => setCat(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="stack">
        <div className="rowlist">
          {filtered.length === 0 && (
            <div style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--ink3)' }}>No reviews yet in this category.</div>
          )}
          {filtered.map((r) => (
            <button className="row" key={r.hotelId}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="t" style={{ display: 'block' }}>
                  {r.hotelName}
                </span>
                <span className="s" style={{ display: 'block' }}>
                  {r.country} · {r.date}
                </span>
              </span>
              <span className="v" style={{ color: r.score >= 6.7 ? 'var(--green)' : r.score >= 3.4 ? 'var(--amber)' : 'var(--red)' }}>
                {r.score.toFixed(1)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
