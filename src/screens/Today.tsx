import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Trip } from '../types';
import { useNavigate } from 'react-router-dom';
import {
  useTrips, useAllHotels, usePromotions, useLoyaltyProgrammes, useReviews, useVouchers,
} from '../lib/useLiveData';
import { useCardResults } from '../lib/useCardResults';
import { useTripFlightGaps } from '../lib/useTripFlightGaps';
import { tonightStay, countdownLabel } from '../lib/tripTimeline';
import {
  nextUp, promosToRegister, promoShortName, dayMonthShort, weekdayShort, tripNights, type NextItem,
} from '../lib/today';
import { readDoneTodos, markTodoDone, registeredHere } from '../lib/doneTodos';
import { setPromotionRegistered } from '../lib/queries';
import { loyaltyHighlights } from '../lib/loyaltyHighlights';
import { findHotelsNeedingReview } from '../lib/reviewScoring';
import { computeStatusProgress } from '../lib/statusProgress';
import { nightSegments, ringTicks } from '../lib/statusRing';
import { withLiveOverrides } from '../lib/walletValue';
import { tripDayInfo } from '../lib/tripDay';
import { hotelBadge } from '../lib/bookingBadge';
import { airlineBadge } from '../data/airlineBrand';
import { formatMoney } from '../lib/format';
import { shortProgramme } from '../lib/planFormat';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { StatusRing } from '../components/StatusRing';
import { Badge, SectionLabel } from '../components/ui';
import { SettingsIcon, MoonIcon, PlaneIcon, TagIcon, CardIcon, StarIcon, CheckIcon, AlertIcon } from '../components/Icons';

interface Todo {
  key: string;
  icon: ReactNode;
  title: string;
  sub: string;
  progressPct?: number;
  action?: { label: string; onClick: () => void };
  tag?: string;
  onOpen?: () => void;
  /** Ticks the to-do off by hand, for what the data can't see happen. */
  onDone?: () => void;
}

