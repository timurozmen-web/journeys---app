import { useState } from 'react';
import { useReviews } from '../lib/useLiveData';

const REGIONS = [
  { n: 'Oceania & SE Asia', nights: 21, c: '#132247' },
  { n: 'Europe & Middle East', nights: 10, c: '#3A4C82' },
  { n: 'Americas', nights: 12, c: '#6B7FA8' },
  { n: 'South Asia', nights: 8, c: '#8797BC' },
];
const maxR = Math.max(...REGIONS.map((r) => r.nights));

export function Profile() {
  const [routesOn, setRoutesOn] = useState(false);
  const { data: reviews } = useReviews();

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(140deg,#132247,#3A4C82)',
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

      <div className="stack">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 12px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>Countries visited</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>32</div>
            </div>
            <button
              onClick={() => setRoutesOn((v) => !v)}
              style={{
                padding: '6px 12px', borderRadius: 99, border: '1px solid var(--line)',
                background: routesOn ? 'var(--brand)' : 'var(--card2)', color: routesOn ? '#fff' : 'var(--ink2)',
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer', height: 'fit-content',
              }}
            >
              Routes
            </button>
          </div>
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
        <h2>Ranked stays</h2>
        <a href="/#/trips">See all</a>
      </div>
      <div className="stack">
        <div className="rowlist">
          {reviews.slice(0, 4).map((r) => (
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
