import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips, useAllHotels, useAllFlights, useLoyaltyProgrammes, usePromotions, usePaymentCards, useBankLinks, useVouchers, useReviews } from '../lib/useLiveData';
import { useCurrency } from '../lib/currency';
import { paceLine } from '../lib/spendPace';
import { computeCardResults } from '../lib/cardMath';
import { computeStatusProgress } from '../lib/statusProgress';
import { findHotelsNeedingReview } from '../lib/reviewScoring';
import { HotelIcon, PlaneIcon, AlertIcon } from '../components/Icons';
import { getDestinationPhoto } from '../lib/unsplash';
import { destinationQuery } from '../lib/tripHotels';
import { HeroScene } from '../components/HeroScene';
import { withLiveOverrides } from '../lib/walletValue';
import { tripDayInfo, addDays } from '../lib/tripDay';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { ARC, ARC_PATH, arcPoint, tripProgress } from '../lib/routeArc';
import { MAP } from '../data/mapTheme';
import { isTripIncomplete } from '../lib/tripCompleteness';
import { useFlightExemptTripIds } from '../lib/homeLocation';
import { PhotoHero } from '../components/ui';

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function fmtDate(iso: string) {
  const [, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d)} ${months[Number(m) - 1]}`;
}
function fmtDayName(iso: string) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(iso + 'T00:00:00').getDay()];
}
function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
function fmtFullDate(iso: string) {
  const [, m, d] = iso.split('-');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${fmtDayName(iso)} ${Number(d)} ${months[Number(m) - 1]}`;
}

interface ActionItem {
  key: string;
  color: string;
  title: string;
  subtitle: string;
  progressPct?: number;
  onClick: () => void;
}