// Today: where you're sleeping tonight, what's next, what needs doing,
// and how close each status is.
export function Today() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { data: trips } = useTrips();
  const { data: hotels } = useAllHotels();
  const { data: promotions, isLive: promotionsLive } = usePromotions();
  const { data: rawProgrammes } = useLoyaltyProgrammes();
  const { data: reviews } = useReviews();
  const { data: vouchers } = useVouchers();
  const cardResults = useCardResults(today);
  const [done, setDone] = useState(readDoneTodos);

  // A registration ticked on this device before it was stored (or while
  // offline) is copied up, so other devices stop asking too.
  useEffect(() => {
    if (!promotionsLive) return;
    for (const id of registeredHere(done)) {
      if (promotions.some((p) => p.id === id && !p.registered)) setPromotionRegistered(id, true).catch(() => { /* tried again next visit */ });
    }
  }, [done, promotions, promotionsLive]);

  const tonight = tonightStay(trips, today);
  const underway = tonight?.trip ?? trips.find((t) => t.start <= today && today <= t.end) ?? null;
  const next = useMemo(() => nextUp(trips, today), [trips, today]);
  const programmes = withLiveOverrides(rawProgrammes, hotels, promotions);

  const flightGaps = useTripFlightGaps(trips, today);

  const todos: Todo[] = [];
  for (const r of promosToRegister(promotions, hotels, today)) {
    todos.push({
      key: `register-${r.promotion.id}`, icon: <TagIcon size={18} />,
      onDone: () => setDone(markTodoDone(`register-${r.promotion.id}`)),
      title: `Register for ${promoShortName(r.promotion)}`,
      sub: `+${r.points.toLocaleString()} pts · by ${dayMonthShort(r.deadline)}`,
      onOpen: r.promotion.brand ? () => navigate(`/status/${encodeURIComponent(r.promotion.brand!)}`) : undefined,
    });
  }
  for (const h of loyaltyHighlights({ programmes: rawProgrammes, hotels, promotions, cardResults, vouchers, today })) {
    todos.push({ key: h.key, icon: <CardIcon size={18} />, title: h.title, sub: h.subtitle, progressPct: h.progressPct, onOpen: () => navigate('/cards') });
  }
  for (const t of trips.filter((x) => flightGaps.has(x.id)).sort((a, b) => a.start.localeCompare(b.start))) {
    const sub = flightGaps.get(t.id)!;
    todos.push({
      key: `flights-${t.id}`, icon: <PlaneIcon size={18} />, title: t.title, sub,
      action: { label: 'Add', onClick: () => navigate('/log-flight', { state: { tripId: t.id, back: true } }) },
      onOpen: () => navigate(`/trips/${t.id}`),
    });
  }
  for (const h of findHotelsNeedingReview(trips, reviews, today).slice(0, 3)) {
    todos.push({
      key: `rate-${h.hotelId}`, icon: <StarIcon size={18} />, title: h.hotelName, sub: `Stayed ${dayMonthShort(h.date)}`,
      action: { label: 'Rate', onClick: () => navigate('/review-trip', { state: { hotel: h, back: true } }) },
    });
  }
  const shownTodos = todos.filter((t) => !done.has(t.key));

  // Status at a glance: tiers being worked toward first (closest first),
  // then ones reached, then any with nothing toward them yet.
  const statuses = programmes
    .filter((p) => p.category === 'hotel' && p.nextTier && p.nights != null)
    .map((p) => ({ p, progress: computeStatusProgress(p, hotels, promotions, cardResults) }))
    .filter((x) => x.progress.total > 0)
    .sort((a, b) => glanceRank(a.progress) - glanceRank(b.progress) || b.progress.currentNights / b.progress.total - a.progress.currentNights / a.progress.total)
    .slice(0, 4);

  return (
    <div className="today">
      <div className="topspace" />
      <div className="homehead">
        <div>
          <div className="eyebrowline">{weekdayShort(today)} {dayMonthShort(today)}</div>
          <h1 className="h1" style={{ margin: 0 }}>Today</h1>
        </div>
        <button className="iconbtn" aria-label="Settings" onClick={() => navigate('/settings')}><SettingsIcon size={20} /></button>
      </div>

      <div className="today-body">
        {tonight && (
          <button className="tonight" onClick={() => navigate(`/trips/${tonight.trip.id}`)}>
            <span className="tonight-photo">
              <DestinationPhoto query={tonight.hotel.city || tonight.trip.title} seed={tonight.hotel.id} height={150} />
              <span className="tonight-scrim" />
              <span className="tag light">Tonight</span>
            </span>
            <span className="tonight-body">
              <span className="tonight-row">
                <Badge {...hotelBadge(tonight.hotel, rawProgrammes)} size={44} />
                <span style={{ minWidth: 0 }}>
                  <span className="tonight-name">{tonight.hotel.name}</span>
                  <span className="rowsub"><Moons n={tonight.hotel.nights} />{[tonight.hotel.roomType, tonight.hotel.total != null ? formatMoney(tonight.hotel.total) : null].filter(Boolean).join(' · ') || `${tonight.hotel.nights} night${tonight.hotel.nights === 1 ? '' : 's'}`}</span>
                </span>
              </span>
              {underway && <TripProgress trip={underway} today={today} />}
            </span>
          </button>
        )}
        {!tonight && underway && (
          <button className="tonight" onClick={() => navigate(`/trips/${underway.id}`)}>
            <span className="tonight-body"><TripProgress trip={underway} today={today} /></span>
          </button>
        )}

        {next.length > 0 && (
          <section>
            <div className="sectionhead">
              <SectionLabel>Next</SectionLabel>
              <button className="linkbtn" onClick={() => navigate('/trips')}>All trips</button>
            </div>
            <div className="listcard">
              {next.map((item) => <div key={`${item.kind}-${item.date}-${'hotel' in item ? item.hotel.id : 'flight' in item ? item.flight.id : item.trip.id}`} style={{ display: 'contents' }}>{renderNext(item)}</div>)}
            </div>
          </section>
        )}

        {shownTodos.length > 0 && (
          <section>
            <div className="sectionhead"><SectionLabel>To do</SectionLabel></div>
            <div className="todos">
              {shownTodos.map((t) => (
                <div key={t.key} className="todo">
                  <button className="todo-main" onClick={t.onOpen} disabled={!t.onOpen}>
                    <span className="todo-icon" aria-hidden="true">{t.icon}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="rowtitle">{t.title}</span>
                      <span className="rowsub">{t.sub}</span>
                      {t.progressPct != null && <span className="bar" aria-hidden="true"><i style={{ width: `${t.progressPct}%` }} /></span>}
                    </span>
                  </button>
                  {t.action && <button className="tagbtn" onClick={t.action.onClick}>{t.action.label}</button>}
                  {t.onDone && (
                    <button className="iconbtn small" aria-label={`Done: ${t.title}`} onClick={t.onDone}>
                      <CheckIcon size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {statuses.length > 0 && (
          <section>
            <div className="sectionhead">
              <SectionLabel>Status</SectionLabel>
              <button className="linkbtn" onClick={() => navigate('/status')}>All</button>
            </div>
            <div className="statusglance">
              {statuses.map(({ p, progress }) => {
                const toGo = Math.max(0, progress.total - progress.currentNights);
                return (
                  <button key={p.name} className="statusglance-item" onClick={() => navigate(`/status/${encodeURIComponent(p.name)}`)}>
                    <StatusRing ticks={ringTicks(progress.total, nightSegments(progress.breakdown))} size={58} label={`${progress.currentNights} of ${progress.total} nights`}>
                      {toGo > 0 ? <span className="ringnum">{progress.currentNights}</span> : <CheckIcon size={18} strokeWidth={2.4} />}
                    </StatusRing>
                    <span className="statusglance-name">{shortProgramme(p.name)}</span>
                    <span className="statusglance-sub">{toGo > 0 ? `${toGo} to go` : progress.targetTier ?? p.nextTier}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {!tonight && !underway && next.length === 0 && shownTodos.length === 0 && (
          <button className="emptyrow" onClick={() => navigate('/trips')}>
            <AlertIcon size={18} color="var(--ink3)" /> Nothing booked yet
          </button>
        )}
      </div>
    </div>
  );

  function renderNext(item: NextItem) {
    const date = <DateCol date={item.date} last={item.kind === 'gap' && item.nights > 1 ? item.last : null} />;
    if (item.kind === 'stay') {
      return (
        <button className="nextrow" onClick={() => navigate(`/trips/${item.trip.id}`)}>
          {date}
          <Badge {...hotelBadge(item.hotel, rawProgrammes)} />
          <span className="nextrow-main">
            <span className="rowtitle">{item.hotel.name}</span>
            <span className="rowsub">{item.hotel.nights} night{item.hotel.nights === 1 ? '' : 's'}{item.hotel.total != null ? ` · ${formatMoney(item.hotel.total)}` : ''}{item.hotel.bookingChannel ? ` · ${item.hotel.bookingChannel}` : ''}</span>
          </span>
        </button>
      );
    }
    if (item.kind === 'flight') {
      const f = item.flight;
      return (
        <button className="nextrow" onClick={() => navigate(`/trips/${item.trip.id}`)}>
          {date}
          <Badge {...airlineBadge(f.flightNo, f.airline)} plane />
          <span className="nextrow-main">
            <span className="rowtitle">{f.flightNo ?? f.airline} · {f.from} → {f.to}</span>
            <span className="rowsub">{[f.departureTime, f.arrivalTime].filter(Boolean).join(' – ') || f.airline}</span>
          </span>
        </button>
      );
    }
    if (item.kind === 'gap') {
      return (
        <div className="nextrow">
          {date}
          <span className="badge-sq empty" aria-hidden="true" />
          <span className="nextrow-main"><span className="rowtitle quiet">No stay booked</span></span>
          <button className="linkbtn" onClick={() => navigate('/log-hotel', { state: { tripId: item.trip.id, back: true, prefill: { date: item.date, nights: item.nights } } })}>Add</button>
        </div>
      );
    }
    const t = item.trip;
    const first = [...t.flights].filter((f) => f.date).sort((a, b) => a.date!.localeCompare(b.date!))[0];
    const nights = tripNights(t);
    return (
      <button className="nextrow" onClick={() => navigate(`/trips/${t.id}`)}>
        {date}
        {first ? <Badge {...airlineBadge(first.flightNo, first.airline)} plane /> : t.hotels[0] ? <Badge {...hotelBadge(t.hotels[0], rawProgrammes)} /> : <span className="badge-sq empty" aria-hidden="true" />}
        <span className="nextrow-main">
          <span className="rowtitle display">{t.title}</span>
          <span className="rowsub">{[first ? `${first.flightNo ?? first.airline} · ${first.from}${first.departureTime ? ` ${first.departureTime}` : ''}` : null, nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="tag">{countdownLabel(today, t.start)}</span>
      </button>
    );
  }
}

function glanceRank(p: { currentNights: number; total: number; breakdown: { pending: number } }): number {
  if (p.currentNights >= p.total) return 1;
  return p.currentNights + p.breakdown.pending > 0 ? 0 : 2;
}

function DateCol({ date, last }: { date: string; last: string | null }) {
  return (
    <span className="datecol">
      <span className="datecol-wd">{weekdayShort(date)}</span>
      <span className={last ? 'datecol-d range' : 'datecol-d'}>{Number(date.slice(8, 10))}{last ? `–${Number(last.slice(8, 10))}` : ''}</span>
    </span>
  );
}

function Moons({ n }: { n: number }) {
  return <span className="moons" aria-hidden="true">{Array.from({ length: Math.min(n, 7) }, (_, k) => <MoonIcon key={k} size={12} />)}</span>;
}

function TripProgress({ trip, today }: { trip: Trip; today: string }) {
  const d = tripDayInfo(trip, today);
  return (
    <span className="tripprog">
      <span className="tripprog-row"><span>{trip.title}</span><span className="quiet">Day {d.dayIndex} of {d.totalDays}</span></span>
      <span className="bar ink" aria-hidden="true"><i style={{ width: `${(d.dayIndex / d.totalDays) * 100}%` }} /></span>
    </span>
  );
}
