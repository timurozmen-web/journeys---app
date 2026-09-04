import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrips, useAllHotels, useAllFlights, useLoyaltyProgrammes, usePromotions, usePaymentCards, useVouchers, useReviews } from '../lib/useLiveData';
import { computeStatusProgress } from '../lib/statusProgress';
import { computeCardResults } from '../lib/cardMath';
import { computeLoyaltyInsights } from '../lib/loyaltyInsights';
import { BASE_POINTS_PER_GBP, TIER_BONUS } from '../lib/hotelPlanner';
import { findGaps } from '../lib/tripStats';
import { findHotelsNeedingReview } from '../lib/reviewScoring';
import { ChevronDownIcon } from '../components/Icons';

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function yearOf(date: string | null) {
  return date ? Number(date.slice(0, 4)) : null;
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
  const THIS_YEAR = new Date().getFullYear();
  const LAST_YEAR = THIS_YEAR - 1;
  const { data: trips } = useTrips();
  const { data: hotels } = useAllHotels();
  const { data: promotions } = usePromotions();
  const { data: flights } = useAllFlights();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: paymentCards } = usePaymentCards();
  const { data: vouchers } = useVouchers();
  const { data: reviews } = useReviews();

  const cardResults = computeCardResults(hotels, flights, paymentCards, loyaltyProgrammes, TODAY);
  const insights = computeLoyaltyInsights(hotels, loyaltyProgrammes, THIS_YEAR);

  const currentTrip = trips.find((t) => t.section === 'current');

  const completedHotels = hotels.filter((h) => h.status === 'Completed' && h.date <= TODAY);
  const completedFlights = flights.filter((f) => f.status === 'Completed' && f.date && f.date <= TODAY);
  const nightsThisYear = completedHotels.filter((h) => yearOf(h.date) === THIS_YEAR).reduce((s, h) => s + h.nights, 0);
  const nightsLastYear = completedHotels.filter((h) => yearOf(h.date) === LAST_YEAR).reduce((s, h) => s + h.nights, 0);
  const flightsThisYear = completedFlights.filter((f) => yearOf(f.date) === THIS_YEAR).length;
  const flightsLastYear = completedFlights.filter((f) => yearOf(f.date) === LAST_YEAR).length;

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

  // "This trip" chronological timeline -- real logged stays/flights plus
  // genuine gap detection, not a fabricated itinerary.
  const tripEvents: { title: string; detail: string; status: 'done' | 'gap' | 'upcoming' }[] = [];
  if (currentTrip) {
    for (const h of [...currentTrip.hotels].sort((a, b) => a.date.localeCompare(b.date))) {
      const checkOut = new Date(new Date(h.date + 'T00:00:00').getTime() + h.nights * 86400000).toISOString().slice(0, 10);
      const done = checkOut <= TODAY;
      tripEvents.push({
        title: `${h.name}${done ? ' · stayed' : ''}`,
        detail: `${fmtDate(h.date)} - ${fmtDate(checkOut)} · ${h.nights} night${h.nights === 1 ? '' : 's'}${h.total ? ` · £${h.total.toLocaleString()}` : ''}${done ? '' : ' booked'}`,
        status: done ? 'done' : 'upcoming',
      });
    }
    const gaps = findGaps(currentTrip);
    for (const g of gaps) {
      tripEvents.push({
        title: `${g.nights} night${g.nights === 1 ? '' : 's'} unaccounted`,
        detail: `${fmtDate(g.start)} - ${fmtDate(g.end)} · add a stay to keep the count honest`,
        status: 'gap',
      });
    }
    tripEvents.sort((a, b) => a.detail.localeCompare(b.detail));
  }

  // Real per-month loyalty value for the last 6 months, using the same
  // earning-rate calculation as everywhere else -- replaces what was
  // previously fake placeholder bar heights unrelated to any real data.
  const monthlyLoyaltyValue: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const monthKey = d.toISOString().slice(0, 7);
    let val = 0;
    for (const h of hotels) {
      if (h.status !== 'Completed' || h.award || !h.total || !h.date.startsWith(monthKey)) continue;
      const rate = BASE_POINTS_PER_GBP[h.brand];
      if (rate == null) continue;
      const programme = loyaltyProgrammes.find((p) => p.name === h.brand);
      const tier = programme?.tier ?? null;
      const bonus = (tier && TIER_BONUS[h.brand]?.[tier]) || 1;
      if (programme?.ptValue) val += (h.total * rate * bonus * programme.ptValue) / 100;
    }
    monthlyLoyaltyValue.push(val);
  }
  const maxMonthly = Math.max(1, ...monthlyLoyaltyValue);

  // Wallet summary strip -- real per-programme balances, highest value first.
  const walletProgrammes = [...loyaltyProgrammes]
    .filter((p) => p.points > 0)
    .sort((a, b) => (b.points * (b.ptValue ?? 0)) - (a.points * (a.ptValue ?? 0)));
  const hotelProgrammeCount = loyaltyProgrammes.filter((p) => p.category === 'hotel' && p.points > 0).length;
  const airlineProgrammeCount = loyaltyProgrammes.filter((p) => p.category === 'airline' && p.points > 0).length;

  const tripTotalDays = currentTrip ? daysBetween(currentTrip.start, currentTrip.end) + 1 : 0;
  const tripDayIndex = currentTrip ? Math.min(tripTotalDays, daysBetween(currentTrip.start, TODAY) + 1) : 0;

  const tickerItems = topProgress
    .filter((p) => p.progress.total > p.progress.currentNights)
    .map((p) => ({
      key: p.name,
      text: `${p.progress.total - p.progress.currentNights} night${p.progress.total - p.progress.currentNights === 1 ? '' : 's'} to ${p.progress.targetTier} with ${p.name}`,
      pct: Math.max(0, Math.min(100, p.progress.pct ?? 0)),
    }));

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

      {/* Current trip -- the key thing happening right now */}
      {currentTrip && (
        <div style={{ padding: '16px 20px 0' }}>
          <button
            onClick={() => navigate(`/trips/${currentTrip.id}`)}
            style={{
              position: 'relative', display: 'block', width: '100%', height: 220, border: 0, padding: 0, borderRadius: 22,
              overflow: 'hidden', cursor: 'pointer', textAlign: 'left', font: 'inherit',
              background: currentTrip.heroImageUrl
                ? `url(${currentTrip.heroImageUrl}) center/cover no-repeat`
                : 'linear-gradient(150deg,#101B44 0%,#1E3A8F 55%,#3E5FCB 100%)',
              boxShadow: '0 14px 32px rgba(16,27,68,.28)',
            }}
          >
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(16,27,68,0) 35%,rgba(16,27,68,.78) 100%)' }} />
            <span style={{ position: 'absolute', top: 16, left: 18, fontSize: 10.5, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '.1em', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 99, padding: '5px 11px' }}>
              Current trip · Day {tripDayIndex} of {tripTotalDays}
            </span>
            <span style={{ position: 'absolute', left: 20, right: 62, bottom: 18, color: '#fff' }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, letterSpacing: '-.3px', lineHeight: 1.15 }}>{currentTrip.title}</span>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, opacity: 0.88, marginTop: 5 }}>{fmtDate(currentTrip.start)} – {fmtDate(currentTrip.end)}</span>
            </span>
            <span style={{ position: 'absolute', right: 16, bottom: 16, width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', display: 'grid', placeItems: 'center' }}>
              <ChevronDownIcon size={16} color="#fff" style={{ transform: 'rotate(-90deg)' }} />
            </span>
          </button>
        </div>
      )}

      {/* Wallet summary */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => navigate('/wallet')}
          style={{ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 20, padding: '16px 18px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--brand)' }}>Travel wallet</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, letterSpacing: '-1px', color: 'var(--ink)', marginTop: 2 }}>£{Math.round(walletValue).toLocaleString()}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink2)', fontWeight: 600, marginTop: 2 }}>
                {hotelProgrammeCount + airlineProgrammeCount} programmes · {hotelProgrammeCount} hotel · {airlineProgrammeCount} airline
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>See all</span>
          </div>

          {walletProgrammes.length > 0 && (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginTop: 14, paddingBottom: 2, scrollbarWidth: 'none' }}>
              {walletProgrammes.map((p) => (
                <div key={p.name} style={{ flex: '0 0 auto', width: 76, textAlign: 'center' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: p.color || 'var(--card2)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto', fontSize: 13, fontWeight: 800 }}>
                    {p.abbr}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink)', marginTop: 5 }}>{p.points >= 1000 ? `${(p.points / 1000).toFixed(1)}k` : p.points}</div>
                  {p.tier && <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink2)', marginTop: 1 }}>{p.tier}</div>}
                </div>
              ))}
            </div>
          )}
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

      {currentTrip && tripEvents.length > 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--brand)' }}>Itinerary</div>
            <button onClick={() => navigate(`/trips/${currentTrip.id}`)} style={{ border: 0, background: 'none', font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--brand)', cursor: 'pointer', padding: 0 }}>
              Open
            </button>
          </div>
          <div style={{ marginTop: 12, paddingLeft: 6 }}>
            {tripEvents.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <span
                    style={{
                      width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
                      background: ev.status === 'done' ? 'var(--brand)' : ev.status === 'gap' ? 'var(--amber)' : '#fff',
                      border: ev.status === 'upcoming' ? '2px solid #C6C9D6' : '2px solid var(--bg)',
                      boxShadow: ev.status === 'done' ? '0 0 0 2px rgba(30,58,143,.25)' : 'none',
                    }}
                  />
                  {i < tripEvents.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--line)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: 16 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: ev.status === 'gap' ? 'var(--amber)' : 'var(--ink)' }}>{ev.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink2)', fontWeight: 500, marginTop: 2 }}>{ev.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '24px 20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--brand)' }}>{THIS_YEAR} so far</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 11 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color: 'var(--ink)' }}>{nightsThisYear}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', marginTop: 1 }}>nights away</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: nightsThisYear - nightsLastYear >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>
              {nightsThisYear - nightsLastYear >= 0 ? '▲' : '▼'} {Math.abs(nightsThisYear - nightsLastYear)} on {LAST_YEAR}
            </div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px' }}>{flightsThisYear}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', marginTop: 1 }}>flights</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: flightsThisYear - flightsLastYear >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>
              {flightsThisYear - flightsLastYear >= 0 ? '▲' : '▼'} {Math.abs(flightsThisYear - flightsLastYear)} on {LAST_YEAR}
            </div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px', gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px' }}>£{Math.round(insights.overall.loyaltyValue).toLocaleString()}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', marginTop: 1 }}>
                loyalty value earned{insights.overall.roiPercent != null ? ` · ${insights.overall.roiPercent.toFixed(0)}% of spend` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, flexShrink: 0 }} title="Loyalty value earned per month, last 6 months">
              {monthlyLoyaltyValue.map((v, i) => (
                <span
                  key={i}
                  style={{
                    width: 8, height: Math.max(3, Math.round((v / maxMonthly) * 38)), borderRadius: 2, display: 'block',
                    background: i === monthlyLoyaltyValue.length - 1 ? 'var(--brand)' : i >= monthlyLoyaltyValue.length - 3 ? '#C9D3F2' : 'var(--card2)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
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
