import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { planningCountries, PLANNING_AIRPORTS_BY_IATA } from '../data/planningAirports';
import { planLeg, transferForAirport, STRONG_RAIL_COUNTRIES, type LegPlan } from '../lib/tripPlanner';
import { planHotelOptions } from '../lib/hotelPlanner';
import { useLoyaltyProgrammes, useAllHotels } from '../lib/useLiveData';
import { haversineKm } from '../lib/travelStats';

const PlanMap = lazy(() => import('../components/PlanMap').then((m) => ({ default: m.PlanMap })));

const HOME_AIRPORTS = ['LHR', 'LGW', 'STN', 'LTN', 'LCY'];

interface SuggestedCity {
  city: string;
  lat: number;
  lng: number;
  nights: number;
  why: string;
  nearestAirport: string | null;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10,
  color: 'var(--ink)', fontSize: 15, padding: '11px 12px', width: '100%', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--ink2)', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.05em', marginBottom: 5, display: 'block',
};

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export function Plan() {
  const navigate = useNavigate();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: allHotels } = useAllHotels();
  const [country, setCountry] = useState('Japan');
  const [nights, setNights] = useState('12');
  const [homeAirport, setHomeAirport] = useState('LHR');
  const [cities, setCities] = useState<SuggestedCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function suggest() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/suggest-cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, nights: nights ? parseInt(nights, 10) : 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not get suggestions');
      setCities(data.cities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const railLikely = STRONG_RAIL_COUNTRIES.has(country);
  const home = PLANNING_AIRPORTS_BY_IATA[homeAirport];

  // Domestic legs between consecutive suggested cities -- distances exact,
  // modes and durations estimated.
  const legs: LegPlan[] = [];
  for (let i = 0; i < cities.length - 1; i++) {
    legs.push(planLeg(cities[i], cities[i + 1], railLikely));
  }

  const outboundKm = home && cities.length > 0 ? haversineKm(home.lat, home.lng, cities[0].lat, cities[0].lng) : 0;
  const returnKm = home && cities.length > 0 ? haversineKm(cities[cities.length - 1].lat, cities[cities.length - 1].lng, home.lat, home.lng) : 0;
  const domesticKm = legs.reduce((s, l) => s + l.distanceKm, 0);
  const domesticCost = legs.reduce((s, l) => s + l.estimatedCostGBP, 0);
  const totalNights = cities.reduce((s, c) => s + c.nights, 0);
  const hotelOptions = totalNights > 0 ? planHotelOptions(loyaltyProgrammes, allHotels, totalNights) : [];
  const bestHotel = hotelOptions[0] ?? null;

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Plan a trip</div>
      </div>

      <div style={{ padding: '0 20px', display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
          <div>
            <label style={labelStyle}>Destination</label>
            <select style={inputStyle} value={country} onChange={(e) => { setCountry(e.target.value); setCities([]); }}>
              {planningCountries().map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Nights</label>
            <input type="number" style={inputStyle} value={nights} onChange={(e) => setNights(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Flying from</label>
          <select style={inputStyle} value={homeAirport} onChange={(e) => setHomeAirport(e.target.value)}>
            {HOME_AIRPORTS.map((code) => {
              const a = PLANNING_AIRPORTS_BY_IATA[code];
              return <option key={code} value={code}>{a ? `${a.city} ${a.name} (${code})` : code}</option>;
            })}
          </select>
        </div>

        <button
          onClick={suggest}
          disabled={loading}
          style={{
            padding: '13px 0', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
            background: loading ? 'var(--card2)' : 'var(--brand)', color: loading ? 'var(--ink2)' : '#fff',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Planning…' : cities.length > 0 ? 'Suggest again' : 'Plan this trip'}
        </button>

        {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
      </div>

      {cities.length > 0 && (
        <>
          <div style={{ padding: '16px 20px 0' }}>
            <Suspense fallback={<div style={{ height: 220, background: '#DCE7F5', borderRadius: 16 }} />}>
              <PlanMap home={home ?? null} cities={cities} />
            </Suspense>
          </div>

          <div className="sect"><h2>Route</h2></div>
          <div className="stack" style={{ display: 'grid', gap: 10 }}>
            {home && cities.length > 0 && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{home.city} → {cities[0].city}</div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 3 }}>
                  {Math.round(outboundKm).toLocaleString()} km · flight · est. {formatHours(outboundKm / 800 + 3)}
                </div>
              </div>
            )}

            {cities.map((c, i) => {
              const transfer = c.nearestAirport ? transferForAirport(c.nearestAirport) : null;
              const leg = legs[i];
              return (
                <div key={c.city}>
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{c.city}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>{c.nights}n</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4, lineHeight: 1.5 }}>{c.why}</div>
                    {transfer && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 6 }}>
                        {transfer.airport.name} ({transfer.airport.iata}) · {Math.round(transfer.distanceToCityKm)} km to centre · ~{transfer.estimatedTransferMinutes} min transfer
                      </div>
                    )}
                  </div>

                  {leg && (
                    <div style={{ padding: '8px 14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>
                        {leg.recommendedMode === 'flight' ? '✈️' : leg.recommendedMode === 'rail' ? '🚄' : '🚗'}
                      </span>
                      <div style={{ fontSize: 11.5, color: 'var(--ink2)' }}>
                        {Math.round(leg.distanceKm)} km · est. {formatHours(leg.estimatedHours)} · ~£{Math.round(leg.estimatedCostGBP)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hotelOptions.length > 0 && (
            <>
              <div className="sect"><h2>Where to stay</h2></div>
              <div className="stack" style={{ display: 'grid', gap: 10 }}>
                {hotelOptions.map((o, i) => (
                  <div
                    key={o.programme}
                    style={{
                      padding: '12px 14px', borderRadius: 12, background: 'var(--card)',
                      border: i === 0 ? '2px solid var(--brand)' : '1px solid var(--line)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                        {o.programme}
                        {i === 0 && <span style={{ color: 'var(--brand)', fontSize: 11, marginLeft: 6 }}>BEST VALUE</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>~£{Math.round(o.estimatedNightlyGBP)}/night</div>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 3 }}>
                      {o.tier ? `${o.tier} · ` : ''}
                      {o.rateSource === 'history'
                        ? `rate from your ${o.historyCount} past stay${o.historyCount === 1 ? '' : 's'}`
                        : 'no stay history — generic estimate'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 6 }}>
                      Earns ~{Math.round(o.pointsEarned).toLocaleString()} pts (~£{Math.round(o.pointsValueGBP)})
                      · effective ~£{Math.round(o.effectiveNightlyGBP)}/night
                    </div>
                    {o.benefits.length > 0 && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 6, lineHeight: 1.6 }}>
                        {o.benefits.map((b) => `• ${b}`).join('  ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="sect"><h2>Estimated totals</h2></div>
          <div className="stack">
            <div className="card" style={{ display: 'grid', gap: 9 }}>
              <Row label="Nights planned" value={`${totalNights}`} />
              <Row label="International distance" value={`${Math.round(outboundKm + returnKm).toLocaleString()} km`} />
              <Row label="Domestic distance" value={`${Math.round(domesticKm).toLocaleString()} km`} />
              <Row label="Domestic transport" value={`~£${Math.round(domesticCost).toLocaleString()}`} />
              {bestHotel && (
                <Row
                  label={`Accommodation (${bestHotel.programme})`}
                  value={`~£${Math.round(bestHotel.estimatedNightlyGBP * totalNights).toLocaleString()}`}
                />
              )}
              {bestHotel && (
                <Row
                  label="Points earned on stays"
                  value={`~${Math.round(bestHotel.pointsEarned).toLocaleString()} pts`}
                />
              )}
              <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5, marginTop: 4 }}>
                Distances are exact great-circle calculations. Durations and costs are rough estimates
                for planning only — not live fares, and real journey times vary by route and service.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'var(--ink2)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
