import { useState } from 'react';
import { useTrips, useAllHotels, useAllFlights, useLoyaltyProgrammes, usePromotions, usePaymentCards } from '../lib/useLiveData';
import { computeStatusProgress } from '../lib/statusProgress';
import { computeCardResults } from '../lib/cardMath';
import { computeLoyaltyInsights } from '../lib/loyaltyInsights';
import { BedIcon, HotelIcon, PlaneIcon } from '../components/Icons';
import { TripCard } from '../components/TripCard';

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function yearOf(date: string | null) {
  return date ? Number(date.slice(0, 4)) : null;
}
function delta(n: number) {
  return n === 0 ? '±0 vs last year' : n > 0 ? `+${n} vs last year` : `${n} vs last year`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const TODAY = new Date().toISOString().slice(0, 10);
  const THIS_YEAR = new Date().getFullYear();
  const LAST_YEAR = THIS_YEAR - 1;
  const { data: trips, isLive } = useTrips();
  const { data: hotels } = useAllHotels();
  const { data: promotions } = usePromotions();
  const { data: flights } = useAllFlights();
  const { data: loyaltyProgrammes } = useLoyaltyProgrammes();
  const { data: paymentCards } = usePaymentCards();
  const cardResults = computeCardResults(hotels, flights, paymentCards, loyaltyProgrammes, TODAY);
  const insights = computeLoyaltyInsights(hotels, loyaltyProgrammes, THIS_YEAR);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  const currentTrip = trips.find((t) => t.section === 'current');
  const upcomingTrips = trips.filter((t) => t.section === 'upcoming').sort((a, b) => a.start.localeCompare(b.start));
  const nextLeisureTrip = upcomingTrips.find((t) => t.tripType === 'leisure');
  const nextWorkTrip = upcomingTrips.find((t) => t.tripType === 'work');

  // A stay only counts as done if the stored status says so AND the date
  // has actually passed — don't trust status alone, since a future-dated
  // row could be mislabelled.
  const isActuallyDone = (date: string, status: string) => status === 'Completed' && date <= TODAY;
  const completedHotels = hotels.filter((h) => isActuallyDone(h.date, h.status));
  const completedFlights = flights.filter((f) => f.date && isActuallyDone(f.date, f.status));
  const nightsThisYear = completedHotels.filter((h) => yearOf(h.date) === THIS_YEAR).reduce((s, h) => s + h.nights, 0);
  const nightsLastYear = completedHotels.filter((h) => yearOf(h.date) === LAST_YEAR).reduce((s, h) => s + h.nights, 0);
  const staysThisYear = completedHotels.filter((h) => yearOf(h.date) === THIS_YEAR).length;
  const staysLastYear = completedHotels.filter((h) => yearOf(h.date) === LAST_YEAR).length;
  const flightsThisYear = completedFlights.filter((f) => yearOf(f.date) === THIS_YEAR).length;
  const flightsLastYear = completedFlights.filter((f) => yearOf(f.date) === LAST_YEAR).length;

  const topProgress = loyaltyProgrammes
    .filter((p) => p.nextTier && p.nights != null && p.nightsNeeded != null && p.name !== 'Hilton Honors')
    .map((p) => ({ ...p, progress: computeStatusProgress(p, hotels, promotions, cardResults) }))
    .sort((a, b) => (b.progress.pct ?? 0) - (a.progress.pct ?? 0))
    .slice(0, 3);
  const [progressIndex, setProgressIndex] = useState(0);

  return (
    <div>
      <div className="head">
        <div className="h1">{greeting()}, Timur 👋</div>
        <div className="h-sub">
          Here's your travel snapshot {!isLive && <span style={{ opacity: 0.6 }}>· sample data</span>}
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="ic" style={{ background: 'rgba(19,34,71,.08)' }}>
            <BedIcon size={16} color="var(--brand)" />
          </div>
          <div className="lab">Nights</div>
          <div className="val">{nightsThisYear}</div>
          <div className="delta" style={{ color: nightsThisYear - nightsLastYear >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta(nightsThisYear - nightsLastYear)}
          </div>
        </div>
        <div className="tile">
          <div className="ic" style={{ background: 'rgba(12,122,66,.1)' }}>
            <HotelIcon size={16} color="var(--green)" />
          </div>
          <div className="lab">Stays</div>
          <div className="val">{staysThisYear}</div>
          <div className="delta" style={{ color: staysThisYear - staysLastYear >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta(staysThisYear - staysLastYear)}
          </div>
        </div>
        <div className="tile">
          <div className="ic" style={{ background: 'rgba(156,95,8,.1)' }}>
            <PlaneIcon size={16} color="var(--amber)" />
          </div>
          <div className="lab">Flights</div>
          <div className="val">{flightsThisYear}</div>
          <div className="delta" style={{ color: flightsThisYear - flightsLastYear >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta(flightsThisYear - flightsLastYear)}
          </div>
        </div>
      </div>

      {topProgress.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          <div
            ref={(el) => {
              if (!el || (el as any)._wired) return;
              (el as any)._wired = true;
              el.addEventListener('scroll', () => {
                const idx = Math.round(el.scrollLeft / el.clientWidth);
                setProgressIndex(idx);
              });
            }}
            style={{
              display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 0,
              scrollbarWidth: 'none', borderRadius: 'var(--r-lg)',
            }}
          >
            {topProgress.map((p) => (
              <div key={p.name} style={{ flex: '0 0 100%', scrollSnapAlign: 'start' }}>
                <div className="hero">
                  <div className="k">Loyalty progress</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="brand">{p.name}</div>
                      <div className="tier">{p.tier}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{Math.max(0, p.progress.total - p.progress.currentNights)}</div>
                      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        nights to<br />{p.nextTier}
                      </div>
                    </div>
                  </div>
                  <div className="hbar" style={{ marginTop: 12, position: 'relative' }}>
                    {p.progress.pendingPct != null && (
                      <i style={{ width: `${Math.max(0, Math.min(100, p.progress.pendingPct))}%`, background: 'rgba(255,193,90,.6)', position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                    )}
                    <i style={{ width: `${p.progress.pct ?? 0}%`, position: 'relative' }} />
                  </div>
                  <div className="note" style={{ color: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{p.progress.currentNights} / {p.progress.total} nights</span>
                    {(p.progress.bookedNights + p.progress.pendingNights) > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#FFC15A', background: 'rgba(255,193,90,.18)', padding: '1px 7px', borderRadius: 99 }}>
                        +{p.progress.bookedNights + p.progress.pendingNights} pending
                      </span>
                    )}
                  </div>
                  {p.progress.spendProgress && (
                    <>
                      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, marginTop: 8, color: '#fff' }}>
                        {p.progress.spendProgress.label}: {p.progress.spendProgress.currencySymbol ?? ''}
                        {Math.round(p.progress.spendProgress.currentAmount).toLocaleString()}
                        {p.progress.spendProgress.unit === 'points' ? ' pts' : ''}
                        {' / '}{p.progress.spendProgress.currencySymbol ?? ''}{Math.round(p.progress.spendProgress.requiredAmount).toLocaleString()}
                        {p.progress.spendProgress.unit === 'points' ? ' pts' : ''}
                      </div>
                      <div className="hbar" style={{ marginTop: 4 }}>
                        <i style={{ width: `${p.progress.spendProgress.pct}%` }} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {topProgress.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              {topProgress.map((p, i) => (
                <span
                  key={p.name}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: i === progressIndex ? 'var(--brand)' : 'var(--line)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {(insights.overall.totalValueReceived > 0 || insights.overall.totalSpend > 0) && (
        <>
          <div className="sect">
            <h2>Loyalty value this year</h2>
          </div>
          <div className="stack" style={{ display: 'grid', gap: 10 }}>
            <div className="chartwrap">
              <div className="big">£{Math.round(insights.overall.totalValueReceived).toLocaleString()}</div>
              <div className="lab">
                total value received
                {insights.overall.roiPercent != null && ` · ${insights.overall.roiPercent.toFixed(0)}% return on spend`}
              </div>
              <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                <Row label="Rate savings" value={insights.overall.rateSavings} />
                {insights.overall.benefitsByType.breakfast > 0 && <Row label="Free breakfast" value={insights.overall.benefitsByType.breakfast} />}
                {insights.overall.benefitsByType.upgrade > 0 && <Row label="Room upgrades" value={insights.overall.benefitsByType.upgrade} />}
                {insights.overall.benefitsByType.lounge > 0 && <Row label="Lounge access" value={insights.overall.benefitsByType.lounge} />}
                {insights.overall.benefitsByType.lateCheckout > 0 && <Row label="Late checkout" value={insights.overall.benefitsByType.lateCheckout} />}
                {insights.overall.benefitsByType.other > 0 && <Row label="Other benefits" value={insights.overall.benefitsByType.other} />}
                <Row label="Points earned (value)" value={insights.overall.pointsValue} />
                <div style={{ borderTop: '1px solid rgba(255,255,255,.15)', margin: '4px 0' }} />
                <Row label="Hotel spend this year" value={insights.overall.totalSpend} />
                <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>
                  Flight savings aren't tracked yet — this is hotels only. Log the benefit type when adding or editing a stay to build this out.
                </div>
              </div>
            </div>

            {insights.byBrand.length > 1 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {insights.byBrand.map((b) => {
                  const open = expandedBrand === b.brand;
                  return (
                    <div key={b.brand} style={{ borderRadius: 14, background: 'var(--card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedBrand(open ? null : b.brand)}
                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--ink)' }}
                      >
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{b.brand}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 1 }}>
                            {b.nights} nights · {b.roiPercent != null ? `${b.roiPercent.toFixed(0)}% return` : 'no spend logged'}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>£{Math.round(b.totalValueReceived).toLocaleString()}</div>
                      </button>
                      {open && (
                        <div style={{ padding: '0 14px 14px', display: 'grid', gap: 5 }}>
                          <DarkRow label="Spend" value={b.totalSpend} ink />
                          <DarkRow label="Rate savings" value={b.rateSavings} ink />
                          {b.totalBenefitsValue > 0 && <DarkRow label="Benefits" value={b.totalBenefitsValue} ink />}
                          <DarkRow label="Points value" value={b.pointsValue} ink />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {currentTrip && (
        <>
          <div className="sect">
            <h2>Under way</h2>
          </div>
          <div className="stack">
            <TripCard trip={currentTrip} />
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, padding: '0 4px' }}>
              Day {daysBetween(currentTrip.start, TODAY) + 1} of {daysBetween(currentTrip.start, currentTrip.end)}
            </div>
          </div>
        </>
      )}

      {nextLeisureTrip && (
        <>
          <div className="sect">
            <h2>Next leisure trip</h2>
          </div>
          <div className="stack">
            <TripCard trip={nextLeisureTrip} />
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, padding: '0 4px' }}>
              In {daysBetween(TODAY, nextLeisureTrip.start)} days
            </div>
          </div>
        </>
      )}

      {nextWorkTrip && (
        <>
          <div className="sect">
            <h2>Next work trip</h2>
          </div>
          <div className="stack">
            <TripCard trip={nextWorkTrip} />
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, padding: '0 4px' }}>
              In {daysBetween(TODAY, nextWorkTrip.start)} days
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
      <span style={{ color: 'var(--ink2)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>£{Math.round(value).toLocaleString()}</span>
    </div>
  );
}

function DarkRow({ label, value }: { label: string; value: number; ink?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--ink2)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>£{Math.round(value).toLocaleString()}</span>
    </div>
  );
}
