import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon, PlaneIcon, TrainIcon, CarIcon, GripIcon, ExternalLinkIcon } from '../components/Icons';
import { googleFlightsSearchUrl, googleHotelsSearchUrl, brandHotelSearchUrl, type StopsFilter, type CabinFilter, type AllianceFilter } from '../lib/externalSearchLinks';
import { planningCountries, PLANNING_AIRPORTS_BY_IATA } from '../data/planningAirports';
import { allPlanningCountries } from '../data/globalAirportsLoader';
import { planLeg, STRONG_RAIL_COUNTRIES, estimateTravelHours, estimateOverheadHours, type LegPlan } from '../lib/tripPlanner';
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

interface SeasonalGuidance {
  months: { month: string; priceLevel: 'low' | 'medium' | 'high'; note: string }[];
  summary: string;
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
  const [seasonalGuidance, setSeasonalGuidance] = useState<Record<string, SeasonalGuidance>>({});
  const [loadingSeasonal, setLoadingSeasonal] = useState(false);
  const [stopsFilter, setStopsFilter] = useState<StopsFilter>('any');
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>('any');
  const [allianceFilter, setAllianceFilter] = useState<AllianceFilter>('any');
  const [hotelBrandFilter, setHotelBrandFilter] = useState<string>('any');
  const [airlineFilter, setAirlineFilter] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleDragStart(index: number, e: React.PointerEvent) {
    setDraggedIndex(index);
    setDragOverIndex(index);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handleDragMove(e: React.PointerEvent) {
    if (draggedIndex === null) return;
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        if (i !== dragOverIndex) setDragOverIndex(i);
        break;
      }
    }
  }

  function handleDragEnd() {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      setCities((prev) => {
        const next = [...prev];
        const [moved] = next.splice(draggedIndex, 1);
        next.splice(dragOverIndex, 0, moved);
        return next;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

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

      // Seasonal guidance fetched independently per country -- a failure
      // here shouldn't block the trip planning that already succeeded.
      setLoadingSeasonal(true);
      Promise.all(
        destinations.map(async (dest) => {
          try {
            const res = await fetch('/.netlify/functions/seasonal-guidance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ country: dest.country }),
            });
            const data = await res.json();
            return res.ok ? ([dest.country, data] as const) : null;
          } catch {
            return null;
          }
        })
      ).then((results) => {
        const entries = results.filter((r): r is [string, SeasonalGuidance] => r !== null);
        setSeasonalGuidance(Object.fromEntries(entries));
        setLoadingSeasonal(false);
      });
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
  const uniqueCountries = [...new Set(cities.map((c) => c.country))];
  const flightFilters = { stops: stopsFilter, cabin: cabinFilter, alliance: allianceFilter, airline: airlineFilter || undefined };
  useEffect(() => {
    if (mapFocus && !uniqueCountries.includes(mapFocus)) setMapFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);
  const mapCities = mapFocus ? cities.filter((c) => c.country === mapFocus) : cities;
  const mapLegs: LegPlan[] = mapFocus
    ? (() => {
        const out: LegPlan[] = [];
        for (let i = 0; i < mapCities.length - 1; i++) {
          out.push(planLeg(mapCities[i], mapCities[i + 1], STRONG_RAIL_COUNTRIES.has(mapFocus)));
        }
        return out;
      })()
    : legs;
  const mapHome = mapFocus ? null : (home ?? null); // the international leg isn't part of a single country's domestic view
  const hotelOptions = totalNights > 0 ? planHotelOptions(loyaltyProgrammes, allHotels, totalNights) : [];
  const bestHotel = hotelOptions[0] ?? null;

  // Real calendar dates for each city, computed from cumulative nights
  // starting at the given date -- this is what turns "4 nights in Tokyo"
  // into an actual bookable check-in/check-out. Shared by both the flight
  // search links and the save-to-trips flow, rather than computed twice.
  const cityDates = (() => {
    if (!startDate) return cities.map((c) => ({ city: c, checkIn: null as string | null }));
    let cursor = new Date(startDate + 'T00:00:00');
    return cities.map((c) => {
      const checkIn = cursor.toISOString().slice(0, 10);
      cursor = new Date(cursor.getTime() + c.nights * 86400000);
      return { city: c, checkIn };
    });
  })();
  const tripEndDate = (() => {
    if (!startDate) return null;
    let cursor = new Date(startDate + 'T00:00:00');
    for (const c of cities) cursor = new Date(cursor.getTime() + c.nights * 86400000);
    return cursor.toISOString().slice(0, 10);
  })();

  async function saveToTrips() {
    if (!startDate || cities.length === 0) return;
    setSaving(true);
    setSaveError('');
    try {
      const countries = [...new Set(cities.map((c) => c.country))];
      const title = countries.join(' & ');
      const endDate = tripEndDate!;

      const tripId = await addTrip({ title, start: startDate, end: endDate, tripType: 'leisure', notes: 'Created from Plan' });

      for (const { city, checkIn } of cityDates) {
        await addHotel({
          name: bestHotel ? `${bestHotel.programme} property` : `Hotel in ${city.city}`,
          country: city.country, city: city.city, brand: bestHotel?.programme ?? 'Independent',
          nights: city.nights, date: checkIn!, status: 'needs-confirm',
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
          date: cityDates[i + 1].checkIn!, from: fromAirport, to: toAirport,
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

        <div>
          <label style={labelStyle}>Departure date</label>
          <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          {startDate && tripEndDate && (
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 4 }}>
              Returns {tripEndDate} · every stop's dates below are worked out from this
            </div>
          )}
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
            {cities.length > 1 && (
              <div className="catchip" style={{ margin: '0 0 10px' }}>
                <button className={mapFocus === null ? 'won' : ''} onClick={() => setMapFocus(null)}>
                  All
                </button>
                {uniqueCountries.map((c) => (
                  <button key={c} className={mapFocus === c ? 'won' : ''} onClick={() => setMapFocus(c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <Suspense fallback={<div style={{ height: 220, background: '#DCE7F5', borderRadius: 16 }} />}>
              <PlanMap
                home={mapHome}
                cities={mapCities}
                domesticLegs={mapLegs.map((l) => ({ mode: l.recommendedMode, distanceKm: l.distanceKm, hours: l.estimatedTravelHours }))}
                internationalLeg={
                  !mapFocus && home && cities.length > 0
                    ? { mode: 'flight', distanceKm: outboundKm, hours: estimateTravelHours(outboundKm, 'flight') }
                    : null
                }
              />
            </Suspense>
          </div>

          <div className="sect"><h2>Route</h2></div>
          {cities.length > 1 && (
            <div style={{ padding: '0 20px 8px', fontSize: 11.5, color: 'var(--ink3)' }}>
              Drag the grip to reorder stops
            </div>
          )}

          <div style={{ padding: '0 20px 12px', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['any', 'nonstop', 'one-stop'] as StopsFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStopsFilter(s)}
                  style={{
                    padding: '5px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    border: stopsFilter === s ? '1px solid var(--brand)' : '1px solid var(--line)',
                    background: stopsFilter === s ? 'rgba(91,63,166,.08)' : 'var(--card)',
                    color: stopsFilter === s ? 'var(--brand)' : 'var(--ink2)',
                  }}
                >
                  {s === 'any' ? 'Any stops' : s === 'nonstop' ? 'Nonstop' : '1 stop or fewer'}
                </button>
              ))}
            </div>
            <input
              value={airlineFilter}
              onChange={(e) => setAirlineFilter(e.target.value)}
              placeholder="Preferred airline (optional)"
              style={{ ...inputStyle, fontSize: 12.5, padding: '8px 11px' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select
                value={cabinFilter}
                onChange={(e) => setCabinFilter(e.target.value as CabinFilter)}
                style={{ ...inputStyle, fontSize: 12.5, padding: '8px 9px' }}
              >
                <option value="any">Any cabin</option>
                <option value="economy">Economy</option>
                <option value="premium-economy">Premium economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
              <select
                value={allianceFilter}
                onChange={(e) => setAllianceFilter(e.target.value as AllianceFilter)}
                style={{ ...inputStyle, fontSize: 12.5, padding: '8px 9px' }}
              >
                <option value="any">Any alliance</option>
                <option value="star-alliance">Star Alliance</option>
                <option value="oneworld">Oneworld</option>
                <option value="skyteam">SkyTeam</option>
              </select>
            </div>
            {loyaltyProgrammes.filter((p) => p.category === 'hotel').length > 0 && (
              <select
                value={hotelBrandFilter}
                onChange={(e) => setHotelBrandFilter(e.target.value)}
                style={{ ...inputStyle, fontSize: 12.5, padding: '8px 9px' }}
              >
                <option value="any">Search hotels generally</option>
                {loyaltyProgrammes.filter((p) => p.category === 'hotel').map((p) => (
                  <option key={p.name} value={p.name}>Search on {p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="stack" style={{ display: 'grid', gap: 10 }}>
            {home && cities.length > 0 && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{home.city} → {cities[0].city}</div>
                  <a
                    href={googleFlightsSearchUrl(
                      home?.city ?? 'London', cities[0].city, startDate || null,
                      uniqueCountries.length === 1 ? tripEndDate : null,
                      flightFilters
                    )}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand)', fontSize: 11.5, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                  >
                    Search <ExternalLinkIcon size={12} color="var(--brand)" />
                  </a>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 3 }}>
                  {Math.round(outboundKm).toLocaleString()} km · flight · est. {formatHours(estimateTravelHours(outboundKm, 'flight'))} flying + ~{formatHours(estimateOverheadHours('flight'))} airports
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
                  <div
                    ref={(el) => { rowRefs.current[i] = el; }}
                    style={{
                      padding: '12px 14px', borderRadius: 12, background: 'var(--card)',
                      border: dragOverIndex === i && draggedIndex !== null && draggedIndex !== i ? '2px solid var(--brand)' : '1px solid var(--line)',
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      opacity: draggedIndex === i ? 0.4 : 1,
                      transition: 'opacity .15s, border-color .15s',
                    }}
                  >
                    <button
                      onPointerDown={(e) => handleDragStart(i, e)}
                      onPointerMove={handleDragMove}
                      onPointerUp={handleDragEnd}
                      onPointerCancel={handleDragEnd}
                      aria-label={`Reorder ${c.city}`}
                      style={{
                        background: 'none', border: 'none', padding: '4px 2px', cursor: 'grab',
                        touchAction: 'none', flexShrink: 0, marginTop: 2,
                      }}
                    >
                      <GripIcon size={18} color="var(--ink3)" />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
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
                      <a
                        href={
                          hotelBrandFilter !== 'any'
                            ? brandHotelSearchUrl(hotelBrandFilter, c.city, c.country)
                            : googleHotelsSearchUrl(c.city, c.country, cityDates[i]?.checkIn ?? null, c.nights)
                        }
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--brand)', fontSize: 11.5, fontWeight: 700, textDecoration: 'none', marginTop: 8 }}
                      >
                        Search {hotelBrandFilter !== 'any' ? hotelBrandFilter : 'hotels'} <ExternalLinkIcon size={11} color="var(--brand)" />
                      </a>
                    </div>
                  </div>

                  {leg && (
                    <div style={{ padding: '8px 14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {leg.recommendedMode === 'flight' ? (
                        <PlaneIcon size={16} color="var(--ink3)" />
                      ) : leg.recommendedMode === 'rail' ? (
                        <TrainIcon size={16} color="var(--ink3)" />
                      ) : (
                        <CarIcon size={16} color="var(--ink3)" />
                      )}
                      <div style={{ fontSize: 11.5, color: 'var(--ink2)', flex: 1 }}>
                        {Math.round(leg.distanceKm)} km · est. {formatHours(leg.estimatedTravelHours)}
                        {leg.estimatedOverheadHours > 0 && ` + ~${formatHours(leg.estimatedOverheadHours)} ${leg.recommendedMode === 'flight' ? 'airports' : 'station'}`}
                        · ~£{Math.round(leg.estimatedCostGBP)}
                      </div>
                      {leg.recommendedMode === 'flight' && (
                        <a
                          href={googleFlightsSearchUrl(
                            cities[i].city, cities[i + 1].city, cityDates[i + 1]?.checkIn ?? null, null,
                            flightFilters
                          )}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--brand)', fontSize: 11, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                        >
                          Search <ExternalLinkIcon size={11} color="var(--brand)" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {home && cities.length > 0 && uniqueCountries.length > 1 && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{cities[cities.length - 1].city} → {home.city}</div>
                  <a
                    href={googleFlightsSearchUrl(
                      cities[cities.length - 1].city, home.city, tripEndDate, null,
                      flightFilters
                    )}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand)', fontSize: 11.5, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                  >
                    Search <ExternalLinkIcon size={12} color="var(--brand)" />
                  </a>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 3 }}>
                  {Math.round(returnKm).toLocaleString()} km · flight · est. {formatHours(estimateTravelHours(returnKm, 'flight'))} flying + ~{formatHours(estimateOverheadHours('flight'))} airports
                </div>
              </div>
            )}
          </div>

          {(loadingSeasonal || Object.keys(seasonalGuidance).length > 0) && (
            <>
              <div className="sect"><h2>Best time to go</h2></div>
              <div className="stack" style={{ display: 'grid', gap: 12 }}>
                {loadingSeasonal && Object.keys(seasonalGuidance).length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Checking seasonal patterns…</div>
                )}
                {destinations.map((dest) => {
                  const g = seasonalGuidance[dest.country];
                  if (!g) return null;
                  return (
                    <div key={dest.country} className="card">
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{dest.country}</div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {g.months.map((m) => (
                          <div key={m.month} style={{ flex: 1, textAlign: 'center' }} title={m.note}>
                            <div
                              style={{
                                height: 28, borderRadius: 5,
                                background: m.priceLevel === 'high' ? 'var(--red)' : m.priceLevel === 'medium' ? 'var(--amber)' : 'var(--green)',
                                opacity: m.priceLevel === 'high' ? 0.85 : m.priceLevel === 'medium' ? 0.6 : 0.5,
                              }}
                            />
                            <div style={{ fontSize: 8.5, color: 'var(--ink3)', marginTop: 3, fontWeight: 700 }}>{m.month}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: 'var(--ink3)' }}>
                        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--green)', opacity: 0.5, marginRight: 4 }} />Lower</span>
                        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--amber)', opacity: 0.6, marginRight: 4 }} />Medium</span>
                        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--red)', opacity: 0.85, marginRight: 4 }} />Higher</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 10, lineHeight: 1.5 }}>{g.summary}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 8, fontStyle: 'italic' }}>
                        General seasonal guidance, not live pricing -- real fares vary by route and booking time.
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

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
              {!startDate ? (
                <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 10 }}>
                  Set a departure date above to save this as a trip.
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 10 }}>
                  Departing {startDate}, returning {tripEndDate}.
                </div>
              )}
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