export function Home() {
  const navigate = useNavigate();
  const [activeAction, setActiveAction] = useState(0);
  const actionScrollRef = useRef<HTMLDivElement>(null);
  const TODAY = new Date().toISOString().slice(0, 10);
  const { data: trips } = useTrips();
  const flightExemptTripIds = useFlightExemptTripIds(trips);
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: paymentCards } = usePaymentCards();
  const { data: vouchers } = useVouchers();
  const { data: reviews } = useReviews();
  const { data: promotions } = usePromotions();
  const { bankSpend } = useBankLinks();
  const { rates } = useCurrency();

  const cardResults = computeCardResults(hotels, flights, paymentCards, loyaltyProgrammes, TODAY, { bankSpend, rates })
    // Only cards you actually have a record for; the catalogue is bigger.
    .filter((r) => r.cardRow);

  const currentTrip = trips.find((t) => t.section === 'current');
  const nextUpcomingTrip = trips
    .filter((t) => t.section === 'upcoming')
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const heroTrip = currentTrip ?? nextUpcomingTrip ?? null;
  const heroIsCurrent = heroTrip?.section === 'current';

  const effectiveProgrammes = withLiveOverrides(loyaltyProgrammes, hotels, promotions);
  const walletValue = effectiveProgrammes.reduce((s, p) => s + (p.points ?? 0) * (p.ptValue ?? 0) / 100, 0);

  // Real "worth knowing" signals -- only ever shows what's genuinely
  // true right now, never invented placeholders. Four sources: elite
  // status milestones close at hand, the card closest to its next real
  // milestone, a completed stay still missing a review, and a voucher
  // genuinely expiring soon.
  const actionItems: ActionItem[] = [];

  const topProgress = loyaltyProgrammes
    .filter((p) => p.nextTier && p.nights != null && p.nightsNeeded != null)
    .map((p) => ({ ...p, progress: computeStatusProgress(p, hotels, promotions, cardResults) }))
    .filter((p) => p.progress.total > p.progress.currentNights)
    .sort((a, b) => (b.progress.pct ?? 0) - (a.progress.pct ?? 0))
    .slice(0, 3);
  for (const p of topProgress) {
    const remaining = p.progress.total - p.progress.currentNights;
    actionItems.push({
      key: `status-${p.name}`, color: 'var(--brand)',
      title: `${remaining} night${remaining === 1 ? '' : 's'} to ${p.progress.targetTier} with ${p.name}`,
      subtitle: `${p.progress.currentNights} of ${p.progress.total} nights logged${p.progress.bookedNights > 0 ? ` · ${p.progress.bookedNights} booked` : ''}`,
      progressPct: Math.max(0, Math.min(100, p.progress.pct ?? 0)),
      onClick: () => navigate('/wallet'),
    });
  }


  const cardsWithNextMilestone = cardResults
    .filter((r) => r.nextMilestone && r.nextMilestone.m.spendRequired)
    .map((r) => ({ r, pct: Math.min(100, (r.nextMilestone!.spend / r.nextMilestone!.m.spendRequired!) * 100) }))
    .sort((a, b) => b.pct - a.pct);
  for (const { r, pct } of cardsWithNextMilestone.slice(0, 2)) {
    const remaining = Math.max(0, r.nextMilestone!.m.spendRequired! - r.nextMilestone!.spend);
    const programme = loyaltyProgrammes.find((p) => p.name === r.card.programmeBrand);
    const estValue = programme?.ptValue ? Math.round((r.nextMilestone!.m.rewardPoints * programme.ptValue) / 100) : null;
    actionItems.push({
      key: `card-milestone-${r.card.id}`, color: 'var(--brand)',
      title: `Spend £${Math.round(remaining).toLocaleString()} on the ${r.card.id}`,
      // Spend counted here is the goal's own (a welcome bonus only counts
      // its window), and the pace line comes from real figures.
      subtitle: `Turns into ${r.nextMilestone!.m.rewardLabel}${estValue ? `, worth about £${estValue}` : ''}${r.nextMilestone!.pace && paceLine(r.nextMilestone!.pace) ? ` · ${paceLine(r.nextMilestone!.pace)}` : ''}`,
      progressPct: pct,
      onClick: () => navigate('/wallet'),
    });
  }

  const expiringVouchers = vouchers
    .filter((v) => !v.redeemed && v.expiryDate && v.expiryDate >= TODAY)
    .map((v) => ({ v, daysLeft: daysBetween(TODAY, v.expiryDate!) }))
    .filter((x) => x.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  for (const { v, daysLeft } of expiringVouchers.slice(0, 2)) {
    actionItems.push({
      key: `voucher-expiring-${v.id}`, color: 'var(--amber)',
      title: `${v.name} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      subtitle: v.value ? `Worth about £${Math.round(v.value)} · from ${v.source}` : `From ${v.source}`,
      onClick: () => navigate('/wallet'),
    });
  }

  const hotelsNeedingReview = findHotelsNeedingReview(trips, reviews, TODAY);
  const overallReviewCount = reviews.filter((r) => r.category === 'overall').length;
  hotelsNeedingReview.slice(0, 2).forEach((h, i) => {
    const nth = overallReviewCount + i + 1;
    actionItems.push({
      key: `needs-review-${h.hotelId}`, color: 'var(--green)',
      title: `Rate ${h.hotelName}`,
      subtitle: `Your ${nth}${ordinalSuffix(nth)} review · a few categories to score`,
      onClick: () => navigate('/trips'),
    });
  });

  // Card renewals coming up soon: real value-vs-fee assessment reused
  // from the already-verified card math, not a fresh estimate -- if the
  // card genuinely hasn't earned back its fee this card-year, say so
  // plainly rather than just flagging the date.
  for (const r of cardResults) {
    if (!r.cardRow || r.card.custom || r.cardRow.closedDate || !r.yearWindow || r.card.annualFee <= 0) continue;
    const daysToRenewal = daysBetween(TODAY, r.yearWindow.end);
    if (daysToRenewal < 0 || daysToRenewal > 45) continue;
    const goodValue = r.net >= 0;
    actionItems.push({
      key: `renewal-${r.card.id}`, color: goodValue ? 'var(--green)' : 'var(--red)',
      title: `${r.card.id} renews in ${daysToRenewal} day${daysToRenewal === 1 ? '' : 's'}`,
      subtitle: goodValue
        ? `Worth keeping: £${Math.round(r.net)} ahead of the £${r.card.annualFee} fee this year`
        : `Consider cancelling: only £${Math.round(r.gross)} of value against a £${r.card.annualFee} fee this year`,
      onClick: () => navigate('/wallet'),
    });
  }

  // The hotel worth showing on the hero's bottom row: whichever stay is
  // actually happening right now for the current trip, or the first
  // stay chronologically for an upcoming one -- not just "first in list".
  const heroHotel = heroTrip
    ? heroIsCurrent
      ? heroTrip.hotels.find((h) => {
          const checkOut = addDays(h.date, h.nights);
          return h.date <= TODAY && TODAY < checkOut;
        }) ?? null
      : [...heroTrip.hotels].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    : null;

  const heroDayInfo = heroTrip && heroIsCurrent ? tripDayInfo(heroTrip, TODAY) : null;
  const heroDaysToGo = heroTrip && !heroIsCurrent ? Math.max(0, daysBetween(TODAY, heroTrip.start)) : 0;

  // Next upcoming flight on the hero trip -- not yet departed. Shown as
  // the "upcoming activity" tile right below the trip hero.
  const nextFlight = heroTrip
    ? [...heroTrip.flights].filter((f) => f.date && f.date >= TODAY).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0] ?? null
    : null;

  const programmeCount = effectiveProgrammes.filter((p) => p.points > 0).length;

  // Hero photo: real uploaded photo if the trip has one, otherwise the
  // same licensed Unsplash lookup Trips already uses (most specific
  // location first -- city + country beats country alone), so a Faro
  // stay resolves to Faro's own photo rather than a generic Portugal
  // one. No key configured, or no match: falls back to the same generated
  // scene Trips uses rather than a flat gradient.
  // Keyed on plain strings rather than the heroTrip object itself, which
  // is rebuilt on every render and would re-run the lookup each time.
  const [heroPhoto, setHeroPhoto] = useState<string | null>(null);
  const heroImageUrl = heroTrip?.heroImageUrl ?? null;
  const heroQuery = heroTrip ? destinationQuery(heroTrip) : null;
  useEffect(() => {
    if (!heroQuery) { setHeroPhoto(null); return; }
    if (heroImageUrl) { setHeroPhoto(heroImageUrl); return; }
    setHeroPhoto(null);
    let cancelled = false;
    getDestinationPhoto(heroQuery).then((p) => { if (!cancelled) setHeroPhoto(p?.url ?? null); });
    return () => { cancelled = true; };
  }, [heroQuery, heroImageUrl]);

  // Route arc on the hero: first departure to final arrival, with a
  // marker at how far through the trip today is.
  const heroFlights = heroTrip ? [...heroTrip.flights].filter((f) => f.date).sort((x, y) => (x.date ?? '').localeCompare(y.date ?? '')) : [];
  const arcFrom = heroFlights[0]?.from ?? null;
  const arcTo = heroFlights.length > 0 ? heroFlights[heroFlights.length - 1].to : null;
  const heroNights = heroTrip ? (heroDayInfo?.totalDays ?? Math.max(1, daysBetween(heroTrip.start, heroTrip.end))) : 0;
  const heroMarker = arcPoint(tripProgress(heroDayInfo?.dayIndex ?? 0, heroNights, heroIsCurrent));

  // "What's next": the next trip after the hero one.
  const upcomingSorted = trips.filter((t) => t.section === 'upcoming').sort((x, y) => x.start.localeCompare(y.start));
  const nextTrip = heroIsCurrent ? upcomingSorted[0] ?? null : upcomingSorted[1] ?? null;
  const nextTripDays = nextTrip ? Math.max(0, daysBetween(TODAY, nextTrip.start)) : 0;

  return (
    <div>
      {heroTrip ? (
        <PhotoHero
          scrim="dissolve" height={560}
          src={heroPhoto} alt={heroTrip.title}
          fallback={<HeroScene seed={heroTrip.id} height={560} />}
          onClick={() => navigate(`/trips/${heroTrip.id}`)}
        >
          <span className="ph-top" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 22px)', left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <span className="nf-eyebrow" style={{ color: 'var(--on-dark2)' }}>{fmtFullDate(TODAY)}</span>
              <span style={{ display: 'block', fontSize: 'var(--fs-title)', fontWeight: 400, marginTop: 3 }}>Good {timeOfDay()}, Timur</span>
            </span>
          </span>

          <span className="ph-bottom" style={{ left: 24, right: 24, bottom: 18 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="ph-eyebrow">
                {heroIsCurrent ? `In progress · Day ${heroDayInfo!.dayIndex} of ${heroDayInfo!.totalDays}` : `Upcoming · ${heroDaysToGo} day${heroDaysToGo === 1 ? '' : 's'} to go`}
              </span>
              {isTripIncomplete(heroTrip) && !flightExemptTripIds.has(heroTrip.id) && (
                <span className="ph-eyebrow alert">
                  <AlertIcon size={12} color="var(--brand)" /> Trip incomplete
                </span>
              )}
            </span>
            <span className="ph-title" style={{ fontSize: 'var(--fs-jumbo)', fontWeight: 300, letterSpacing: '-2px', marginTop: 8 }}>{heroTrip.title}</span>

            <svg viewBox="0 0 342 54" width="100%" height="54" fill="none" aria-hidden="true" style={{ display: 'block', marginTop: 18 }}>
              <path d={ARC_PATH} stroke={MAP.route} strokeWidth="1.2" strokeDasharray="2 5" strokeLinecap="round" />
              <circle cx={ARC.x0} cy={ARC.y0} r="4" fill={MAP.route} />
              <circle cx={ARC.x1} cy={ARC.y1} r="4" fill="none" stroke={MAP.route} strokeWidth="1.4" />
              <circle cx={heroMarker.x} cy={heroMarker.y} r="3.5" fill={MAP.home} />
            </svg>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--fs-body)', color: 'var(--on-dark2)', marginTop: 4 }}>
              <span>{arcFrom && <strong style={{ color: 'var(--on-dark)', fontWeight: 600, letterSpacing: '.06em' }}>{arcFrom} </strong>}{fmtDate(heroTrip.start)}</span>
              <span>{heroNights} night{heroNights === 1 ? '' : 's'}{heroTrip.hotels.length > 0 ? ` · ${heroTrip.hotels.length} stay${heroTrip.hotels.length === 1 ? '' : 's'}` : ''}</span>
              <span>{fmtDate(heroTrip.end)}{arcTo && <strong style={{ color: 'var(--on-dark)', fontWeight: 600, letterSpacing: '.06em' }}> {arcTo}</strong>}</span>
            </span>
            {heroHotel && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 'var(--fs-small)', color: 'var(--on-dark2)' }}>
                <HotelIcon size={14} color="var(--brand)" />
                {heroIsCurrent ? 'Staying at ' : 'First stay: '}{heroHotel.name}
              </span>
            )}
          </span>
        </PhotoHero>
      ) : (
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 28px) 24px 4px' }}>
          <div className="nf-eyebrow" style={{ color: 'var(--ink2)' }}>{fmtFullDate(TODAY)}</div>
          <div style={{ fontSize: 'var(--fs-h1)', fontWeight: 300, color: 'var(--ink)', marginTop: 4 }}>Good {timeOfDay()}, Timur</div>
        </div>
      )}

      {/* Travel wallet -- aggregate only; tap through for the per-programme breakdown */}
      <div style={{ padding: '14px 16px 0' }}>
        <button className="glass" onClick={() => navigate('/wallet')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)' }}>
          <span>
            <span className="nf-eyebrow" style={{ color: 'var(--ink2)' }}>Travel wallet</span>
            <span style={{ display: 'block', fontSize: 'var(--fs-h1)', fontWeight: 300, letterSpacing: '-.6px', marginTop: 2 }}>£{Math.round(walletValue).toLocaleString()}</span>
          </span>
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--brand)' }}>{programmeCount} programme{programmeCount === 1 ? '' : 's'} →</span>
        </button>
      </div>

      {actionItems.length > 0 && (
        <div style={{ padding: '26px 16px 0' }}>
          <div className="nf-eyebrow" style={{ color: 'var(--ink2)', padding: '0 4px' }}>Worth knowing</div>
          <div
            ref={actionScrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const cardWidth = el.children[0]?.getBoundingClientRect().width || 1;
              setActiveAction(Math.round(el.scrollLeft / cardWidth));
            }}
            style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', marginTop: 10, scrollbarWidth: 'none' }}
          >
            {actionItems.map((item) => (
              <button
                key={item.key}
                className="glass"
                onClick={item.onClick}
                style={{ position: 'relative', overflow: 'hidden', padding: '15px 18px 17px', cursor: 'pointer', color: 'var(--ink)', textAlign: 'left', flex: '0 0 100%', width: '100%', scrollSnapAlign: 'start' }}
              >
                <span style={{ display: 'block', fontSize: 'var(--fs-body-lg)', fontWeight: 500 }}>{item.title}</span>
                <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--ink2)', marginTop: 3 }}>{item.subtitle}</span>
                {item.progressPct != null && (
                  <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,.08)' }}>
                    <i style={{ display: 'block', height: '100%', width: `${item.progressPct}%`, background: item.color }} />
                  </span>
                )}
              </button>
            ))}
          </div>
          {actionItems.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {actionItems.map((item, i) => (
                <span
                  key={item.key}
                  style={{ width: i === activeAction ? 16 : 5, height: 5, borderRadius: 'var(--r-pill)', background: i === activeAction ? 'var(--brand)' : 'var(--line)', transition: 'width .2s ease, background .2s ease' }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {(nextFlight || nextTrip) && (
        <div style={{ padding: '26px 16px 0', display: 'grid', gap: 10 }}>
          <div className="nf-eyebrow" style={{ color: 'var(--ink2)', padding: '0 4px' }}>What's next</div>

          {nextFlight && (
            <div className="glass" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="nf-eyebrow" style={{ color: 'var(--brand)' }}>{fmtDate(nextFlight.date!)} · {nextFlight.airline}{nextFlight.flightNo ? ` ${nextFlight.flightNo}` : ''}</span>
                {nextFlight.cost != null && <span style={{ fontSize: 'var(--fs-body)', color: 'var(--ink2)' }}>£{nextFlight.cost}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 'var(--fs-h1)', fontWeight: 300, letterSpacing: '.02em' }}>{nextFlight.from}</span>
                <span style={{ flex: 1, borderTop: `1.2px dashed ${MAP.route}`, opacity: 0.7 }} />
                <PlaneIcon size={16} color="var(--brand)" />
                <span style={{ flex: 1, borderTop: `1.2px dashed ${MAP.route}`, opacity: 0.7 }} />
                <span style={{ fontSize: 'var(--fs-h1)', fontWeight: 300, letterSpacing: '.02em' }}>{nextFlight.to}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-caption)', color: 'var(--ink2)', marginTop: 4 }}>
                <span>{nextFlight.departureTime ?? ''}</span>
                <span>{nextFlight.cabin}</span>
                <span>{nextFlight.arrivalTime ?? ''}</span>
              </div>
            </div>
          )}

          {nextTrip && (
            <PhotoHero
              scrim="none" height={72}
              style={{ borderRadius: 'var(--r-lg)' }}
              fallback={<DestinationPhoto query={destinationQuery(nextTrip)} seed={nextTrip.id} height={72} />}
              onClick={() => navigate(`/trips/${nextTrip.id}`)}
            >
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(11,13,18,.88) 0%, rgba(11,13,18,.3) 100%)' }} />
              <span style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 18, textShadow: 'none' }}>
                <span className="nf-eyebrow" style={{ color: 'var(--brand)' }}>Next trip · in {nextTripDays} day{nextTripDays === 1 ? '' : 's'}</span>
                <span style={{ fontSize: 'var(--fs-input)', fontWeight: 500, marginTop: 2 }}>{nextTrip.title}, {fmtDate(nextTrip.start)}</span>
              </span>
            </PhotoHero>
          )}
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
