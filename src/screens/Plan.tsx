import { useState, useEffect, useRef, Suspense, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays } from '../lib/tripDay';
import { calculateLeaveNeeded } from '../lib/annualLeave';
import { blendedGuideForMonth, dominantMonth, PRICE_COLOR, PRICE_TINT, CROWD_COLOR, CROWD_TINT, MONTH_NAMES, type BlendedMonthGuide } from '../lib/destinationGuide';
import { lazyWithRetry } from '../lib/lazyWithRetry';
import { PlaneIcon, TrainIcon, CarIcon, GripIcon, ExternalLinkIcon, ThermometerIcon, DropletIcon, CloudRainIcon, TagIcon, UsersIcon, MoonIcon, BedIcon, StatusIcon, CreditIcon, CalendarIcon } from '../components/Icons';
import { googleFlightsSearchUrl, googleHotelsSearchUrl, brandHotelSearchUrl, ALLIANCE_LABELS, type StopsFilter, type CabinFilter, type AllianceFilter } from '../lib/externalSearchLinks';
import { planningCountries, PLANNING_AIRPORTS_BY_IATA } from '../data/planningAirports';
import { allPlanningCountries } from '../data/globalAirportsLoader';
import { planLeg, STRONG_RAIL_COUNTRIES, estimateTravelHours, type LegPlan } from '../lib/tripPlanner';
import { nearestAirportToCity, type NearestAirportResult } from '../data/worldCitiesLoader';
import { planHotelOptions } from '../lib/hotelPlanner';
import { useLoyaltyProgrammes, useAllHotels, useAllFlights, usePromotions, useVouchers, useHomeLocation, useClimateData, useCrowdPriceData, usePointsValueData, useCityCashRates } from '../lib/useLiveData';
import { useCardResults } from '../lib/useCardResults';
import { computeStatusProgress } from '../lib/statusProgress';
import { withLiveOverrides } from '../lib/walletValue';
import {
  agentContext, airPassengerDuty, awardCashLabel, awardOptions, awardPointsLabel, holidayLine, schoolNote, cityCashRates as ratesForCity, forYou, measuredCash, nightPoints, nightPointsShort, stayCashUsd, stayInsights, stayLines,
  stopOutlook, usualAwardCabin, type ForYouItem, type Market, type PlannedStop, type StopOutlook,
} from '../lib/planIntel';
import type { AwardCabin } from '../data/awardClasses';
import { AIRLINE_COLORS } from '../data/airlineBrand';
import { countryCode, holidaysDuring, schoolBreakDuring, type Holiday, type SchoolHoliday } from '../lib/holidays';
import { useHolidays } from '../lib/useHolidays';
import { HOTEL_PRICES } from '../lib/hotelPrices';
import { haversineKm } from '../lib/travelStats';
import { addTrip, addHotel, addFlight, type RealClimateMonth, type RealCrowdPriceMonth } from '../lib/queries';
import { useCurrency } from '../lib/currency';
import { getBudgetEstimate, type BudgetEstimate } from '../lib/budgetEstimate';
import { civilianAirportName, formatHours, shortProgramme, stayRange } from '../lib/planFormat';
import { formatShortRange } from '../lib/format';
import { CitySearchInput } from '../components/CitySearchInput';
import { BrandLogo } from '../components/BrandLogo';
import type { WorldCity } from '../data/worldCitiesLoader';
import { Badge, Button, ErrorText, ScreenHeader, SectionLabel } from '../components/ui';
import { postFunction } from '../lib/serverFunction';

const PlanMap = lazyWithRetry(() => import('../components/PlanMap').then((m) => ({ default: m.PlanMap })));

const HOME_AIRPORTS = ['LHR', 'LGW', 'STN', 'LTN', 'LCY'];
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

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

// The weather for a stay on one line, each figure behind its icon:
// highs and lows, humidity, rain.
function WeatherLine({ blended }: { blended: BlendedMonthGuide }) {
  return (
    <div className="wx">
      <span><ThermometerIcon size={14} /><b>{Math.round(blended.tempHigh)}°</b>/{Math.round(blended.tempLow)}°</span>
      {blended.humidityPct != null && <span><DropletIcon size={14} /><b>{Math.round(blended.humidityPct)}%</b></span>}
      <span><CloudRainIcon size={14} /><b>{blended.rainLabel}</b></span>
    </div>
  );
}

// Season and crowds, the two judgement calls, as coloured flags.
function SeasonFlags({ blended }: { blended: BlendedMonthGuide }) {
  const price = blended.price === 'high' ? 'Peak' : blended.price === 'shoulder' ? 'Shoulder' : blended.price === 'low' ? 'Low season' : null;
  const crowd = blended.crowd ? `${blended.crowd[0].toUpperCase()}${blended.crowd.slice(1)} crowds` : null;
  if (!price && !crowd) return null;
  return (
    <div className="flags">
      {price && blended.price && (
        <span className="flag" style={{ color: PRICE_COLOR[blended.price], background: PRICE_TINT[blended.price] }}><TagIcon size={13} />{price}</span>
      )}
      {crowd && blended.crowd && (
        <span className="flag" style={{ color: CROWD_COLOR[blended.crowd], background: CROWD_TINT[blended.crowd] }}><UsersIcon size={13} />{crowd}</span>
      )}
    </div>
  );
}

