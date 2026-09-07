import { useState } from 'react';

// Real airline logos, sourced from a Wikimedia Commons brand pack --
// keyed by lowercased airline name (matches this app's stored `airline`
// field). Each entry has a 600px thumbnail and a 330px fallback (some
// Commons files render the larger size inconsistently); if both fail to
// load, falls through to the colour-coded initials badge below rather
// than showing a broken image. These are the airlines' own trademarks,
// shown purely for identification -- same footing as the hotel-brand
// logos already in Wallet.
const AIRLINE_LOGOS: Record<string, { primary: string; fallback: string }> = {
  'british airways': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/British_Airways.svg/600px-British_Airways.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/British_Airways.svg/330px-British_Airways.svg.png' },
  'virgin atlantic': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Virgin_Atlantic_logo_2018.svg/600px-Virgin_Atlantic_logo_2018.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Virgin_Atlantic_logo_2018.svg/330px-Virgin_Atlantic_logo_2018.svg.png' },
  'singapore airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Singapore_Airlines_Logo.svg/600px-Singapore_Airlines_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Singapore_Airlines_Logo.svg/330px-Singapore_Airlines_Logo.svg.png' },
  'qantas': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Qantas_Airways_Logo.svg/600px-Qantas_Airways_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Qantas_Airways_Logo.svg/330px-Qantas_Airways_Logo.svg.png' },
  'ryanair': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Ryanair_logo.svg/600px-Ryanair_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Ryanair_logo.svg/330px-Ryanair_logo.svg.png' },
  'easyjet': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/EasyJet_logo.svg/600px-EasyJet_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/EasyJet_logo.svg/330px-EasyJet_logo.svg.png' },
  'lufthansa': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Lufthansa_Logo.svg/600px-Lufthansa_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Lufthansa_Logo.svg/330px-Lufthansa_Logo.svg.png' },
  'qatar airways': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Qatar_Airways_logo.svg/600px-Qatar_Airways_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Qatar_Airways_logo.svg/330px-Qatar_Airways_logo.svg.png' },
  'cathay pacific': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Cathay_Pacific_Ltd._logo.svg/600px-Cathay_Pacific_Ltd._logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Cathay_Pacific_Ltd._logo.svg/330px-Cathay_Pacific_Ltd._logo.svg.png' },
  'etihad airways': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Etihad-airways-logo.svg/600px-Etihad-airways-logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Etihad-airways-logo.svg/330px-Etihad-airways-logo.svg.png' },
  'emirates': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Emirates_Logo.svg/600px-Emirates_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Emirates_Logo.svg/330px-Emirates_Logo.svg.png' },
  'turkish airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Turkish_Airlines_logo.svg/600px-Turkish_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Turkish_Airlines_logo.svg/330px-Turkish_Airlines_logo.svg.png' },
  'ita airways': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/ITA_Airways_Logo.svg/600px-ITA_Airways_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/ITA_Airways_Logo.svg/330px-ITA_Airways_Logo.svg.png' },
  'iberia': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Iberia_Logo.svg/600px-Iberia_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Iberia_Logo.svg/330px-Iberia_Logo.svg.png' },
  'wizz air': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Wizz_Air_logo_2015.svg/600px-Wizz_Air_logo_2015.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Wizz_Air_logo_2015.svg/330px-Wizz_Air_logo_2015.svg.png' },
  'japan airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Japan_Airlines_logo.svg/600px-Japan_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Japan_Airlines_logo.svg/330px-Japan_Airlines_logo.svg.png' },
  'ana': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/All_Nippon_Airways_Logo.svg/600px-All_Nippon_Airways_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/All_Nippon_Airways_Logo.svg/330px-All_Nippon_Airways_Logo.svg.png' },
  'air france': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Air_France_Logo.svg/600px-Air_France_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Air_France_Logo.svg/330px-Air_France_Logo.svg.png' },
  'delta air lines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Delta_logo.svg/600px-Delta_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Delta_logo.svg/330px-Delta_logo.svg.png' },
  'klm': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/KLM_logo.svg/600px-KLM_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/KLM_logo.svg/330px-KLM_logo.svg.png' },
  'united airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/United_Airlines_logo.svg/600px-United_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/United_Airlines_logo.svg/330px-United_Airlines_logo.svg.png' },
  'american airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/American_Airlines_logo.svg/600px-American_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/American_Airlines_logo.svg/330px-American_Airlines_logo.svg.png' },
  'latam airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/LATAM_Airlines_logo.svg/600px-LATAM_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/LATAM_Airlines_logo.svg/330px-LATAM_Airlines_logo.svg.png' },
  'norwegian': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Norwegian_Air_Shuttle_logo.svg/600px-Norwegian_Air_Shuttle_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Norwegian_Air_Shuttle_logo.svg/330px-Norwegian_Air_Shuttle_logo.svg.png' },
  'vueling': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Logo_Vueling.svg/600px-Logo_Vueling.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Logo_Vueling.svg/330px-Logo_Vueling.svg.png' },
  'royal jordanian': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Royal_Jordanian_logo.svg/600px-Royal_Jordanian_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Royal_Jordanian_logo.svg/330px-Royal_Jordanian_logo.svg.png' },
  'oman air': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Oman_Air_logo.svg/600px-Oman_Air_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Oman_Air_logo.svg/330px-Oman_Air_logo.svg.png' },
  'gulf air': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Gulf_Air_logo.svg/600px-Gulf_Air_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Gulf_Air_logo.svg/330px-Gulf_Air_logo.svg.png' },
  'air india': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Air_India_logo.svg/600px-Air_India_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Air_India_logo.svg/330px-Air_India_logo.svg.png' },
  'korean air': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Korean_Air_logo.svg/600px-Korean_Air_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Korean_Air_logo.svg/330px-Korean_Air_logo.svg.png' },
  'tap air portugal': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/TAP_Portugal_logo.svg/600px-TAP_Portugal_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/TAP_Portugal_logo.svg/330px-TAP_Portugal_logo.svg.png' },
  'aer lingus': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Aer_Lingus_logo.svg/600px-Aer_Lingus_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Aer_Lingus_logo.svg/330px-Aer_Lingus_logo.svg.png' },
  'norse atlantic': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Norse_Atlantic_Airways_logo.svg/600px-Norse_Atlantic_Airways_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Norse_Atlantic_Airways_logo.svg/330px-Norse_Atlantic_Airways_logo.svg.png' },
  'swiss': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Swiss_International_Air_Lines_logo.svg/600px-Swiss_International_Air_Lines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Swiss_International_Air_Lines_logo.svg/330px-Swiss_International_Air_Lines_logo.svg.png' },
  'air canada': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Air_Canada_logo.svg/600px-Air_Canada_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Air_Canada_logo.svg/330px-Air_Canada_logo.svg.png' },
  'air new zealand': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Air_New_Zealand_logo.svg/600px-Air_New_Zealand_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Air_New_Zealand_logo.svg/330px-Air_New_Zealand_logo.svg.png' },
  'sas': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/SAS_Scandinavian_Airlines_logo.svg/600px-SAS_Scandinavian_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/SAS_Scandinavian_Airlines_logo.svg/330px-SAS_Scandinavian_Airlines_logo.svg.png' },
  'finnair': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Finnair_logo.svg/600px-Finnair_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Finnair_logo.svg/330px-Finnair_logo.svg.png' },
  'avianca': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Avianca_logo.svg/600px-Avianca_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Avianca_logo.svg/330px-Avianca_logo.svg.png' },
  'indigo': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/IndiGo_logo.svg/600px-IndiGo_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/IndiGo_logo.svg/330px-IndiGo_logo.svg.png' },
  'ethiopian airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Ethiopian_Airlines_logo.svg/600px-Ethiopian_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Ethiopian_Airlines_logo.svg/330px-Ethiopian_Airlines_logo.svg.png' },
  'egyptair': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/EgyptAir_Logo.svg/600px-EgyptAir_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/EgyptAir_Logo.svg/330px-EgyptAir_Logo.svg.png' },
  'thai airways': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Thai_Airways_logo.svg/600px-Thai_Airways_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Thai_Airways_logo.svg/330px-Thai_Airways_logo.svg.png' },
  'malaysia airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Malaysia_Airlines_logo.svg/600px-Malaysia_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Malaysia_Airlines_logo.svg/330px-Malaysia_Airlines_logo.svg.png' },
  'air china': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Air_China_Logo.svg/600px-Air_China_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Air_China_Logo.svg/330px-Air_China_Logo.svg.png' },
  'china eastern': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/China_Eastern_Airlines_logo.svg/600px-China_Eastern_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/China_Eastern_Airlines_logo.svg/330px-China_Eastern_Airlines_logo.svg.png' },
  'china southern': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/China_Southern_Airlines_Logo.svg/600px-China_Southern_Airlines_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/China_Southern_Airlines_Logo.svg/330px-China_Southern_Airlines_Logo.svg.png' },
  'kenya airways': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Kenya_Airways_logo.svg/600px-Kenya_Airways_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Kenya_Airways_logo.svg/330px-Kenya_Airways_logo.svg.png' },
  'philippine airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Philippine_Airlines_logo.svg/600px-Philippine_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Philippine_Airlines_logo.svg/330px-Philippine_Airlines_logo.svg.png' },
  'royal air maroc': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Royal_Air_Maroc_logo.svg/600px-Royal_Air_Maroc_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Royal_Air_Maroc_logo.svg/330px-Royal_Air_Maroc_logo.svg.png' },
  'icelandair': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Icelandair_logo.svg/600px-Icelandair_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Icelandair_logo.svg/330px-Icelandair_logo.svg.png' },
  'alaska airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Alaska_Airlines_logo.svg/600px-Alaska_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Alaska_Airlines_logo.svg/330px-Alaska_Airlines_logo.svg.png' },
  'jetblue': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/JetBlue_Airways_Logo.svg/600px-JetBlue_Airways_Logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/JetBlue_Airways_Logo.svg/330px-JetBlue_Airways_Logo.svg.png' },
  'southwest airlines': { primary: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Southwest_Airlines_logo.svg/600px-Southwest_Airlines_logo.svg.png', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Southwest_Airlines_logo.svg/330px-Southwest_Airlines_logo.svg.png' },
};

