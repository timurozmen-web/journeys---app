import { useNavigate } from 'react-router-dom';
import { useTrips, useAllHotels, useAllFlights, useLoyaltyProgrammes, usePromotions, usePaymentCards, useVouchers, useReviews } from '../lib/useLiveData';
import { computeStatusProgress } from '../lib/statusProgress';
import { computeCardResults } from '../lib/cardMath';
import { computeLoyaltyInsights } from '../lib/loyaltyInsights';
import { findGaps } from '../lib/tripStats';
import { findHotelsNeedingReview } from '../lib/reviewScoring';

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
  if (cardsWithNextMilestone.length > 0) {
    const { r, pct } = cardsWithNextMilestone[0];
    const remaining = Math.max(0, r.nextMilestone!.m.spendRequired! - r.autoSpend);
    const programme = loyaltyProgrammes.find((p) => p.name === r.card.programmeBrand);
    const estValue = programme?.ptValue ? Math.round((r.nextMilestone!.m.rewardPoints * programme.ptValue) / 100) : null;
    actionItems.push({
      key: 'card-milestone', color: 'var(--brand)',
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
  if (expiringVouchers.length > 0) {
    const { v, daysLeft } = expiringVouchers[0];
    actionItems.push({
      key: 'voucher-expiring', color: 'var(--amber)',
      title: `${v.name} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      subtitle: v.value ? `Worth about £${Math.round(v.value)} · from ${v.source}` : `From ${v.source}`,
      onClick: () => navigate('/wallet'),
    });
  }

  const hotelsNeedingReview = findHotelsNeedingReview(trips, reviews, TODAY);
  if (hotelsNeedingReview.length > 0) {
    const h = hotelsNeedingReview[0];
    actionItems.push({
      key: 'needs-review', color: 'var(--green)',
      title: `Rate ${h.hotelName}`,
      subtitle: `Your ${reviews.filter((r) => r.category === 'overall').length + 1}${ordinalSuffix(reviews.filter((r) => r.category === 'overall').length + 1)} review · a few categories to score`,
      onClick: () => navigate('/trips'),
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

  const sparklineHeights = [14, 22, 12, 30, 26, 38]; // relative shape only -- not enough monthly granularity tracked yet for a real trend line here

  return (
    <div>
      <div
        style={{
          background: 'linear-gradient(165deg,#4A3189 0%,#5B3FA6 45%,#7B5FC7 100%)',
          padding: 'max(24px, env(safe-area-inset-top, 24px)) 20px 22px', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>
              {fmtFullDate(TODAY)}
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.5px', marginTop: 3 }}>
              {currentTrip ? `Day ${daysBetween(currentTrip.start, TODAY) + 1} in ${currentTrip.title}` : 'Good to see you'}
            </div>
          </div>
          <div
            onClick={() => navigate('/profile')}
            style={{
              width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.24)',
              display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0, cursor: 'pointer',
            }}
          >
            T
          </div>
        </div>

        {topProgress.length > 0 && (
          <div style={{ display: 'grid', gap: 13, marginTop: 20 }}>
            {topProgress.map((p) => {
              const pct = Math.max(0, Math.min(100, p.progress.pct ?? 0));
              const pendingPct = p.progress.pendingPct != null ? Math.max(0, Math.min(100, p.progress.pendingPct)) : null;
              const valueLabel = `${p.progress.currentNights} / ${p.progress.total} nights`;
              const captionParts: string[] = [];
              if (p.progress.targetTier) {
                const remaining = p.progress.total - p.progress.currentNights;
                if (remaining > 0) captionParts.push(`${remaining} nights to ${p.progress.targetTier}`);
              }
              if (p.progress.bookedNights > 0) captionParts.push(`${p.progress.bookedNights} booked`);

              return (
                <div key={p.name}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>{p.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{valueLabel}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,.22)', marginTop: 6, overflow: 'hidden', position: 'relative' }}>
                    {pendingPct != null && (
                      <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pendingPct}%`, background: 'rgba(255,193,90,.6)', borderRadius: 99 }} />
                    )}
                    <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: '#fff', borderRadius: 99 }} />
                  </div>
                  {captionParts.length > 0 && (
                    <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.7, marginTop: 5 }}>{captionParts.join(' · ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.18)' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', opacity: 0.7 }}>Wallet value</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1.2px', marginTop: 1 }}>£{Math.round(walletValue).toLocaleString()}</div>
          </div>
          <button
            onClick={() => navigate('/wallet')}
            style={{ border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.14)', color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 99, cursor: 'pointer', flexShrink: 0 }}
          >
            Open wallet
          </button>
        </div>
      </div>

      {actionItems.length > 0 && (
        <div style={{ padding: '22px 20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--brand)' }}>Do this week</div>
          <div style={{ display: 'grid', gap: 9, marginTop: 11 }}>
            {actionItems.map((item) => (
              <button
                key={item.key}
                onClick={item.onClick}
                style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left' }}
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
        </div>
      )}

      {currentTrip && tripEvents.length > 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--brand)' }}>This trip</div>
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
                      boxShadow: ev.status === 'done' ? '0 0 0 2px rgba(91,63,166,.25)' : 'none',
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
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--green)', marginTop: 6 }}>
              {nightsThisYear - nightsLastYear >= 0 ? '+' : ''}{nightsThisYear - nightsLastYear} on {LAST_YEAR}
            </div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px' }}>{flightsThisYear}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', marginTop: 1 }}>flights</div>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px', gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px' }}>£{Math.round(insights.overall.loyaltyValue).toLocaleString()}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink2)', marginTop: 1 }}>
                loyalty value earned{insights.overall.roiPercent != null ? ` · ${insights.overall.roiPercent.toFixed(0)}% of spend` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
              {sparklineHeights.map((h, i) => (
                <span key={i} style={{ width: 8, height: h, borderRadius: 2, background: i >= sparklineHeights.length - 1 ? 'var(--brand)' : i >= sparklineHeights.length - 3 ? '#D8CEEC' : 'var(--card2)', display: 'block' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
