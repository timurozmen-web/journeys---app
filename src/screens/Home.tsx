import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips, useAllHotels, useAllFlights, useLoyaltyProgrammes, usePromotions, usePaymentCards, useVouchers, useReviews } from '../lib/useLiveData';
import { computeStatusProgress } from '../lib/statusProgress';
import { computeCardResults } from '../lib/cardMath';
import { findHotelsNeedingReview } from '../lib/reviewScoring';
import { ChevronDownIcon, HotelIcon } from '../components/Icons';
import { fetchDestinationPhoto, destinationQueries } from '../lib/destinationPhoto';

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
  const { data: promotions } = usePromotions();
  const { data: flights } = useAllFlights();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: paymentCards } = usePaymentCards();
  const { data: vouchers } = useVouchers();
  const { data: reviews } = useReviews();

  const cardResults = computeCardResults(hotels, flights, paymentCards, loyaltyProgrammes, TODAY);

  const currentTrip = trips.find((t) => t.section === 'current');

  const topProgress = loyaltyProgrammes
    .filter((p) => p.nextTier && p.nights != null && p.nightsNeeded != null)
    .map((p) => ({ ...p, progress: computeStatusProgress(p, hotels, promotions, cardResults) }))
    .sort((a, b) => (b.progress.pct ?? 0) - (a.progress.pct ?? 0))
    .slice(0, 3);

  const walletValue = loyaltyProgrammes.reduce((s, p) => s + (p.points ?? 0) * (p.ptValue ?? 0) / 100, 0);

  // Real "do this week" signals -- only ever shows what's genuinely true
  // right now, never invented placeholders. Three sources: the card
  // closest to its next real milestone, a completed stay still missing a
  // review, and a voucher genuinely expiring soon.
  const actionItems: ActionItem[] = [];

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

  // The hotel actually being stayed at right now, if any -- shown on the
  // hero's bottom row. Not just "first hotel in the trip".
  const currentHotel = currentTrip?.hotels.find((h) => {
    const checkOut = new Date(new Date(h.date + 'T00:00:00').getTime() + h.nights * 86400000).toISOString().slice(0, 10);
    return h.date <= TODAY && TODAY < checkOut;
  }) ?? null;

  const tripTotalDays = currentTrip ? daysBetween(currentTrip.start, currentTrip.end) + 1 : 0;
  const tripDayIndex = currentTrip ? Math.min(tripTotalDays, Math.max(1, daysBetween(currentTrip.start, TODAY) + 1)) : 0;

  const programmeCount = loyaltyProgrammes.filter((p) => p.points > 0).length;

  const tickerItems = topProgress
    .filter((p) => p.progress.total > p.progress.currentNights)
    .map((p) => ({
      key: p.name,
      text: `${p.progress.total - p.progress.currentNights} night${p.progress.total - p.progress.currentNights === 1 ? '' : 's'} to ${p.progress.targetTier} with ${p.name}`,
      pct: Math.max(0, Math.min(100, p.progress.pct ?? 0)),
    }));

  // Current-trip hero photo: real photo if the trip has one, otherwise
  // fetched by destination (most specific location first) from Wikipedia's
  // keyless, CORS-enabled API -- see lib/destinationPhoto.ts for the rule.
  const [heroPhoto, setHeroPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!currentTrip) { setHeroPhoto(null); return; }
    if (currentTrip.heroImageUrl) { setHeroPhoto(currentTrip.heroImageUrl); return; }
    setHeroPhoto(null);
    let cancelled = false;
    const queries = destinationQueries(currentTrip.title, currentHotel);
    fetchDestinationPhoto(queries).then((url) => { if (!cancelled) setHeroPhoto(url); });
    return () => { cancelled = true; };
  }, [currentTrip?.id, currentTrip?.heroImageUrl, currentHotel?.id]);

  return (
    <>
    <div>
      <div style={{ background: 'var(--bg)', height: 'env(safe-area-inset-top, 0px)' }} />

      {/* Welcome */}
      <div style={{ padding: '18px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink2)' }}>
            {fmtFullDate(TODAY)}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 600, letterSpacing: '-.3px', color: 'var(--ink)', marginTop: 3 }}>
            Good {timeOfDay()}, Timur
          </div>
        </div>
        <div
          onClick={() => navigate('/profile')}
          style={{
            width: 40, height: 40, borderRadius: 13, background: 'var(--brand)',
            display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0, cursor: 'pointer',
          }}
        >
          T
        </div>
      </div>

      {/* Current trip -- the key thing happening right now. Oversized,
          photo-led: real trip photo if set, else fetched by destination
          (see lib/destinationPhoto.ts), else a plain gradient -- never a
          fabricated or generic stock look. */}
      {currentTrip && (
        <div style={{ padding: '16px 20px 0' }}>
          <button
            onClick={() => navigate(`/trips/${currentTrip.id}`)}
            style={{
              position: 'relative', display: 'block', width: '100%', height: 340, border: 0, padding: 0, borderRadius: 24,
              overflow: 'hidden', cursor: 'pointer', textAlign: 'left', font: 'inherit',
              background: heroPhoto
                ? `url(${heroPhoto}) center/cover no-repeat`
                : 'linear-gradient(150deg,#101B44 0%,#1E3A8F 55%,#3E5FCB 100%)',
              boxShadow: '0 14px 32px rgba(16,27,68,.28)',
            }}
          >
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(16,27,68,.05) 0%,rgba(16,27,68,.05) 40%,rgba(16,27,68,.55) 68%,rgba(16,27,68,.92) 100%)' }} />
            <span style={{ position: 'absolute', top: 18, left: 18, fontSize: 10.5, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.1em', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 99, padding: '5px 11px', backdropFilter: 'blur(6px)' }}>
              Day {tripDayIndex} of {tripTotalDays}
            </span>
            <span style={{ position: 'absolute', right: 16, top: 16, width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', display: 'grid', placeItems: 'center' }}>
              <ChevronDownIcon size={16} color="#fff" style={{ transform: 'rotate(-90deg)' }} />
            </span>

            <span style={{ position: 'absolute', left: 20, right: 20, bottom: 62, color: '#fff' }}>
              <span style={{ display: 'block', fontSize: 34, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1.08 }}>{currentTrip.title}</span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, opacity: 0.9, marginTop: 6 }}>{fmtDate(currentTrip.start)} – {fmtDate(currentTrip.end)}</span>
            </span>

            {currentHotel && (
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', background: 'rgba(8,14,38,.55)', borderTop: '1px solid rgba(255,255,255,.15)', backdropFilter: 'blur(8px)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <HotelIcon size={16} color="#fff" />
                </span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentHotel.name}</span>
              </span>
            )}
          </button>
        </div>
      )}

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
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>See all</span>
        </button>
      </div>

      {actionItems.length > 0 && (
        <div style={{ padding: '22px 0 0' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--brand)', padding: '0 20px' }}>Do this week</div>
          <div
            ref={actionScrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const cardWidth = el.children[0]?.getBoundingClientRect().width || 1;
              setActiveAction(Math.round(el.scrollLeft / cardWidth));
            }}
            style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '11px 0 4px 20px', scrollbarWidth: 'none' }}
          >
            {actionItems.map((item) => (
              <button
                key={item.key}
                onClick={item.onClick}
                style={{
                  display: 'flex', alignItems: 'stretch', gap: 0, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16,
                  overflow: 'hidden', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left',
                  flex: `0 0 calc(100vw - 40px)`, maxWidth: 480, scrollSnapAlign: 'start', marginRight: 20,
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

      {/* Bottom breathing room so the fixed status ticker below never
          overlaps the last real section above it. */}
      <div style={{ height: tickerItems.length > 0 ? 64 : 12 }} />
    </div>

    {tickerItems.length > 0 && (
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', zIndex: 55,
          display: 'flex', overflowX: 'auto', gap: 10, padding: '0 20px', scrollbarWidth: 'none',
        }}
      >
        {tickerItems.map((t) => (
          <div
            key={t.key}
            style={{
              flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--brand)', color: '#fff', borderRadius: 99, padding: '8px 8px 8px 14px',
              boxShadow: '0 8px 20px rgba(16,27,68,.3)', maxWidth: 'calc(100vw - 40px)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.text}</span>
            <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(var(--gold2) ${t.pct}%, rgba(255,255,255,.25) 0)`, display: 'grid', placeItems: 'center' }}>
              <span style={{ width: 19, height: 19, borderRadius: '50%', background: 'var(--brand)', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800 }}>
                {Math.round(t.pct)}
              </span>
            </span>
          </div>
        ))}
      </div>
    )}
    </>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