// Name -> correct IATA code, for the fallback initials badge (and as a
// secondary lookup key for the logo table above, in case the stored
// airline name doesn't exactly match). Flight numbers sometimes use an
// ICAO-style prefix (e.g. "EZY8540") that isn't the real IATA code
// ("U2" for easyJet), so name matching is used ahead of prefix-parsing.
const AIRLINE_CODES: Record<string, string> = {
  'british airways': 'BA', 'virgin atlantic': 'VS', 'singapore airlines': 'SQ', qantas: 'QF',
  ryanair: 'FR', easyjet: 'U2', lufthansa: 'LH', 'qatar airways': 'QR', 'cathay pacific': 'CX',
  'etihad airways': 'EY', emirates: 'EK', 'turkish airlines': 'TK', 'ita airways': 'AZ', iberia: 'IB',
  'wizz air': 'W6', 'japan airlines': 'JL', ana: 'NH', 'air france': 'AF', 'delta air lines': 'DL',
  klm: 'KL', 'united airlines': 'UA', 'american airlines': 'AA', 'latam airlines': 'LA', norwegian: 'DY',
  vueling: 'VY', 'royal jordanian': 'RJ', 'oman air': 'WY', 'gulf air': 'GF', 'air india': 'AI',
  'korean air': 'KE', 'tap air portugal': 'TP', 'aer lingus': 'EI', 'norse atlantic': 'N0', swiss: 'LX',
  'air canada': 'AC', 'air new zealand': 'NZ', sas: 'SK', finnair: 'AY', avianca: 'AV', indigo: '6E',
  'ethiopian airlines': 'ET', egyptair: 'MS', 'thai airways': 'TG', 'malaysia airlines': 'MH',
  'air china': 'CA', 'china eastern': 'MU', 'china southern': 'CZ', 'kenya airways': 'KQ',
  'philippine airlines': 'PR', 'royal air maroc': 'AT', icelandair: 'FI', 'alaska airlines': 'AS',
  jetblue: 'B6', 'southwest airlines': 'WN',
};

