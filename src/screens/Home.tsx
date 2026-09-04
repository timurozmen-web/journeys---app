import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips, useAllHotels, useAllFlights, useLoyaltyProgrammes, usePromotions, usePaymentCards, useVouchers, useReviews } from '../lib/useLiveData';
import { computeCardResults } from '../lib/cardMath';
import { computeStatusProgress } from '../lib/statusProgress';
import { findHotelsNeedingReview } from '../lib/reviewScoring';
import { ChevronDownIcon, HotelIcon } from '../components/Icons';
import { getDestinationPhoto } from '../lib/unsplash';
import { destinationQuery } from '../components/TripCard';
import { HeroScene } from '../components/HeroScene';
import { withLiveOverrides } from '../lib/walletValue';
import { tripDayInfo } from '../lib/tripDay';

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
  const { data: hotels } = useAllHotels();
  const { data: flights } = useAllFlights();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: paymentCards } = usePaymentCards();
  const { data: vouchers } = useVouchers();
  const { data: reviews } = useReviews();
  const { data: promotions } = usePromotions();

  const cardResults = computeCardResults(hotels, flights, paymentCards, loyaltyProgrammes, TODAY);

  const currentTrip = trips.find((t) => t.section === 'current');
  const nextUpcomingTrip = trips
    .filter((t) => t.section === 'upcoming')
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const heroTrip = currentTrip ?? nextUpcomingTrip ?? null;
  const heroIsCurrent = heroTrip?.section === 'current';

  const effectiveProgrammes = withLiveOverrides(loyaltyProgrammes, hotels);
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
    .map((r) => ({ r, pct: Math.min(100, (r.autoSpend / r.nextMilestone!.m.spendRequired!) * 100) }))
    .sort((a, b) => b.pct - a.pct);
  for (const { r, pct } of cardsWithNextMilestone.slice(0, 2)) {
    const remaining = Math.max(0, r.nextMilestone!.m.spendRequired! - r.autoSpend);
    const programme = loyaltyProgrammes.find((p) => p.name === r.card.programmeBrand);
    const estValue = programme?.ptValue ? Math.round((r.nextMilestone!.m.rewardPoints * programme.ptValue) / 100) : null;
    actionItems.push({
      key: `card-milestone-${r.card.id}`, color: 'var(--brand)',
      title: `Spend £${Math.round(remaining).toLocaleString()} on the ${r.card.id}`,
      subtitle: `Turns into ${r.nextMilestone!.m.rewardLabel}${estValue ? ` — worth about £${estValue}` : ''}`,
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
    if (!r.cardRow || r.cardRow.closedDate || !r.yearWindow || r.card.annualFee <= 0) continue;
    const daysToRenewal = daysBetween(TODAY, r.yearWindow.end);
    if (daysToRenewal < 0 || daysToRenewal > 45) continue;
    const goodValue = r.net >= 0;
    actionItems.push({
      key: `renewal-${r.card.id}`, color: goodValue ? 'var(--green)' : 'var(--red)',
      title: `${r.card.id} renews in ${daysToRenewal} day${daysToRenewal === 1 ? '' : 's'}`,
      subtitle: goodValue
        ? `Worth keeping — £${Math.round(r.net)} ahead of the £${r.card.annualFee} fee this year`
        : `Consider cancelling — only £${Math.round(r.gross)} of value against a £${r.card.annualFee} fee this year`,
      onClick: () => navigate('/wallet'),
    });
  }

  // The hotel worth showing on the hero's bottom row: whichever stay is
  // actually happening right now for the current trip, or the first
  // stay chronologically for an upcoming one -- not just "first in list".
  const heroHotel = heroTrip
    ? heroIsCurrent
      ? heroTrip.hotels.find((h) => {
          const checkOut = new Date(new Date(h.date + 'T00:00:00').getTime() + h.nights * 86400000).toISOString().slice(0, 10);
          return h.date <= TODAY && TODAY < checkOut;
        }) ?? null
      : [...heroTrip.hotels].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    : null;

  const heroDayInfo = heroTrip && heroIsCurrent ? tripDayInfo(heroTrip, TODAY) : null;
  const heroDaysToGo = heroTrip && !heroIsCurrent ? Math.max(0, daysBetween(TODAY, heroTrip.start)) : 0;

  const programmeCount = effectiveProgrammes.filter((p) => p.points > 0).length;

  // Hero photo: real uploaded photo if the trip has one, otherwise the
  // same licensed Unsplash lookup Trips already uses (most specific
  // location first -- city + country beats country alone), so a Faro
  // stay resolves to Faro's own photo rather than a generic Portugal
  // one. No key configured, or no match: falls back to the same generated
  // scene Trips uses rather than a flat gradient.
  const [heroPhoto, setHeroPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!heroTrip) { setHeroPhoto(null); return; }
    if (heroTrip.heroImageUrl) { setHeroPhoto(heroTrip.heroImageUrl); return; }
    setHeroPhoto(null);
    let cancelled = false;
    getDestinationPhoto(destinationQuery(heroTrip)).then((p) => { if (!cancelled) setHeroPhoto(p?.url ?? null); });
    return () => { cancelled = true; };

  }, [heroTrip?.id, heroTrip?.heroImageUrl]);

  return (
    <div>
      <div style={{ background: 'var(--bg)', height: 'env(safe-area-inset-top, 0px)' }} />

      {/* Greeting lives inside the hero now, not a separate section --
          and the hero itself is the current trip, or if none, the next
          upcoming one. Oversized, photo-led: real trip photo if set,
          else the same licensed photo lookup Trips uses, else the
          shared generated scene -- never a fabricated or generic stock
          look. */}
      <div style={{ padding: '14px 20px 0' }}>
        {heroTrip ? (
          <button
            onClick={() => navigate(`/trips/${heroTrip.id}`)}
            style={{
              position: 'relative', display: 'block', width: '100%', height: 400, border: 0, padding: 0, borderRadius: 24,
              overflow: 'hidden', cursor: 'pointer', textAlign: 'left', font: 'inherit',
              background: '#101B44', boxShadow: '0 14px 32px rgba(16,27,68,.28)',
            }}
          >
            <span style={{ position: 'absolute', inset: 0 }}>
              {heroPhoto ? (
                <img src={heroPhoto} alt={heroTrip.title} style={{ width: '100%', height: 400, objectFit: 'cover', display: 'block' }} />
              ) : (
                <HeroScene seed={heroTrip.id} height={400} />
              )}
            </span>
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(16,27,68,.55) 0%,rgba(16,27,68,.05) 22%,rgba(16,27,68,.05) 45%,rgba(16,27,68,.55) 68%,rgba(16,27,68,.92) 100%)' }} />

            <span style={{ position: 'absolute', top: 16, left: 20, right: 60, color: '#fff' }}>
              <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.85 }}>{fmtFullDate(TODAY)}</span>
              <span style={{ display: 'block', fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', marginTop: 2 }}>Good {timeOfDay()}, Timur</span>
            </span>

            <span style={{ position: 'absolute', right: 16, top: 16, width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', display: 'grid', placeItems: 'center' }}>
              <ChevronDownIcon size={16} color="#fff" style={{ transform: 'rotate(-90deg)' }} />
            </span>

            <span style={{ position: 'absolute', left: 20, right: 20, bottom: 62, color: '#fff' }}>
              <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.1em', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 99, padding: '5px 11px', backdropFilter: 'blur(6px)', marginBottom: 12 }}>
                {heroIsCurrent ? `Current trip · Day ${heroDayInfo!.dayIndex} of ${heroDayInfo!.totalDays}` : `Upcoming · ${heroDaysToGo} day${heroDaysToGo === 1 ? '' : 's'} to go`}
              </span>
              <span style={{ display: 'block', fontSize: 34, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1.08 }}>{heroTrip.title}</span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, opacity: 0.9, marginTop: 6 }}>{fmtDate(heroTrip.start)} – {fmtDate(heroTrip.end)}</span>
            </span>

            {heroHotel && (
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', background: 'rgba(8,14,38,.55)', borderTop: '1px solid rgba(255,255,255,.15)', backdropFilter: 'blur(8px)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <HotelIcon size={16} color="#fff" />
                </span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {heroHotel.name}{!heroIsCurrent ? ' · first stay' : ''}
                </span>
              </span>
            )}
          </button>
        ) : (
          <div style={{ padding: '10px 2px 4px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink2)' }}>{fmtFullDate(TODAY)}</div>
            <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-.4px', color: 'var(--ink)', marginTop: 3 }}>Good {timeOfDay()}, Timur</div>
          </div>
        )}
      </div>


      {/* Wallet summary -- aggregate only; tap through for the per-programme breakdown */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => navigate('/wallet')}
          style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', font: 'inherit', border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 20, padding: '18px 18px', cursor: 'pointer' }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--brand)' }}>Travel wallet</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: 'var(--ink)', marginTop: 3 }}>£{Math.round(walletValue).toLocaleString()}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 3 }}>
              across {programmeCount} programme{programmeCount === 1 ? '' : 's'}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            <ChevronDownIcon size={20} color="var(--brand)" style={{ transform: 'rotate(-90deg)' }} />
          </span>
        </button>
      </div>

      {actionItems.length > 0 && (
        <div style={{ padding: '22px 20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--brand)' }}>Worth knowing</div>
          <div
            ref={actionScrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const cardWidth = el.children[0]?.getBoundingClientRect().width || 1;
              setActiveAction(Math.round(el.scrollLeft / cardWidth));
            }}
            style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', marginTop: 11, scrollbarWidth: 'none' }}
          >
            {actionItems.map((item) => (
              <button
                key={item.key}
                onClick={item.onClick}
                style={{
                  display: 'flex', alignItems: 'stretch', gap: 0, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16,
                  overflow: 'hidden', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left',
                  flex: '0 0 100%', width: '100%', scrollSnapAlign: 'start',
                }}
              >
                <span style={{ width: 5, background: item.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, padding: '13px 14px' }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800, letterSpacing: '-.2px' }}>{item.title}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink2)', marginTop: 3, fontWeight: 500 }}>{item.subtitle}</span>
                  {item.progressPct != null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
                      <span style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--card2)', overflow: 'hidden', display: 'block' }}>
                        <i style={{ display: 'block', height: '100%', width: `${item.progressPct}%`, background: item.color, borderRadius: 99 }} />
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: item.color }}>{Math.round(item.progressPct)}%</span>
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {actionItems.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
              {actionItems.map((item, i) => (
                <span
                  key={item.key}
                  style={{
                    width: i === activeAction ? 16 : 6, height: 6, borderRadius: 99,
                    background: i === activeAction ? 'var(--brand)' : 'var(--card2)', transition: 'width .2s ease, background .2s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