// The whole year at once, coloured by season, with the month of the trip
// (or this month, before a date is picked) outlined.
function SeasonStrip({ country, city, climateData, crowdPriceData, highlightMonth }: {
  country: string; city: string | null; climateData: RealClimateMonth[]; crowdPriceData: RealCrowdPriceMonth[]; highlightMonth: number;
}) {
  const months = Array.from({ length: 12 }, (_, i) => {
    // A representative date within the month, just to drive the lookup:
    // the strip shows the seasonal pattern, so the exact day doesn't matter.
    const rep = `2026-${String(i + 1).padStart(2, '0')}-15`;
    return blendedGuideForMonth(climateData, crowdPriceData, city, country, i, rep, rep);
  });
  if (months.every((m) => m === null)) return null;
  return (
    <div>
      <div className="seasonstrip">
        {months.map((m, i) => (
          <i
            key={i} className={i === highlightMonth ? 'now' : ''} title={`${MONTH_NAMES[i]}${m?.price ? `: ${m.price} season` : ''}`}
            style={{ background: m?.price ? PRICE_COLOR[m.price] : 'var(--line)' }}
          />
        ))}
      </div>
      <div className="seasonstrip-labels" aria-hidden="true">{MONTH_LETTERS.map((l, i) => <span key={i}>{l}</span>)}</div>
    </div>
  );
}

