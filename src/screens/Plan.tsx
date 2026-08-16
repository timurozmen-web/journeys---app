import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import { planningCountries, PLANNING_AIRPORTS_BY_IATA } from '../data/planningAirports';
import { allPlanningCountries } from '../data/globalAirportsLoader';
import { planLeg, STRONG_RAIL_COUNTRIES, type LegPlan } from '../lib/tripPlanner';
import { nearestAirportToCity, type NearestAirportResult } from '../data/worldCitiesLoader';
import { planHotelOptions } from '../lib/hotelPlanner';
import { useLoyaltyProgrammes, useAllHotels } from '../lib/useLiveData';
import { haversineKm } from '../lib/travelStats';
import { addTrip, addHotel, addFlight } from '../lib/queries';
import { CitySearchInput } from '../components/CitySearchInput';
import type { WorldCity } from '../data/worldCitiesLoader';

const PlanMap = lazy(() => import('../components/PlanMap').then((m) => ({ default: m.PlanMap })));

const HOME_AIRPORTS = ['LHR', 'LGW', 'STN', 'LTN', 'LCY'];

interface SuggestedCity {
  city: string;
  country: string;
  lat: number;
  lng: number;
  nights: number;
  why: string;
  nearestAirport: string | null;
}

interface Destination {
  id: string;
  country: string;
  nights: string;
  cities: WorldCity[];
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
  const [destinations, setDestinations] = useState<Destination[]>([{ id: 'd0', country: 'Japan', nights: '12', cities: [] }]);
  const [homeAirport, setHomeAirport] = useState('LHR');
  const [cities, setCities] = useState<SuggestedCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [allCountries, setAllCountries] = useState<string[]>(planningCountries());
  const [cityAirports, setCityAirports] = useState<Record<string, NearestAirportResult>>({});

