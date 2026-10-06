import { useEffect, useState } from 'react';
import { useLoyaltyProgrammes, useHomeLocation, useCurrencyPreference } from '../lib/useLiveData';
import { setProgrammeTier, setHomeLocation, setCurrencyPreference } from '../lib/queries';
import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOL } from '../lib/currency';
import { BA_TIERS, QR_TIERS, QF_TIERS, KF_TIERS } from '../lib/creditingEngine';
import { loadWorldCities, type WorldCity } from '../data/worldCitiesLoader';
import { ScreenHeader } from '../components/ui';
import { SectionSwitch } from '../components/SectionSwitch';


const AIRLINE_PROGRAMMES = [
  { name: 'British Airways Executive Club', tiers: BA_TIERS },
  { name: 'Qatar Privilege Club', tiers: QR_TIERS },
  { name: 'Qantas Frequent Flyer', tiers: QF_TIERS },
  { name: 'KrisFlyer / PPS Club', tiers: KF_TIERS },
] as const;

export function Settings() {
  const { data: programmes, refetch } = useLoyaltyProgrammes();
  const { data: home, refetch: refetchHome } = useHomeLocation();
  const [saving, setSaving] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState(home.city);
  const [cities, setCities] = useState<WorldCity[]>([]);
  const [homeSaving, setHomeSaving] = useState(false);
  const [homeSaved, setHomeSaved] = useState(false);
  const { data: currency, refetch: refetchCurrency } = useCurrencyPreference();
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);

  async function onChangeCurrency(next: string) {
    setCurrencySaving(true);
    setCurrencySaved(false);
    try {
      await setCurrencyPreference(next);
      refetchCurrency();
      setCurrencySaved(true);
    } finally {
      setCurrencySaving(false);
    }
  }

  useEffect(() => { setCityInput(home.city); }, [home.city]);
  useEffect(() => { loadWorldCities().then(setCities); }, []);

  async function saveHome() {
    if (!cityInput.trim()) return;
    setHomeSaving(true);
    setHomeSaved(false);
    try {
      const match = cities.find((c) => c.name.toLowerCase() === cityInput.trim().toLowerCase());
      await setHomeLocation(match?.name ?? cityInput.trim(), match?.country ?? '');
      refetchHome();
      setHomeSaved(true);
    } finally {
      setHomeSaving(false);
    }
  }

  async function onChange(name: string, tier: string, category: 'airline') {
    setSaving(name);
    try {
      await setProgrammeTier(name, tier, category);
      refetch();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Settings"
        right={<SectionSwitch />}
      />

      <div style={{ padding: '4px 20px 24px' }}>
        <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink2)', marginBottom: 4 }}>
          Home location
        </div>
        <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
          Trips within a short domestic hop of here won't be flagged for missing flights.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            list="settings-cities"
            value={cityInput}
            onChange={(e) => { setCityInput(e.target.value); setHomeSaved(false); }}
            placeholder="e.g. London"
          />
          <datalist id="settings-cities">
            {/* Index in the key: the city list has same-named towns in one country (two Suzhous in China). */}
            {cities.slice(0, 500).map((c, i) => <option key={`${c.name}-${c.country}-${i}`} value={c.name} />)}
          </datalist>
          <button
            onClick={saveHome}
            disabled={homeSaving || !cityInput.trim() || cityInput.trim() === home.city}
            style={{
              padding: '0 18px', borderRadius: 'var(--r-control)', border: 'none', fontSize: 'var(--fs-body)', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              background: 'var(--brand)', color: 'var(--on-brand)', opacity: homeSaving || !cityInput.trim() || cityInput.trim() === home.city ? 0.5 : 1,
            }}
          >
            {homeSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {homeSaved && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--green)', fontWeight: 700, marginTop: 6 }}>Saved</div>}
      </div>

      <div style={{ padding: '4px 20px 24px', borderTop: '1px solid var(--line)' }}>
        <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink2)', marginBottom: 4, marginTop: 20 }}>
          Display currency
        </div>
        <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
          Prices researched in another currency (like Plan a trip's cash-vs-points figures) convert to this using live exchange rates.
        </p>
        <select
          className="input"
          value={currency}
          onChange={(e) => onChangeCurrency(e.target.value)}
          disabled={currencySaving}
        >
          {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c} ({CURRENCY_SYMBOL[c]})</option>)}
        </select>
        {currencySaved && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--green)', fontWeight: 700, marginTop: 6 }}>Saved</div>}
      </div>

      <div style={{ padding: '4px 20px 32px', borderTop: '1px solid var(--line)' }}>
        <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink2)', marginBottom: 4, marginTop: 20 }}>
          Airline elite status
        </div>
        <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink2)', lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
          Set once here and Where to Credit picks it up automatically. No need to enter it twice.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {AIRLINE_PROGRAMMES.map((p) => {
            const match = programmes.find((pr) => pr.name === p.name);
            const current = match?.tier && (p.tiers as readonly string[]).includes(match.tier) ? match.tier : p.tiers[0];
            return (
              <div key={p.name} style={{ border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{p.name}</div>
                <select
                  className="input"
                  value={current}
                  disabled={saving === p.name}
                  onChange={(e) => onChange(p.name, e.target.value, 'airline')}
                >
                  {p.tiers.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