// Real brand colours for the fallback badge, used only when there's no
// logo image for this airline (or it's not in the name-matched table).
const AIRLINE_COLORS: Record<string, string> = {
  BA: '#075AAA', U2: '#FF6600', IB: '#D7192D', VS: '#E10A0A', LH: '#05164D',
  QR: '#5C0632', EK: '#D71921', AF: '#002157', KL: '#00A1DE', DL: '#C8102E',
  UA: '#002244', AA: '#0078D2', TK: '#C70A0E', SQ: '#F99F1E', QF: '#E40000',
  AZ: '#009B48', FR: '#073590',
};

export function airlineCode(flightNo: string | null, airline: string): string {
  const byName = AIRLINE_CODES[airline.trim().toLowerCase()];
  if (byName) return byName;
  const fromNo = flightNo?.trim().split(/\s+/)[0]?.replace(/[0-9]/g, '').slice(0, 2);
  return (fromNo || airline.slice(0, 2)).toUpperCase();
}

// Three-tier fallback: real logo (600px) -> real logo (330px) -> plain
// colour-coded initials badge. A missing/broken image never breaks the
// layout, it just quietly steps down a tier.
export function AirlineLogo({ flightNo, airline, size = 28 }: { flightNo: string | null; airline: string; size?: number }) {
  const entry = AIRLINE_LOGOS[airline.trim().toLowerCase()];
  const [stage, setStage] = useState<'primary' | 'fallback' | 'badge'>(entry ? 'primary' : 'badge');

  if (stage === 'badge' || !entry) {
    const code = airlineCode(flightNo, airline);
    const bg = AIRLINE_COLORS[code] ?? 'var(--ink)';
    return (
      <span style={{ width: size, height: size, borderRadius: size * 0.3, background: bg, color: '#fff', fontSize: size * 0.36, fontWeight: 800, letterSpacing: '-.2px', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {code || '✈'}
      </span>
    );
  }

  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.3, background: '#fff', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden', padding: size * 0.12 }}>
      <img
        src={stage === 'primary' ? entry.primary : entry.fallback}
        alt={airline}
        onError={() => setStage((s) => (s === 'primary' ? 'fallback' : 'badge'))}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </span>
  );
}