  // Once cities are suggested, verify the real nearest airport for each --
  // more reliable than trusting Claude's own airport guess, and works for
  // any city regardless of whether it's in the originally curated set.
  useEffect(() => {
    if (cities.length === 0) return;
    let cancelled = false;
    Promise.all(cities.map(async (c) => [c.city, await nearestAirportToCity(c.lat, c.lng)] as const)).then((results) => {
      if (cancelled) return;
      const entries: [string, NearestAirportResult][] = results.filter(
        (r): r is [string, NearestAirportResult] => r[1] != null
      );
      setCityAirports(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [cities]);

  useEffect(() => {
    allPlanningCountries().then(setAllCountries).catch(() => {
      // Global dataset failed to load -- keep the curated fallback list rather than break the form.
    });
  }, []);

  function addDestination() {
    setDestinations((d) => [...d, { id: `d${Date.now()}`, country: allCountries[0] ?? 'Japan', nights: '5', cities: [] }]);
  }
  function removeDestination(id: string) {
    setDestinations((d) => d.filter((x) => x.id !== id));
  }
  function updateDestination(id: string, patch: Partial<Destination>) {
    setDestinations((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function suggest() {
    setLoading(true);
    setError('');
    try {
      // Each country's cities are suggested independently, then joined in
      // the order the user added them -- keeps each request focused and
      // means one slow/failed country doesn't block the others we already got.
      // Destinations where the user picked their own cities skip Claude
      // entirely -- their explicit choice takes priority over a suggestion.
      const results: SuggestedCity[] = [];
      for (const dest of destinations) {
        const totalNights = dest.nights ? parseInt(dest.nights, 10) : 10;

        if (dest.cities.length > 0) {
          const perCity = Math.max(1, Math.round(totalNights / dest.cities.length));
          for (const c of dest.cities) {
            results.push({
              city: c.name, country: dest.country, lat: c.lat, lng: c.lng,
              nights: perCity, why: 'Selected by you', nearestAirport: null,
            });
          }
          continue;
        }

        const res = await fetch('/.netlify/functions/suggest-cities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: dest.country, nights: totalNights }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`${dest.country}: ${data.error || 'Could not get suggestions'}`);
        for (const c of data.cities ?? []) {
          results.push({ ...c, country: dest.country });
        }
      }
      setCities(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const home = PLANNING_AIRPORTS_BY_IATA[homeAirport];

  // Domestic legs between consecutive suggested cities. Rail is only
  // considered when both ends of a leg are in the same strong-rail
  // country -- crossing a border defaults to flight, which is realistic
  // for the vast majority of country pairs.
  const legs: LegPlan[] = [];
  for (let i = 0; i < cities.length - 1; i++) {
    const sameCountry = cities[i].country === cities[i + 1].country;
    const railLikely = sameCountry && STRONG_RAIL_COUNTRIES.has(cities[i].country);
    legs.push(planLeg(cities[i], cities[i + 1], railLikely));
  }

  const outboundKm = home && cities.length > 0 ? haversineKm(home.lat, home.lng, cities[0].lat, cities[0].lng) : 0;
  const returnKm = home && cities.length > 0 ? haversineKm(cities[cities.length - 1].lat, cities[cities.length - 1].lng, home.lat, home.lng) : 0;
  const domesticKm = legs.reduce((s, l) => s + l.distanceKm, 0);
  const domesticCost = legs.reduce((s, l) => s + l.estimatedCostGBP, 0);
  const totalNights = cities.reduce((s, c) => s + c.nights, 0);
  const hotelOptions = totalNights > 0 ? planHotelOptions(loyaltyProgrammes, allHotels, totalNights) : [];
  const bestHotel = hotelOptions[0] ?? null;

  async function saveToTrips() {
    if (!startDate || cities.length === 0) return;
    setSaving(true);
    setSaveError('');
    try {
      const countries = [...new Set(cities.map((c) => c.country))];
      const title = countries.join(' & ');

      // Real calendar dates for each city, computed from cumulative nights
      // starting at the given date -- this is what turns "4 nights in
      // Tokyo" into an actual bookable check-in/check-out.
      let cursor = new Date(startDate + 'T00:00:00');
      const cityDates = cities.map((c) => {
        const checkIn = cursor.toISOString().slice(0, 10);
        cursor = new Date(cursor.getTime() + c.nights * 86400000);
        return { city: c, checkIn };
      });
      const endDate = cursor.toISOString().slice(0, 10);

      const tripId = await addTrip({ title, start: startDate, end: endDate, tripType: 'leisure', notes: 'Created from Plan' });

      for (const { city, checkIn } of cityDates) {
        await addHotel({
          name: bestHotel ? `${bestHotel.programme} property` : `Hotel in ${city.city}`,
          country: city.country, city: city.city, brand: bestHotel?.programme ?? 'Independent',
          nights: city.nights, date: checkIn, status: 'needs-confirm',
          total: bestHotel ? Math.round(bestHotel.estimatedNightlyGBP * city.nights) : null,
          card: null, category: 'Premium', tripId,
          benefitValue: null, benefitNote: null, bookingChannel: null, roomType: null, rateType: null,
          nightlyRate: bestHotel ? Math.round(bestHotel.estimatedNightlyGBP) : null, avgRate: null,
        });
      }

      // Outbound and return flights, plus any inter-city leg recommended
      // as air travel -- ground legs (rail/road) aren't logged as flights.
      // Verified airport codes are preferred over Claude's own guess.
      const airportFor = (c: SuggestedCity) => cityAirports[c.city]?.airport.iata ?? c.nearestAirport;

      if (home && airportFor(cities[0])) {
        await addFlight({
          date: startDate, from: homeAirport, to: airportFor(cities[0])!,
          airline: 'TBC', flightNo: null, cabin: 'Economy', status: 'needs-confirm',
          cost: Math.round(Math.max(60, outboundKm * 0.11)),
          award: false, overnight: false, tripId,
        });
      }
      for (let i = 0; i < legs.length; i++) {
        if (legs[i].recommendedMode !== 'flight') continue;
        const fromAirport = airportFor(cities[i]);
        const toAirport = airportFor(cities[i + 1]);
        if (!fromAirport || !toAirport) continue; // no reliable airport code -- skip rather than insert bad data
        await addFlight({
          date: cityDates[i + 1].checkIn, from: fromAirport, to: toAirport,
          airline: 'TBC', flightNo: null, cabin: 'Economy', status: 'needs-confirm',
          cost: Math.round(legs[i].estimatedCostGBP), award: false, overnight: false, tripId,
        });
      }
      if (home && airportFor(cities[cities.length - 1])) {
        await addFlight({
          date: endDate, from: airportFor(cities[cities.length - 1])!, to: homeAirport,
          airline: 'TBC', flightNo: null, cabin: 'Economy', status: 'needs-confirm',
          cost: Math.round(Math.max(60, returnKm * 0.11)), award: false, overnight: false, tripId,
        });
      }

      navigate(`/trips/${tripId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save this plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BackIcon size={20} color="var(--ink)" />
        </button>
        <div className="h1" style={{ fontSize: 21 }}>Plan a trip</div>
      </div>

      <div style={{ padding: '0 20px', display: 'grid', gap: 10 }}>
        {destinations.map((dest, i) => (
          <div key={dest.id}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 30px', gap: 8, alignItems: 'end' }}>
              <div>
                {i === 0 && <label style={labelStyle}>Destination</label>}
                <select
                  style={inputStyle}
                  value={dest.country}
                  onChange={(e) => { updateDestination(dest.id, { country: e.target.value, cities: [] }); setCities([]); }}
                >
                  {allCountries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                {i === 0 && <label style={labelStyle}>Nights</label>}
                <input
                  type="number" style={inputStyle} value={dest.nights}
                  onChange={(e) => updateDestination(dest.id, { nights: e.target.value })}
                />
              </div>
              {destinations.length > 1 ? (
                <button
                  onClick={() => { removeDestination(dest.id); setCities([]); }}
                  style={{ height: 42, background: 'var(--card2)', border: 'none', borderRadius: 8, color: 'var(--ink3)', fontSize: 15, cursor: 'pointer' }}
                >
                  ✕
                </button>
              ) : <div />}
            </div>
            <div style={{ marginTop: 8 }}>
              <CitySearchInput
                country={dest.country}
                selected={dest.cities}
                onChange={(cities) => { updateDestination(dest.id, { cities }); setCities([]); }}
              />
            </div>
          </div>
        ))}

        <button
          onClick={addDestination}
          style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}
        >
          + Add another country
        </button>

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
              const transfer = cityAirports[c.city];
              const leg = legs[i];
              const showCountry = i === 0 || cities[i - 1].country !== c.country;
              return (
                <div key={`${c.city}-${i}`}>
                  {showCountry && (
                    <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', margin: '10px 0 6px' }}>
                      {c.country}
                    </div>
                  )}
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{c.city}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>{c.nights}n</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4, lineHeight: 1.5 }}>{c.why}</div>
                    {transfer && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 6 }}>
                        {transfer.airport.name || transfer.airport.city} ({transfer.airport.iata}) · {Math.round(transfer.distanceKm)} km to centre · ~{Math.round((transfer.distanceKm / 45) * 60 + 10)} min transfer
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

          <div className="stack" style={{ marginTop: 4 }}>
            <div className="card">
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Save this plan as a trip</div>
              <input
                type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <button
                onClick={saveToTrips}
                disabled={!startDate || saving}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700,
                  background: !startDate || saving ? 'var(--card2)' : 'var(--brand)', color: !startDate || saving ? 'var(--ink2)' : '#fff',
                  cursor: !startDate || saving ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save to Trips'}
              </button>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 8, lineHeight: 1.5 }}>
                Creates a real trip with a stay for each city and flights for the international legs,
                all marked as "needs confirming" until you actually book them.
              </div>
              {saveError && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{saveError}</div>}
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
