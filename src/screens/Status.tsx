import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllHotels, useLoyaltyProgrammes, usePromotions, useVouchers } from '../lib/useLiveData';
import { useCardResults } from '../lib/useCardResults';
import { computeStatusProgress, type StatusProgress } from '../lib/statusProgress';
import { nightSegments, ringTicks } from '../lib/statusRing';
import { withLiveOverrides } from '../lib/walletValue';
import { computeWalletValueChange } from '../lib/hotelPlanner';
import { deleteLoyaltyProgramme } from '../lib/queries';
import { StatusRing } from '../components/StatusRing';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { ErrorText, SectionLabel } from '../components/ui';
import { CheckIcon, ChevronRightIcon, PlusIcon, TagIcon } from '../components/Icons';
import type { LoyaltyProgramme } from '../types';

function statusRank(p: StatusProgress | null): number {
  if (!p || p.total <= 0) return 3;
  if (p.currentNights >= p.total) return 1;
  return p.currentNights + p.breakdown.pending > 0 ? 0 : 2;
}
const ratio = (p: StatusProgress | null) => (p && p.total > 0 ? p.currentNights / p.total : 0);

const LEGEND = [
  { label: 'Stays', colour: 'var(--ink)' },
  { label: 'Cards', colour: 'var(--brand2)' },
  { label: 'Member', colour: 'var(--member)' },
  { label: 'Promo', colour: 'var(--promo)' },
  { label: 'To come', colour: 'var(--pending)' },
];

// Status: what everything is worth, then every programme on one list,
// hotels with their ring toward the next tier, airlines with their
// balance. Each opens its own page.
export function Status() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rawProgrammes, refetch } = useLoyaltyProgrammes();
  const { data: hotels } = useAllHotels();
  const { data: promotions } = usePromotions();
  const { data: vouchers } = useVouchers();
  const cardResults = useCardResults(today);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const programmes = withLiveOverrides(rawProgrammes, hotels, promotions).filter((p) => !removed.has(p.name));
  const value = programmes.reduce((s, p) => s + (p.points * p.ptValue) / 100, 0);
  const change = computeWalletValueChange(hotels, programmes, vouchers, today);
  const progressOf = (p: LoyaltyProgramme) =>
    p.category === 'hotel' && p.nextTier && p.nights != null ? computeStatusProgress(p, hotels, promotions, cardResults) : null;
  // Tiers being worked toward first (closest first), then ones reached,
  // then programmes with nothing toward a tier yet.
  const hotelProgs = programmes
    .filter((p) => p.category === 'hotel')
    .map((p) => ({ p, progress: progressOf(p) }))
    .sort((a, b) => statusRank(a.progress) - statusRank(b.progress) || ratio(b.progress) - ratio(a.progress));
  const airlineProgs = programmes.filter((p) => p.category === 'airline').map((p) => ({ p, progress: null }));

  // Swipe left and tap Delete.
  async function remove(name: string) {
    setError('');
    try {
      await deleteLoyaltyProgramme(name);
      setRemoved((r) => new Set(r).add(name));
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete it.');
    }
  }

  const open = (p: LoyaltyProgramme) => navigate(`/status/${encodeURIComponent(p.name)}`);
  const money = (p: LoyaltyProgramme) => `≈ £${Math.round((p.points * p.ptValue) / 100).toLocaleString()}`;

  function renderRow({ p, progress }: { p: LoyaltyProgramme; progress: StatusProgress | null }) {
    const toGo = progress ? Math.max(0, progress.total - progress.currentNights) : 0;
    const target = progress?.targetTier ?? p.nextTier;
    const reached = !!progress && progress.total > 0 && toGo === 0;
    // Once the nights for the next tier are in, that's the tier shown.
    const tier = reached ? target : progress?.effectiveTier ?? p.tier;
    const sub = progress && progress.total > 0
      ? toGo > 0
        ? `${target} · ${toGo} to go${progress.breakdown.pending > 0 ? ` · ${progress.breakdown.pending} to come` : ''}`
        : `${target} reached`
      : null;
    return (
      <SwipeToDelete key={p.name} itemLabel={p.name} surface="var(--card)" wrapperStyle={{ borderRadius: 0 }} onClick={() => open(p)} onDelete={() => remove(p.name)}>
        <div className="progrow">
          {progress && progress.total > 0 ? (
            <StatusRing ticks={ringTicks(progress.total, nightSegments(progress.breakdown))} size={56} label={`${progress.currentNights} of ${progress.total} nights`}>
              {toGo > 0 ? <span className="ringnum">{progress.currentNights}</span> : <CheckIcon size={18} strokeWidth={2.4} />}
            </StatusRing>
          ) : (
            <span className="progrow-badge"><span className="badge-sq" style={{ background: p.color || 'var(--ink)' }}>{p.abbr}</span></span>
          )}
          <span className="progrow-main">
            <span className="progrow-name">
              <span className="rowtitle display">{p.name}</span>
              {tier && <span className={reached ? 'tag solid' : 'tag'}>{tier.replace(/ Elite$/, '')}</span>}
            </span>
            {sub && <span className="rowsub">{sub}</span>}
          </span>
          <span className="progrow-pts">
            <span className="figure">{p.points.toLocaleString()}</span>
            <span className="rowsub">{p.ptValue ? money(p) : 'pts'}</span>
          </span>
        </div>
      </SwipeToDelete>
    );
  }

  return (
    <div>
      <div className="topspace" />
      <div className="homehead">
        <div>
          <div className="eyebrowline">{today.slice(0, 4)}</div>
          <h1 className="h1" style={{ margin: 0 }}>Status</h1>
        </div>
        <button className="iconbtn" aria-label="Add a programme" onClick={() => navigate('/log-loyalty-programme')}><PlusIcon size={20} /></button>
      </div>

      <div className="page-body">
        <div className="valuecard">
          <SectionLabel>Wallet value</SectionLabel>
          <span className="valuecard-big">£{Math.round(value).toLocaleString()}</span>
          {change.hasData && (
            <span className={change.deltaValue >= 0 ? 'valuecard-delta up' : 'valuecard-delta down'}>
              {change.deltaValue >= 0 ? '▲' : '▼'} £{Math.round(Math.abs(change.deltaValue)).toLocaleString()} on last month
            </span>
          )}
        </div>
        {error && <ErrorText>{error}</ErrorText>}

        {hotelProgs.length > 0 && (
          <section>
            <div className="sectionhead">
              <SectionLabel>Hotels</SectionLabel>
              <span className="ringkey" aria-hidden="true">
                {LEGEND.map((l) => <span key={l.label}><i style={{ background: l.colour }} />{l.label}</span>)}
              </span>
            </div>
            <div className="listcard">{hotelProgs.map(renderRow)}</div>
          </section>
        )}

        {airlineProgs.length > 0 && (
          <section>
            <SectionLabel>Airlines</SectionLabel>
            <div className="listcard">{airlineProgs.map(renderRow)}</div>
          </section>
        )}

        <button className="linkrow" onClick={() => navigate('/promotions')}>
          <TagIcon size={20} color="var(--brand)" />
          <span className="rowtitle">Promotions</span>
          <ChevronRightIcon size={18} color="var(--ink3)" />
        </button>
      </div>
    </div>
  );
}