// Real cash rates for a city, tier by tier, next to what a night costs in
// points at each programme -- to check a redemption against what the cash
// price would have been. A programme's points come from its own hotels'
// measured prices for the stay where enough were priced, so the column
// agrees with Where to stay (Marriott at New Year in Dubai is not the
// city's everyday mid-range).
function CashVsPoints({ country, city, stop, market }: { country: string; city: string | null; stop: PlannedStop | null; market: Market }) {
  const { format, fromUsd } = useCurrency();
  // Every tier from one city (see cityCashRates).
  const matched = ratesForCity(market.rates, country, city);
  if (matched.length === 0) return null;
  const tierLabel = { budget: 'Budget', mid: 'Mid-range', luxury: 'Luxury' } as const;
  const priorityOrder = ['Marriott Bonvoy', 'Hilton Honors', 'World of Hyatt', 'IHG One Rewards', 'Accor ALL'];
  const mainProgrammes = market.pointsValue
    .filter((p) => priorityOrder.includes(p.programme))
    .sort((a, b) => priorityOrder.indexOf(a.programme) - priorityOrder.indexOf(b.programme));

  return (
    <details className="plan-more">
      <summary>Cash or points in {matched[0].city}</summary>
      <div className="cashpts">
        {(['budget', 'mid', 'luxury'] as const).map((tier) => {
          const rate = matched.find((r) => r.tier === tier);
          if (!rate) return null;
          // The researched rate in the stop's season, where it has a date.
          const midCashUsd = stop ? stayCashUsd(rate, stop, market) : (rate.priceLowUsd + rate.priceHighUsd) / 2;
          return (
            <div key={tier}>
              <div className="cashpts-tier">
                <span>{tierLabel[tier]}</span>
                <b>{rate.priceLowUsd === rate.priceHighUsd ? `~${format(fromUsd(rate.priceLowUsd))}` : `${format(fromUsd(rate.priceLowUsd))}–${format(fromUsd(rate.priceHighUsd))}`}</b>
              </div>
              <div className="cashpts-pts">
                {mainProgrammes.map((p) => {
                  // Each programme priced its own way (planIntel's nightPoints).
                  const measured = stop ? measuredCash(stop, p.programme, tier, market) : null;
                  const n = nightPoints(p.programme, measured?.usd ?? midCashUsd, null, market);
                  return n && <span key={p.programme}>{shortProgramme(p.programme)} {nightPointsShort(n)}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function ModeIcon({ mode, size = 15 }: { mode: LegPlan['recommendedMode']; size?: number }) {
  if (mode === 'flight') return <PlaneIcon size={size} color="currentColor" />;
  if (mode === 'rail') return <TrainIcon size={size} color="currentColor" />;
  return <CarIcon size={size} color="currentColor" />;
}

function PickIcon({ kind }: { kind: ForYouItem['kind'] }) {
  if (kind === 'flight') return <PlaneIcon size={18} />;
  if (kind === 'stay') return <BedIcon size={18} />;
  if (kind === 'status') return <StatusIcon size={18} />;
  if (kind === 'voucher') return <TagIcon size={18} />;
  if (kind === 'prices') return <CreditIcon size={18} />;
  if (kind === 'crowds') return <UsersIcon size={18} />;
  if (kind === 'holiday' || kind === 'school') return <CalendarIcon size={18} />;
  return <CloudRainIcon size={18} />;
}

// Search options' cabin as a cabin, or null for any.
const CABIN_OF: Record<CabinFilter, AwardCabin | null> = { any: null, economy: 'Economy', 'premium-economy': 'Premium Economy', business: 'Business', first: 'First' };

function SearchLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="plan-link" href={href} target="_blank" rel="noreferrer">
      {children}<ExternalLinkIcon size={11} color="currentColor" />
    </a>
  );
}

export function Plan() {
  const navigate = useNavigate();
  const { data: rawProgrammes } = useLoyaltyProgrammes();
  const { data: allHotels } = useAllHotels();
  const { data: allFlights } = useAllFlights();
  const { data: promotions } = usePromotions();
  const { data: vouchers } = useVouchers();
  // Balances as they stand, stays since each was entered included.
  const loyaltyProgrammes = withLiveOverrides(rawProgrammes, allHotels, promotions);
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
  const [stopsFilter, setStopsFilter] = useState<StopsFilter>('any');
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>('any');
  const [allianceFilter, setAllianceFilter] = useState<AllianceFilter>('any');
  const [airlineFilter, setAirlineFilter] = useState('');
  const { data: homeLocation } = useHomeLocation();
  const { data: climateData } = useClimateData();
  const { data: crowdPriceData } = useCrowdPriceData();
  const { data: pointsValueData } = usePointsValueData();
  const { data: cityCashRates } = useCityCashRates();
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetEstimate, setBudgetEstimate] = useState<BudgetEstimate | null>(null);
  const [budgetError, setBudgetError] = useState('');
  const [hotelBrandFilter, setHotelBrandFilter] = useState<string>('any');
  const [smartQueries, setSmartQueries] = useState<Record<string, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const cardResults = useCardResults(today);
  // City cash rates are researched in USD.
  const { rates: fx } = useCurrency();
  const usdToGbp = 1 / (fx.USD || 1.27);
  // Public holidays for each destination in the years the trip touches.
  const holidayPairs = destinations.flatMap((d) => {
    const code = countryCode(d.country);
    const start = startDate || today;
    const years = [...new Set([start.slice(0, 4), addDays(start, 60).slice(0, 4)])].map(Number);
    return code ? years.map((year) => ({ code, year })) : [];
  });
  const { holidays: holidaysByKey, school: schoolByKey } = useHolidays(holidayPairs);
  const holidaysFor = (country: string): Holiday[] => {
    const code = countryCode(country);
    return code ? Object.entries(holidaysByKey).filter(([k]) => k.startsWith(`${code}:`)).flatMap(([, v]) => v) : [];
  };
  const schoolFor = (country: string): SchoolHoliday[] => {
    const code = countryCode(country);
    return code ? Object.entries(schoolByKey).filter(([k]) => k.startsWith(`${code}:`)).flatMap(([, v]) => v) : [];
  };

  function smartFlightUrl(fromCity: string, toCity: string, departDate: string | null, returnDate: string | null | undefined): string {
    return googleFlightsSearchUrl(fromCity, toCity, departDate, returnDate, {
      stops: stopsFilter, cabin: cabinFilter, airline: airlineFilter || undefined,
    });
  }

  // Hotel programme names often don't match how people search for the
  // brand, so a programme search asks the server for a better query and
  // caches it; the plain link is used until it arrives.
  function smartHotelUrl(city: string, country: string, checkIn: string | null, nights: number | null): string {
    if (hotelBrandFilter === 'any') return googleHotelsSearchUrl(city, country, checkIn, nights);
    if (hotelBrandFilter === 'Marriott Bonvoy') return brandHotelSearchUrl(hotelBrandFilter, city, country); // verified direct link, no AI needed
    const key = `hotel:${hotelBrandFilter}|${city}|${country}`;
    const cached = smartQueries[key];
    if (cached) return `https://www.google.com/travel/hotels?q=${encodeURIComponent(cached)}`;
    fetchSmartQuery(key, 'hotel', { brand: hotelBrandFilter, city, country });
    return brandHotelSearchUrl(hotelBrandFilter, city, country);
  }

  function fetchSmartQuery(key: string, type: 'flight' | 'hotel', params: Record<string, unknown>) {
    if (smartQueries[key] !== undefined) return; // already fetched or in flight
    setSmartQueries((prev) => ({ ...prev, [key]: '' }));
    postFunction('smart-search-query', { type, params })
      .then((res) => res.json())
      .then((data) => {
        if (data.query) setSmartQueries((prev) => ({ ...prev, [key]: data.query }));
      })
      .catch(() => {
        // Leave the cache entry empty: the plain query is used instead.
      });
  }

  function handleDragStart(index: number, e: ReactPointerEvent) {
    setDraggedIndex(index);
    setDragOverIndex(index);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handleDragMove(e: ReactPointerEvent) {
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
  // more reliable than trusting the model's own airport guess.
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

  async function fetchBudgetEstimate() {
    setBudgetLoading(true);
    setBudgetError('');
    setBudgetEstimate(null);
    try {
      const legs = cities.map((c, i) => ({ city: c.city, country: c.country, nights: c.nights, checkIn: cityDates[i]?.checkIn ?? startDate }));
      const est = await getBudgetEstimate(homeAirport, homeLocation.city, startDate, legs);
      setBudgetEstimate(est);
    } catch (e) {
      setBudgetError(e instanceof Error ? e.message : 'Something went wrong getting the estimate.');
    } finally {
      setBudgetLoading(false);
    }
  }

  async function suggest() {
    setLoading(true);
    setError('');
    try {
      // Each country's cities are suggested independently, then joined in
      // the order the user added them -- keeps each request focused.
      // Destinations where the user picked their own cities skip the
      // suggestion entirely: their explicit choice takes priority.
      const results: SuggestedCity[] = [];
      // When each country's part of the trip starts, so the agent hears
      // about the right month for the second country too.
      let arrive = startDate || null;
      for (const dest of destinations) {
        const totalNights = dest.nights ? parseInt(dest.nights, 10) : 10;
        const destStart = arrive;
        if (arrive) arrive = addDays(arrive, totalNights);

        if (dest.cities.length > 0) {
          const perCity = Math.max(1, Math.round(totalNights / dest.cities.length));
          for (const c of dest.cities) {
            results.push({ city: c.name, country: dest.country, lat: c.lat, lng: c.lng, nights: perCity, why: '', nearestAirport: null });
          }
          continue;
        }

        // The agent is given the season and crowds in the month of travel
        // and the cities already stayed in (planIntel's agentContext).
        const context = agentContext(dest.country, destStart, totalNights, climateData, crowdPriceData, allHotels, homeLocation.city, holidaysFor(dest.country), schoolFor(dest.country));
        const res = await postFunction('suggest-cities', { country: dest.country, nights: totalNights, context });
        const data = await res.json();
        if (!res.ok) throw new Error(`${dest.country}: ${data.error || 'Could not get suggestions'}`);
        for (const c of data.cities ?? []) {
          results.push({ ...c, country: dest.country });
        }
      }
      setCities(results);
      // The answer is below the form: take you to it.
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const home = PLANNING_AIRPORTS_BY_IATA[homeAirport];

  // Legs between consecutive cities. Rail is only considered when both
  // ends are in the same strong-rail country -- crossing a border defaults
  // to flight, which is realistic for the vast majority of country pairs.
  const legs: LegPlan[] = [];
  for (let i = 0; i < cities.length - 1; i++) {
    const sameCountry = cities[i].country === cities[i + 1].country;
    const railLikely = sameCountry && STRONG_RAIL_COUNTRIES.has(cities[i].country);
    legs.push(planLeg(cities[i], cities[i + 1], railLikely));
  }

  const outboundKm = home && cities.length > 0 ? haversineKm(home.lat, home.lng, cities[0].lat, cities[0].lng) : 0;
  const returnKm = home && cities.length > 0 ? haversineKm(cities[cities.length - 1].lat, cities[cities.length - 1].lng, home.lat, home.lng) : 0;
  const domesticCost = legs.reduce((s, l) => s + l.estimatedCostGBP, 0);
  const totalNights = cities.reduce((s, c) => s + c.nights, 0);
  const uniqueCountries = [...new Set(cities.map((c) => c.country))];
  useEffect(() => {
    if (mapFocus && !uniqueCountries.includes(mapFocus)) setMapFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);
  const mapCities = mapFocus ? cities.filter((c) => c.country === mapFocus) : cities;
  const mapLegs: LegPlan[] = mapFocus
    ? (() => {
        const out: LegPlan[] = [];
        for (let i = 0; i < mapCities.length - 1; i++) out.push(planLeg(mapCities[i], mapCities[i + 1], STRONG_RAIL_COUNTRIES.has(mapFocus)));
        return out;
      })()
    : legs;
  const mapHome = mapFocus ? null : (home ?? null); // the international leg isn't part of a single country's view
  const hotelOptions = totalNights > 0 ? planHotelOptions(loyaltyProgrammes, allHotels, totalNights) : [];
  const bestHotel = hotelOptions[0] ?? null;

  // Real calendar dates for each city, from cumulative nights after the
  // start date: "4 nights in Tokyo" becomes a bookable check-in. Shared by
  // the search links and the save-to-trips flow.
  const cityDates = (() => {
    if (!startDate) return cities.map((c) => ({ city: c, checkIn: null as string | null }));
    let cursor = startDate;
    return cities.map((c) => {
      const checkIn = cursor;
      cursor = addDays(cursor, c.nights);
      return { city: c, checkIn };
    });
  })();
  const tripEndDate = (() => {
    if (!startDate) return null;
    let cursor = startDate;
    for (const c of cities) cursor = addDays(cursor, c.nights);
    return cursor;
  })();
  // The leave estimate uses the per-city plan once there is one, and the
  // nights entered per destination before that, so it's useful while
  // filling in the form.
  const totalPlannedNights = destinations.reduce((sum, d) => sum + (Number(d.nights) || 0), 0);
  const leaveEstimateEndDate = cities.length > 0 ? tripEndDate : (startDate && totalPlannedNights > 0 ? addDays(startDate, totalPlannedNights) : null);
  const leave = startDate && leaveEstimateEndDate ? calculateLeaveNeeded(startDate, leaveEstimateEndDate) : null;

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
          nightlyRate: bestHotel ? Math.round(bestHotel.estimatedNightlyGBP) : null, avgRate: null, award: false, benefitType: null,
        });
      }

      // Outbound and return flights, plus any inter-city leg recommended
      // as air travel -- ground legs (rail/road) aren't logged as flights.
      // Verified airport codes are preferred over the model's own guess.
      const airportFor = (c: SuggestedCity) => cityAirports[c.city]?.airport.iata ?? c.nearestAirport;

      if (home && airportFor(cities[0])) {
        await addFlight({
          date: startDate, from: homeAirport, to: airportFor(cities[0])!,
          airline: 'TBC', flightNo: null, cabin: 'Economy', status: 'needs-confirm',
          cost: Math.round(Math.max(60, outboundKm * 0.11)),
          award: false, overnight: false, tripId, departureTime: null, arrivalTime: null,
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
          cost: Math.round(legs[i].estimatedCostGBP), award: false, overnight: false, tripId, departureTime: null, arrivalTime: null,
        });
      }
      if (home && airportFor(cities[cities.length - 1])) {
        await addFlight({
          date: endDate, from: airportFor(cities[cities.length - 1])!, to: homeAirport,
          airline: 'TBC', flightNo: null, cabin: 'Economy', status: 'needs-confirm',
          cost: Math.round(Math.max(60, returnKm * 0.11)), award: false, overnight: false, tripId, departureTime: null, arrivalTime: null,
        });
      }

      // The saved trip takes the planner's place, so Back goes to Trips.
      navigate(`/trips/${tripId}`, { replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save this plan');
    } finally {
      setSaving(false);
    }
  }

  const programmeFor = (name: string) => loyaltyProgrammes.find((p) => p.name === name);
  const airportOf = (c: SuggestedCity) => cityAirports[c.city]?.airport ?? null;

  // What the account makes of this plan (src/lib/planIntel.ts): the
  // flight on points, status and points for each programme's stays, the
  // weather and crowds at each stop, and the few picks worth acting on.
  const stops: PlannedStop[] = cityDates.map(({ city, checkIn }) => ({ city: city.city, country: city.country, nights: city.nights, checkIn }));
  const usualCabin = usualAwardCabin(allFlights);
  const chosenCabin = CABIN_OF[cabinFilter];
  const cabins: AwardCabin[] = chosenCabin ? [chosenCabin] : [...new Set<AwardCabin>([usualCabin, 'Economy'])];
  const travelDate = startDate || today;
  const pointsFlights = cities.length > 0
    ? awardOptions([airportOf(cities[0])?.iata ?? null, cities[0].nearestAirport], cities[0].country, travelDate, cabins, { programmes: loyaltyProgrammes, vouchers })
    : [];
  const progressOf = (name: string) => {
    const p = loyaltyProgrammes.find((x) => x.name === name);
    return p && p.category === 'hotel' && p.nextTier && p.nights != null ? computeStatusProgress(p, allHotels, promotions, cardResults, today) : null;
  };
  const market: Market = { rates: cityCashRates, crowd: crowdPriceData, pointsValue: pointsValueData, usdToGbp, usdToEur: (fx.EUR || 1.17) / (fx.USD || 1.27), prices: HOTEL_PRICES };
  const stays = cities.length > 0
    ? stayInsights(hotelOptions, stops, { programmes: loyaltyProgrammes, vouchers, flights: allFlights, hotels: allHotels, promotions }, progressOf, market, today)
    : [];
  const outlooks = stops.map((st) => stopOutlook(climateData, crowdPriceData, st, holidaysFor(st.country), schoolFor(st.country))).filter((o): o is StopOutlook => o != null);
  const picks = cities.length > 0 ? forYou({ flights: pointsFlights, stays, outlooks, cabin: chosenCabin ?? usualCabin, stops }) : [];
  const apd = cities.length > 0 && home ? airPassengerDuty(cities[0].country, chosenCabin ?? 'Economy', travelDate) : null;

  // A flight to or from home: where from and to, the flying time, and a
  // search for it.
  const homeLeg = (from: string, to: string, km: number, href: string) => (
    <div className="routeleg intl">
      <span className="routeleg-icon"><PlaneIcon size={15} color="currentColor" /></span>
      <span className="routeleg-text"><b>{from} → {to}</b> · ~{formatHours(estimateTravelHours(km, 'flight'))}</span>
      <SearchLink href={href}>Flights</SearchLink>
    </div>
  );

  return (
    <div>
      <ScreenHeader title="Plan a trip" />

      <div className="plan">
        {/* What you want: where, how long, from where and when. */}
        <div className="plan-card">
          {destinations.map((dest) => {
            const nights = Number(dest.nights) || 0;
            const setNights = (n: number) => { updateDestination(dest.id, { nights: String(Math.max(1, Math.min(60, n))) }); setCities([]); };
            return (
              <div key={dest.id} className="plan-dest">
                <div className="plan-dest-row">
                  <select
                    className="input" aria-label="Destination" value={dest.country}
                    onChange={(e) => { updateDestination(dest.id, { country: e.target.value, cities: [] }); setCities([]); }}
                  >
                    {allCountries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="stepper" role="group" aria-label={`Nights in ${dest.country}`}>
                    <button type="button" aria-label="One night fewer" onClick={() => setNights(nights - 1)}>−</button>
                    <span><b>{nights}</b><small>nights</small></span>
                    <button type="button" aria-label="One night more" onClick={() => setNights(nights + 1)}>+</button>
                  </div>
                  {destinations.length > 1 && (
                    <button type="button" className="plan-x" aria-label={`Remove ${dest.country}`} onClick={() => { removeDestination(dest.id); setCities([]); }}>✕</button>
                  )}
                </div>
                <CitySearchInput country={dest.country} selected={dest.cities} onChange={(picked) => { updateDestination(dest.id, { cities: picked }); setCities([]); }} />
              </div>
            );
          })}
          <button type="button" className="tagbtn" style={{ justifySelf: 'start' }} onClick={addDestination}>+ Country</button>

          <div className="plan-when">
            <label className="plan-field">
              <span className="field-label">From</span>
              <select className="input" value={homeAirport} onChange={(e) => setHomeAirport(e.target.value)}>
                {HOME_AIRPORTS.map((code) => {
                  const a = PLANNING_AIRPORTS_BY_IATA[code];
                  return <option key={code} value={code}>{a ? `${civilianAirportName(a.name).replace(/ Airport$/, '')} (${code})` : code}</option>;
                })}
              </select>
            </label>
            <label className="plan-field">
              <span className="field-label">Leave</span>
              <input type="date" className="input" value={startDate} min={today} onChange={(e) => setStartDate(e.target.value)} />
            </label>
          </div>
          {leave && (
            <div className="plan-leave">
              <b>{leave.leaveDaysNeeded} day{leave.leaveDaysNeeded === 1 ? '' : 's'}</b> annual leave
              {leave.bankHolidays > 0 && ` · ${leave.bankHolidays} bank holiday${leave.bankHolidays === 1 ? '' : 's'}`}
            </div>
          )}
          <Button block onClick={suggest} disabled={loading}>{loading ? 'Planning…' : cities.length > 0 ? 'Suggest again' : 'Plan this trip'}</Button>
          {error && <ErrorText>{error}</ErrorText>}
        </div>

        {/* Before there's a plan: each destination at a glance in the
            month you'd go. */}
        {cities.length === 0 && destinations.map((dest) => {
          const start = startDate || today;
          const nights = Number(dest.nights) || 0;
          const end = nights > 0 ? addDays(start, nights) : start;
          const monthIdx = dominantMonth(start, end);
          const city = dest.cities[0]?.name ?? null;
          const blended = blendedGuideForMonth(climateData, crowdPriceData, city, dest.country, monthIdx, start, end);
          if (!blended) return null;
          return (
            <div key={dest.id} className="plan-card glance">
              <div className="glance-head">
                <span className="glance-title">{blended.label} in {MONTH_NAMES[monthIdx]}</span>
              </div>
              {blended.summary && <div className="glance-sum">{blended.summary}</div>}
              <WeatherLine blended={blended} />
              <SeasonFlags blended={blended} />
              <SeasonStrip country={dest.country} city={city} climateData={climateData} crowdPriceData={crowdPriceData} highlightMonth={monthIdx} />
              {blended.crowdDriver && <div className="glance-note">{blended.crowdDriver}{blended.crowdDriverDates ? `, ${blended.crowdDriverDates}` : ''}</div>}
            </div>
          );
        })}

        {cities.length > 0 && (
          <div ref={resultsRef} className="plan-results">
            {/* The plan in one card: where, when, and saving it. */}
            <div className="plan-card plan-sum">
              <div className="plan-sum-title">{uniqueCountries.join(' · ')}</div>
              <div className="plan-sum-dates">{startDate && tripEndDate ? formatShortRange(startDate, tripEndDate, today) : 'No dates yet'}</div>
              <div className="plan-stats">
                <div><b>{totalNights}</b><span>nights</span></div>
                <div><b>{cities.length}</b><span>{cities.length === 1 ? 'stop' : 'stops'}</span></div>
                <div><b>{leave ? leave.leaveDaysNeeded : '–'}</b><span>days off</span></div>
              </div>
              <Button block onClick={saveToTrips} disabled={!startDate || saving}>{saving ? 'Saving…' : 'Save to Trips'}</Button>
              {saveError && <ErrorText>{saveError}</ErrorText>}
            </div>

            {picks.length > 0 && (
              <>
                <SectionLabel style={{ marginTop: 8 }}>For you</SectionLabel>
                <div className="listcard">
                  {picks.map((p) => (
                    <div key={p.kind} className="pickrow">
                      <span className="todo-icon" aria-hidden="true"><PickIcon kind={p.kind} /></span>
                      <span className="pickrow-main"><span className="rowtitle">{p.title}</span><span className="rowsub">{p.sub}</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {uniqueCountries.length > 1 && (
              <div className="plan-tags">
                <button className={mapFocus === null ? 'tagbtn on' : 'tagbtn'} onClick={() => setMapFocus(null)}>All</button>
                {uniqueCountries.map((c) => (
                  <button key={c} className={mapFocus === c ? 'tagbtn on' : 'tagbtn'} onClick={() => setMapFocus(c)}>{c}</button>
                ))}
              </div>
            )}
            <Suspense fallback={<div style={{ height: 320, background: 'var(--map-bg)', borderRadius: 'var(--r-md)' }} />}>
              <PlanMap
                home={mapHome}
                cities={mapCities}
                departDate={startDate || null}
                returnDate={tripEndDate}
                domesticLegs={mapLegs.map((l) => ({ mode: l.recommendedMode, distanceKm: l.distanceKm, hours: l.estimatedTravelHours }))}
                internationalLeg={!mapFocus && home && cities.length > 0 ? { mode: 'flight', distanceKm: outboundKm, hours: estimateTravelHours(outboundKm, 'flight') } : null}
              />
            </Suspense>

            {/* The route: out, each stop, the hops between, and home. */}
            <SectionLabel style={{ marginTop: 8 }}>Route</SectionLabel>
            <div className="route">
              {home && homeLeg(homeAirport, airportOf(cities[0])?.iata ?? cities[0].city, outboundKm,
                smartFlightUrl(home.city ?? 'London', cities[0].city, startDate || null, uniqueCountries.length === 1 ? tripEndDate : null))}

              {cities.map((c, i) => {
                const leg = legs[i];
                const checkIn = cityDates[i]?.checkIn ?? null;
                const checkOut = checkIn ? addDays(checkIn, c.nights) : null;
                const monthIdx = checkIn && checkOut ? dominantMonth(checkIn, checkOut) : null;
                const blended = checkIn && checkOut && monthIdx != null
                  ? blendedGuideForMonth(climateData, crowdPriceData, c.city, c.country, monthIdx, checkIn, checkOut)
                  : null;
                const dragging = draggedIndex === i;
                const target = dragOverIndex === i && draggedIndex !== null && draggedIndex !== i;
                return (
                  <div key={`${c.city}-${i}`}>
                    <div ref={(el) => { rowRefs.current[i] = el; }} className={`stopcard${dragging ? ' dragging' : ''}${target ? ' target' : ''}`}>
                      <button
                        className="stopcard-grip" aria-label={`Reorder ${c.city}`}
                        onPointerDown={(e) => handleDragStart(i, e)} onPointerMove={handleDragMove}
                        onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}
                      >
                        <GripIcon size={16} color="var(--ink3)" />
                      </button>
                      <span className="stopcard-badge">{i + 1}</span>
                      <div className="stopcard-main">
                        <div className="stopcard-top">
                          <span className="stopcard-city">{c.city}</span>
                          <span className="moons" aria-label={`${c.nights} nights`}>
                            {Array.from({ length: Math.min(c.nights, 7) }, (_, k) => <MoonIcon key={k} size={12} />)}
                            {c.nights > 7 && <small>+{c.nights - 7}</small>}
                          </span>
                        </div>
                        <div className="stopcard-sub">
                          {checkIn && checkOut ? stayRange(checkIn, checkOut) : `${c.nights} night${c.nights === 1 ? '' : 's'}`}
                          {uniqueCountries.length > 1 ? ` · ${c.country}` : ''}
                        </div>
                        {c.why && <div className="stopcard-why">{c.why}</div>}
                        {blended && <WeatherLine blended={blended} />}
                        {blended && <SeasonFlags blended={blended} />}
                        {blended?.crowdDriver && <div className="glance-note">{blended.crowdDriver}{blended.crowdDriverDates ? `, ${blended.crowdDriverDates}` : ''}</div>}
                        {checkIn && holidayLine(holidaysDuring(holidaysFor(c.country), checkIn, c.nights)) && (
                          <div className="glance-note">{holidayLine(holidaysDuring(holidaysFor(c.country), checkIn, c.nights))}</div>
                        )}
                        {checkIn && schoolNote(schoolBreakDuring(schoolFor(c.country), checkIn, c.nights), blended?.crowdDriver) && (
                          <div className="glance-note">{schoolNote(schoolBreakDuring(schoolFor(c.country), checkIn, c.nights), blended?.crowdDriver)}</div>
                        )}
                        <SearchLink href={smartHotelUrl(c.city, c.country, checkIn, c.nights)}>{hotelBrandFilter !== 'any' ? shortProgramme(hotelBrandFilter) : 'Hotels'}</SearchLink>
                      </div>
                    </div>

                    {leg && (
                      <div className="routeleg">
                        <span className="routeleg-icon"><ModeIcon mode={leg.recommendedMode} /></span>
                        <span className="routeleg-text">
                          ~{formatHours(leg.estimatedTravelHours + leg.estimatedOverheadHours)} · ~£{Math.round(leg.estimatedCostGBP)}
                        </span>
                        {leg.recommendedMode === 'flight' && (
                          <SearchLink href={smartFlightUrl(cities[i].city, cities[i + 1].city, cityDates[i + 1]?.checkIn ?? null, null)}>Flights</SearchLink>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {home && uniqueCountries.length > 1 && homeLeg(airportOf(cities[cities.length - 1])?.iata ?? cities[cities.length - 1].city, homeAirport, returnKm,
                smartFlightUrl(cities[cities.length - 1].city, home.city, tripEndDate, null))}
            </div>

            {pointsFlights.length > 0 && (
              <>
                <SectionLabel style={{ marginTop: 8 }}>On points, one way</SectionLabel>
                <div className="listcard">
                  {pointsFlights.map((o) => {
                    const cash = awardCashLabel(o);
                    return (
                      <div key={`${o.airline}-${o.cabin}-${o.place}`} className="pickrow">
                        <Badge code={o.airline} colour={AIRLINE_COLORS[o.airline] ?? null} />
                        <span className="pickrow-main">
                          <span className="rowtitle">{o.airlineName} · {o.cabin}</span>
                          <span className="rowsub">
                            {awardPointsLabel(o)} {o.currency}{cash ? ` + ${cash}` : ''}
                            {o.awardClass ? ` · class ${o.awardClass}` : ''}{o.perk ? ` · ${o.perk}` : ''}
                          </span>
                        </span>
                        {o.covers
                          ? <span className="tag solid">{o.seats} seat{o.seats === 1 ? '' : 's'}</span>
                          : <span className="tag">−{(o.points - o.balance).toLocaleString()}</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <details className="plan-more">
              <summary>Search options</summary>
              <div className="plan-options">
                <div className="plan-tags">
                  {(['any', 'nonstop', 'one-stop'] as StopsFilter[]).map((s) => (
                    <button key={s} className={stopsFilter === s ? 'tagbtn on' : 'tagbtn'} onClick={() => setStopsFilter(s)}>
                      {s === 'any' ? 'Any stops' : s === 'nonstop' ? 'Nonstop' : '1 stop max'}
                    </button>
                  ))}
                </div>
                <input value={airlineFilter} onChange={(e) => setAirlineFilter(e.target.value)} placeholder="Airline" className="input" aria-label="Airline" />
                <div className="plan-when">
                  <select value={cabinFilter} onChange={(e) => setCabinFilter(e.target.value as CabinFilter)} className="input" aria-label="Cabin">
                    <option value="any">Any cabin</option>
                    <option value="economy">Economy</option>
                    <option value="premium-economy">Premium economy</option>
                    <option value="business">Business</option>
                    <option value="first">First</option>
                  </select>
                  <select value={allianceFilter} onChange={(e) => setAllianceFilter(e.target.value as AllianceFilter)} className="input" aria-label="Alliance">
                    <option value="any">Any alliance</option>
                    <option value="star-alliance">Star Alliance</option>
                    <option value="oneworld">Oneworld</option>
                    <option value="skyteam">SkyTeam</option>
                  </select>
                </div>
                {/* Google Flights links can't preselect an alliance. */}
                {allianceFilter !== 'any' && <div className="glance-note">Choose {ALLIANCE_LABELS[allianceFilter]} under Airlines in Google Flights.</div>}
                {loyaltyProgrammes.some((p) => p.category === 'hotel') && (
                  <select value={hotelBrandFilter} onChange={(e) => setHotelBrandFilter(e.target.value)} className="input" aria-label="Hotel search">
                    <option value="any">Any hotel</option>
                    {loyaltyProgrammes.filter((p) => p.category === 'hotel').map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                )}
              </div>
            </details>

            {/* Where to stay: the best-value programme, the rest folded away. */}
            {bestHotel && (
              <>
                <SectionLabel style={{ marginTop: 8 }}>Where to stay</SectionLabel>
                {(() => {
                  const prog = programmeFor(bestHotel.programme);
                  return (
                    <div className="plan-card staybest">
                      <div className="staybest-head">
                        <BrandLogo name={bestHotel.programme} shape={prog?.shape} color={prog?.color} accent={prog?.accent} size={38} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="staybest-name">{bestHotel.programme}</div>
                          <div className="staybest-sub">{bestHotel.tier ?? 'Best value'}</div>
                        </div>
                        <div className="staybest-rate"><b>~£{Math.round(bestHotel.estimatedNightlyGBP)}</b><span>a night</span></div>
                      </div>
                      <div className="staybest-back">~{Math.round(bestHotel.pointsEarned).toLocaleString()} pts back · ~£{Math.round(bestHotel.effectiveNightlyGBP)} a night after points</div>
                      {stayLines(stays[0]).map((l) => <div key={l} className="staybest-back">{l}</div>)}
                      {bestHotel.benefits.length > 0 && (
                        <div className="flags">{bestHotel.benefits.slice(0, 3).map((b) => <span key={b} className="flag plain">{b.replace(/ \(.*\)$/, '')}</span>)}</div>
                      )}
                    </div>
                  );
                })()}
                {hotelOptions.length > 1 && (
                  <details className="plan-more">
                    <summary>Other programmes</summary>
                    <div className="stayothers">
                      {hotelOptions.slice(1).map((o, i) => {
                        const prog = programmeFor(o.programme);
                        const lines = stayLines(stays[i + 1]);
                        return (
                          <div key={o.programme} className="stayother">
                            <BrandLogo name={o.programme} shape={prog?.shape} color={prog?.color} accent={prog?.accent} size={28} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <b>{o.programme}</b>
                              <small>~{Math.round(o.pointsEarned).toLocaleString()} pts back</small>
                              {lines.map((l) => <small key={l}>{l}</small>)}
                            </span>
                            <span className="stayother-rate">~£{Math.round(o.estimatedNightlyGBP)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
                <CashVsPoints country={cities[0].country} city={cities[0].city} stop={stops[0] ?? null} market={market} />
              </>
            )}

            {/* Costs: rough estimates from the plan, and a live one on request. */}
            <SectionLabel style={{ marginTop: 8 }}>Cost</SectionLabel>
            <div className="plan-card plan-costs">
              {bestHotel && <Row label={`Stays, ${shortProgramme(bestHotel.programme)}`} value={`~£${Math.round(bestHotel.estimatedNightlyGBP * totalNights).toLocaleString()}`} />}
              {legs.length > 0 && <Row label="Getting around" value={`~£${Math.round(domesticCost).toLocaleString()}`} />}
              {apd && <Row label="Air passenger duty" value={`£${apd.amount % 1 === 0 ? apd.amount : apd.amount.toFixed(2)}`} />}
              {budgetEstimate && (
                <>
                  <Row label="Flights" value={`£${budgetEstimate.flightEstimateGBP[0]}–${budgetEstimate.flightEstimateGBP[1]}`} />
                  <Row label="Food and drink a day" value={`£${budgetEstimate.foodPerDayGBP[0]}–${budgetEstimate.foodPerDayGBP[1]}`} />
                  <Row label="Live estimate" value={`£${budgetEstimate.totalEstimateGBP[0].toLocaleString()}–${budgetEstimate.totalEstimateGBP[1].toLocaleString()}`} strong />
                </>
              )}
              {budgetError && <ErrorText>{budgetError}</ErrorText>}
              <Button variant="secondary" block onClick={fetchBudgetEstimate} disabled={!startDate || budgetLoading}>
                {budgetLoading ? 'Checking prices…' : budgetEstimate ? 'Check prices again' : 'Check live prices'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'plan-row strong' : 'plan-row'}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
