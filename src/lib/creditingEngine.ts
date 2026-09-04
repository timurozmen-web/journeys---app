// "Where To Credit" engine, lean build — British Airways Executive Club,
// Qatar Privilege Club, Qantas Frequent Flyer, KrisFlyer/PPS Club only.
// Ported from the airlines/ reference docs (crediting-mechanics, and each
// programme's own -earning-model.md). More programmes get added in groups
// later — see airlines/_app-prototype.md for the full 53-programme scope
// this is a deliberate subset of.
//
// Grammar this follows (crediting-mechanics.md):
//   - every programme-carrier pair is own metal / partner / none
//   - operating carrier decides which cabins & fare classes exist
//   - status and redeemable currencies are computed independently
// Where the source docs give an exact published table, it's used exactly.
// Where they only give distance-banded region charts too large to port on
// a lean budget, a simplified distance-only ladder is used instead and the
// result is flagged `estimated: true` with a short note — never silently.

export type Cabin = 'Economy' | 'Premium Economy' | 'Business' | 'First';
export type FareLevel = 'lowest' | 'standard' | 'flex';
export type ProgramId = 'BA' | 'QR' | 'QF' | 'KF';
export type Alliance = 'oneworld' | 'star' | 'other';

export interface CarrierDef {
  code: string;
  name: string;
  alliance: Alliance;
}

// Carriers relevant to BA/Qatar/Qantas (oneworld) and KrisFlyer (Star).
// Not the full 53-programme carrier list — just enough to route these four.
export const CARRIERS: CarrierDef[] = [
  { code: 'BA', name: 'British Airways', alliance: 'oneworld' },
  { code: 'QR', name: 'Qatar Airways', alliance: 'oneworld' },
  { code: 'QF', name: 'Qantas', alliance: 'oneworld' },
  { code: 'AA', name: 'American Airlines', alliance: 'oneworld' },
  { code: 'IB', name: 'Iberia', alliance: 'oneworld' },
  { code: 'CX', name: 'Cathay Pacific', alliance: 'oneworld' },
  { code: 'JL', name: 'Japan Airlines', alliance: 'oneworld' },
  { code: 'MH', name: 'Malaysia Airlines', alliance: 'oneworld' },
  { code: 'AY', name: 'Finnair', alliance: 'oneworld' },
  { code: 'AS', name: 'Alaska Airlines', alliance: 'oneworld' },
  { code: 'RJ', name: 'Royal Jordanian', alliance: 'oneworld' },
  { code: 'UL', name: 'SriLankan Airlines', alliance: 'oneworld' },
  { code: 'AT', name: 'Royal Air Maroc', alliance: 'oneworld' },
  { code: 'FJ', name: 'Fiji Airways', alliance: 'oneworld' },
  { code: 'WY', name: 'Oman Air', alliance: 'oneworld' },
  { code: 'SQ', name: 'Singapore Airlines', alliance: 'star' },
  { code: 'LH', name: 'Lufthansa', alliance: 'star' },
  { code: 'LX', name: 'SWISS', alliance: 'star' },
  { code: 'OS', name: 'Austrian Airlines', alliance: 'star' },
  { code: 'SN', name: 'Brussels Airlines', alliance: 'star' },
  { code: 'UA', name: 'United Airlines', alliance: 'star' },
  { code: 'AC', name: 'Air Canada', alliance: 'star' },
  { code: 'NH', name: 'ANA', alliance: 'star' },
  { code: 'TG', name: 'Thai Airways', alliance: 'star' },
  { code: 'TK', name: 'Turkish Airlines', alliance: 'star' },
  { code: 'AI', name: 'Air India', alliance: 'star' },
  { code: 'BR', name: 'EVA Air', alliance: 'star' },
  { code: 'OZ', name: 'Asiana Airlines', alliance: 'star' },
  { code: 'NZ', name: 'Air New Zealand', alliance: 'star' },
  { code: 'VA', name: 'Virgin Australia', alliance: 'star' },
  { code: 'OU', name: 'Croatia Airlines', alliance: 'star' },
  { code: 'CM', name: 'Copa Airlines', alliance: 'star' },
  { code: 'OTHER', name: 'Other / not listed', alliance: 'other' },
];

export function carrierName(code: string): string {
  return CARRIERS.find((c) => c.code === code)?.name ?? code;
}

// Advisory only: lets someone who knows their booking letter get a fare-level
// suggestion rather than guessing "lowest / standard / flex" blind. Generic
// industry convention, not carrier-specific — the actual calculation always
// runs off the fare-level the person confirms, never the raw letter.
const LETTER_LEVEL: Record<Cabin, Record<string, FareLevel>> = {
  Economy: {
    Y: 'flex', B: 'flex', H: 'standard', K: 'standard', M: 'standard',
    L: 'lowest', Q: 'lowest', N: 'lowest', O: 'lowest', S: 'standard',
    V: 'lowest', W: 'lowest', G: 'lowest', T: 'lowest', U: 'lowest', E: 'lowest',
  },
  'Premium Economy': { W: 'flex', S: 'flex', T: 'flex', A: 'standard', R: 'standard', P: 'lowest', L: 'lowest' },
  Business: { J: 'flex', C: 'flex', Z: 'flex', D: 'standard', I: 'standard', R: 'standard', P: 'lowest' },
  First: { F: 'flex', A: 'standard', P: 'lowest' },
};

export function suggestFareLevel(cabin: Cabin, letter: string): FareLevel | null {
  const l = letter.trim().toUpperCase().slice(0, 1);
  if (!l) return null;
  return LETTER_LEVEL[cabin][l] ?? null;
}

export interface CreditInput {
  operatingCarrier: string; // CARRIERS code
  cabin: Cabin;
  fareLevel: FareLevel;
  price?: number; // GBP, optional
  distanceMiles: number;
  ukDeparture: boolean; // for BA's APD-exclusion banding
  tiers: Partial<Record<ProgramId, string>>; // elite tier held per programme
}

export interface ProgramResult {
  program: ProgramId;
  name: string;
  relationship: 'own' | 'partner' | 'none';
  redeemable: { name: string; amount: number } | null; // Avios / Qantas Points / KrisFlyer miles
  status: { name: string; amount: number } | null; // Tier Points / Qpoints / Status Credits / Elite miles
  estimated: boolean;
  notes: string[];
}

// ---------- shared helpers ----------

function relOneworld(carrier: string, own: string): 'own' | 'partner' | 'none' {
  if (carrier === own) return 'own';
  const c = CARRIERS.find((x) => x.code === carrier);
  return c?.alliance === 'oneworld' ? 'partner' : 'none';
}

const MI_TIERS = { lowest: 0, standard: 1, flex: 2 } as const;

// ---------- British Airways Executive Club ----------

export const BA_TIERS = ['Blue', 'Bronze', 'Silver', 'Gold'] as const;
const BA_AVIOS_RATE: Record<string, number> = { Blue: 6, Bronze: 7, Silver: 8, Gold: 9 };

// Extra tier points, own metal — Basic Economy (our 'lowest') earns none.
// [standard, flex] per cabin, short-haul (<2,000mi) vs long-haul.
const BA_EXTRA_SHORT: Record<'Economy' | 'Business', [number, number]> = {
  Economy: [75, 275], Business: [175, 375],
};
const BA_EXTRA_LONG: Record<Cabin, [number, number]> = {
  Economy: [150, 450], 'Premium Economy': [275, 575], Business: [500, 1100], First: [650, 1250],
};
// American Airlines / Iberia: fixed extra by cabin only, no fare-level split.
const BA_AA_IB_EXTRA: Record<'short' | 'long', Partial<Record<Cabin, number>>> = {
  short: { Economy: 75, Business: 175 },
  long: { Economy: 150, 'Premium Economy': 275, Business: 500, First: 650 },
};
// Published tier-point % of miles for other Oneworld partners.
// [lowest, standard, flex] per cabin — missing tiers fall back to the nearest given.
const BA_PARTNER_TP_PCT: Record<string, Partial<Record<Cabin, number[]>>> = {
  CX: { Economy: [2, 2, 7.5], 'Premium Economy': [6, 6, 12.5], Business: [12.5, 12.5, 25], First: [20, 20, 30] },
  JL: { Economy: [4, 7, 15], 'Premium Economy': [12, 12, 25], Business: [25, 25, 50], First: [40, 40, 60] },
  MH: { Economy: [2, 3.5, 7.5], Business: [12.5, 12.5, 25], First: [20, 20, 30] },
  AY: { Economy: [4, 7, 15], 'Premium Economy': [12, 12, 25], Business: [25, 25, 50] },
  AS: { Economy: [2, 3.5, 7.5], Business: [12.5, 12.5, 25] },
  RJ: { Economy: [2, 2, 7.5], Business: [12.5, 12.5, 25] },
  UL: { Economy: [2, 3.5, 7.5], Business: [12.5, 12.5, 25] },
  AT: { Economy: [2, 3.5, 7.5], Business: [12.5, 12.5, 25] },
  FJ: { Economy: [2, 3.5, 7.5], Business: [12.5, 12.5, 25] },
  WY: { Economy: [2, 3.5, 7.5], Business: [12.5, 12.5, 25] },
  QF: { Economy: [2, 2, 7.5], 'Premium Economy': [6, 6, 12.5], Business: [12.5, 12.5, 25], First: [20, 20, 30] },
  QR: { Economy: [4, 7, 15], Business: [25, 25, 50], First: [40, 40, 60] },
};
// Estimated Avios ladder for those same partners (BA hasn't published this).
const BA_PARTNER_AVIOS_PCT: Record<Cabin, [number, number, number]> = {
  Economy: [25, 50, 100], 'Premium Economy': [100, 100, 125], Business: [125, 125, 150], First: [200, 200, 250],
};

function baExcludedTax(cabin: Cabin, distanceMiles: number, uk: boolean): number {
  const premium = cabin !== 'Economy';
  const band = distanceMiles < 2000 ? 0 : distanceMiles <= 5500 ? 1 : 2;
  const uKTable = [[40, 137, 141], [57, 279, 288]];
  const restTable = [[15, 32, 38], [20, 45, 52]];
  const t = uk ? uKTable : restTable;
  return t[premium ? 1 : 0][band];
}

export function computeBA(input: CreditInput): ProgramResult {
  const { operatingCarrier: carrier, cabin, fareLevel, price, distanceMiles } = input;
  const tier = input.tiers.BA ?? 'Blue';
  const rel = relOneworld(carrier, 'BA');
  const name = 'British Airways Executive Club';
  if (rel === 'none') {
    return { program: 'BA', name, relationship: 'none', redeemable: null, status: null, estimated: false, notes: ['No Oneworld relationship — this carrier earns nothing into BA Club.'] };
  }

  if (rel === 'own') {
    const notes: string[] = [];
    const excluded = baExcludedTax(cabin, distanceMiles, input.ukDeparture);
    const eligible = price != null ? Math.max(price - excluded, 0) : 0;
    if (price == null) notes.push('No price entered — tier points/Avios need one, showing extras only.');
    const short = distanceMiles < 2000;
    let extra = 0;
    if (fareLevel !== 'lowest') {
      const idx = fareLevel === 'flex' ? 1 : 0;
      if (short && (cabin === 'Economy' || cabin === 'Business')) extra = BA_EXTRA_SHORT[cabin][idx];
      else if (!short) extra = BA_EXTRA_LONG[cabin][idx];
    } else {
      notes.push('Basic/lowest fares earn no extra tier points on BA metal.');
    }
    const tierPoints = Math.round(eligible + extra);
    const avios = Math.round(eligible * (BA_AVIOS_RATE[tier] ?? 6));
    notes.push(`Eligible spend excludes ~£${excluded} of tax/fees; Avios at ${tier} rate (${BA_AVIOS_RATE[tier]}/£1).`);
    return { program: 'BA', name, relationship: 'own', redeemable: { name: 'Avios', amount: avios }, status: { name: 'Tier points', amount: tierPoints }, estimated: false, notes };
  }

  if (carrier === 'AA' || carrier === 'IB') {
    const short = distanceMiles < 2000;
    const excluded = baExcludedTax(cabin, distanceMiles, input.ukDeparture);
    const eligible = price != null ? Math.max(price - excluded, 0) : 0;
    const extra = fareLevel === 'lowest' ? 0 : (BA_AA_IB_EXTRA[short ? 'short' : 'long'][cabin] ?? 0);
    const tierPoints = Math.round(eligible + extra);
    return {
      program: 'BA', name, relationship: 'partner',
      redeemable: null,
      status: { name: 'Tier points', amount: tierPoints },
      estimated: false,
      notes: [`${carrierName(carrier)} follows BA's own spend-based rule for tier points, but doesn't earn Avios into BA Club.`, price == null ? 'No price entered.' : `Eligible spend excludes ~£${excluded} of tax/fees.`],
    };
  }

  const tpTable = BA_PARTNER_TP_PCT[carrier];
  const tpRow = tpTable?.[cabin];
  const avPct = BA_PARTNER_AVIOS_PCT[cabin];
  const idx = MI_TIERS[fareLevel];
  const tierPoints = tpRow ? Math.round((distanceMiles * tpRow[Math.min(idx, tpRow.length - 1)]) / 100) : 0;
  const avios = Math.round((distanceMiles * avPct[idx]) / 100);
  return {
    program: 'BA', name, relationship: 'partner',
    redeemable: { name: 'Avios', amount: avios },
    status: tpRow ? { name: 'Tier points', amount: tierPoints } : null,
    estimated: true,
    notes: [
      tpRow ? 'Tier points are BA\'s published rate for this carrier.' : `No published BA tier-point rate found for ${carrierName(carrier)} — showing zero.`,
      'Avios on partner metal is BA\'s own estimated ladder, not a published rate.',
    ],
  };
}

// ---------- Qatar Privilege Club ----------

export const QR_TIERS = ['Burgundy', 'Silver', 'Gold', 'Platinum'] as const;
const QR_TIER_BONUS: Record<string, number> = { Burgundy: 0, Silver: 25, Gold: 75, Platinum: 100 };

// Own-metal Avios class %, by cabin/fare-level (collapsed from Qatar's
// published 4-bucket-per-cabin table onto 3 levels).
const QR_OWN_AVIOS_PCT: Record<Cabin, [number, number, number]> = {
  Economy: [25, 75, 100], 'Premium Economy': [75, 75, 100], Business: [75, 125, 200], First: [300, 300, 300],
};
// Own-metal Qpoints — simplified distance-only ladder (region ignored; see note).
// [lowest, standard, flex] Qpoints per band, by cabin.
const QR_OWN_QPOINTS_BANDS: { max: number; econ: [number, number, number]; biz: [number, number, number]; first: number }[] = [
  { max: 700, econ: [5, 7, 10], biz: [8, 12, 16], first: 20 },
  { max: 2000, econ: [6, 10, 16], biz: [10, 20, 28], first: 40 },
  { max: 4000, econ: [10, 16, 25], biz: [20, 30, 40], first: 50 },
  { max: 7000, econ: [13, 20, 30], biz: [25, 35, 52], first: 69 },
  { max: Infinity, econ: [18, 27, 44], biz: [38, 55, 96], first: 123 },
];

// Partner Qpoints — exact distance ladder from the published/derived chart.
// Row = [ecLow, ecMid, ecHigh, peStd, peFlex, business, first]
const QR_PARTNER_QPOINTS: { max: number; row: number[] }[] = [
  { max: 280, row: [3, 5, 7, 7, 7, 8, 12] },
  { max: 975, row: [5, 7, 10, 10, 11, 12, 16] },
  { max: 1850, row: [6, 8, 12, 12, 14, 16, 20] },
  { max: 2240, row: [7, 9, 15, 15, 16, 18, 28] },
  { max: 2750, row: [7, 9, 15, 15, 16, 18, 33] },
  { max: 3800, row: [10, 16, 25, 25, 27, 30, 40] },
  { max: 4600, row: [10, 16, 25, 25, 27, 30, 50] },
  { max: 5850, row: [13, 20, 30, 30, 32, 35, 52] },
  { max: 8900, row: [14, 23, 40, 40, 45, 50, 88] },
  { max: Infinity, row: [20, 30, 49, 49, 55, 60, 107] },
];
const QR_PARTNER_AVIOS_PCT: Record<Cabin, number[]> = {
  Economy: [25, 50, 100], 'Premium Economy': [100, 100, 110], Business: [125, 125, 125], First: [150, 150, 150],
};

export function computeQR(input: CreditInput): ProgramResult {
  const { operatingCarrier: carrier, cabin, fareLevel, distanceMiles } = input;
  const tier = input.tiers.QR ?? 'Burgundy';
  const rel = relOneworld(carrier, 'QR');
  const name = 'Qatar Privilege Club';
  const idx = MI_TIERS[fareLevel];
  if (rel === 'none') {
    return { program: 'QR', name, relationship: 'none', redeemable: null, status: null, estimated: false, notes: ['No Oneworld relationship — this carrier earns nothing into Privilege Club.'] };
  }

  if (rel === 'own') {
    const billable = Math.max(distanceMiles, 500);
    const classPct = QR_OWN_AVIOS_PCT[cabin][idx];
    const avios = Math.round((billable * (classPct + QR_TIER_BONUS[tier])) / 100);
    const band = QR_OWN_QPOINTS_BANDS.find((b) => distanceMiles <= b.max)!;
    const qpoints = cabin === 'First' ? band.first : cabin === 'Business' ? band.biz[idx] : band.econ[idx];
    return {
      program: 'QR', name, relationship: 'own',
      redeemable: { name: 'Avios', amount: avios },
      status: { name: 'Qpoints', amount: qpoints },
      estimated: true,
      notes: [
        `Avios floored at 500 miles and includes the ${tier} tier bonus (+${QR_TIER_BONUS[tier]}pp) — exact published formula.`,
        'Qpoints simplified to a distance-only ladder for this app — the real Qatar chart also varies by region, so treat this as directional, not exact.',
      ],
    };
  }

  const avPct = QR_PARTNER_AVIOS_PCT[cabin][Math.min(idx, QR_PARTNER_AVIOS_PCT[cabin].length - 1)];
  const avios = Math.round((distanceMiles * avPct) / 100);
  const band = QR_PARTNER_QPOINTS.find((b) => distanceMiles <= b.max)!;
  const rowIdx = cabin === 'First' ? 6 : cabin === 'Business' ? 5 : cabin === 'Premium Economy' ? 3 + Math.min(idx, 1) : idx;
  const qpoints = band.row[rowIdx];
  return {
    program: 'QR', name, relationship: 'partner',
    redeemable: { name: 'Avios', amount: avios },
    status: { name: 'Qpoints', amount: qpoints },
    estimated: false,
    notes: ['No tier bonus and no 500-mile floor on partner metal — real distance, base rate only.', 'Business and First pay a flat rate regardless of fare flexibility.'],
  };
}

// ---------- Qantas Frequent Flyer ----------

export const QF_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Platinum One'] as const;
const QF_TIER_BONUS: Record<string, number> = { Bronze: 0, Silver: 0.5, Gold: 0.75, Platinum: 1, 'Platinum One': 1 };

// Domestic Australia — exact published 3-band table. [points, SC] per column.
const QF_DOM: { max: number; cols: Record<'disc' | 'econ' | 'flexEcon' | 'premEcon' | 'biz' | 'flexBiz' | 'first', [number, number]> }[] = [
  { max: 750, cols: { disc: [500, 10], econ: [500, 10], flexEcon: [750, 20], premEcon: [1125, 20], biz: [1750, 40], flexBiz: [2000, 45], first: [2250, 60] } },
  { max: 1500, cols: { disc: [875, 15], econ: [875, 15], flexEcon: [1375, 30], premEcon: [1750, 30], biz: [2625, 60], flexBiz: [2940, 70], first: [3500, 90] } },
  { max: Infinity, cols: { disc: [1815, 20], econ: [1815, 20], flexEcon: [2750, 40], premEcon: [3375, 40], biz: [4125, 80], flexBiz: [4500, 95], first: [5500, 120] } },
];
const QF_DOM_MIN: Record<string, number> = { disc: 800, econ: 800, flexEcon: 1200, premEcon: 1200, biz: 1400, flexBiz: 1400, first: 1400 };

// International QF metal — simplified distance ratio, fitted to the
// published "Europe / US East" long-haul zone rather than the full
// origin×zone chart (Australia-specific and out of scope for a lean build).
const QF_INTL_PTS_PER_MI: Record<string, number> = { disc: 0.59, econ: 0.886, flexEcon: 1.181, premEcon: 1.476, biz: 1.919, flexBiz: 2.067, first: 2.362 };
const QF_INTL_SC_PER_MI: Record<string, number> = { disc: 0.00667, econ: 0.00905, flexEcon: 0.01333, premEcon: 0.01667, biz: 0.0281, flexBiz: 0.02952, first: 0.04 };

// Partner metal is a separate, materially lower table (own docs: ~58% haircut
// on the one exact comparison available). Approximated as a flat ratio.
const QF_PARTNER_RATIO = 0.42;

function qfColumn(cabin: Cabin, fareLevel: FareLevel): 'disc' | 'econ' | 'flexEcon' | 'premEcon' | 'biz' | 'flexBiz' | 'first' {
  if (cabin === 'First') return 'first';
  if (cabin === 'Premium Economy') return 'premEcon';
  if (cabin === 'Business') return fareLevel === 'flex' ? 'flexBiz' : 'biz';
  return fareLevel === 'lowest' ? 'disc' : fareLevel === 'flex' ? 'flexEcon' : 'econ';
}

export function computeQF(input: CreditInput): ProgramResult {
  const { operatingCarrier: carrier, cabin, fareLevel, distanceMiles } = input;
  const tier = input.tiers.QF ?? 'Bronze';
  const rel = relOneworld(carrier, 'QF');
  const name = 'Qantas Frequent Flyer';
  if (rel === 'none') {
    return { program: 'QF', name, relationship: 'none', redeemable: null, status: null, estimated: false, notes: ['No Oneworld relationship — this carrier earns nothing into Qantas Frequent Flyer.'] };
  }
  const col = qfColumn(cabin, fareLevel);
  const isAuDomestic = distanceMiles < 1600; // proxy: no route/country field in this lean build

  let points: number; let sc: number; let estimated = false;
  const notes: string[] = [];
  if (rel === 'own') {
    if (isAuDomestic) {
      const band = QF_DOM.find((b) => distanceMiles <= b.max)!;
      [points, sc] = band.cols[col];
      points = Math.max(points, QF_DOM_MIN[col]);
      notes.push('Domestic-distance table — exact published rates.');
    } else {
      points = Math.round(QF_INTL_PTS_PER_MI[col] * distanceMiles);
      sc = Math.round(QF_INTL_SC_PER_MI[col] * distanceMiles);
      estimated = true;
      notes.push('International QF-metal earning is fitted to Qantas\' long-haul zone rate, not the full origin-by-zone chart — treat as an estimate.');
    }
    points = Math.round(points * (1 + QF_TIER_BONUS[tier]));
    notes.push(`Includes the ${tier} Points bonus (+${QF_TIER_BONUS[tier] * 100}%) — Status Credits never take a bonus.`);
  } else {
    const base = isAuDomestic
      ? (() => { const band = QF_DOM.find((b) => distanceMiles <= b.max)!; return band.cols[col]; })()
      : [QF_INTL_PTS_PER_MI[col] * distanceMiles, QF_INTL_SC_PER_MI[col] * distanceMiles] as [number, number];
    points = Math.round(base[0] * QF_PARTNER_RATIO * (1 + QF_TIER_BONUS[tier]));
    sc = Math.round(base[1] * QF_PARTNER_RATIO);
    estimated = true;
    notes.push('Partner metal reads a separate, lower Qantas table. Approximated here at ~42% of the own-metal rate (the one exact comparison in the docs) — the real partner table has named city-pairs and won\'t match exactly.');
    notes.push('Most tiers also require 4 QF/JQ/GK-numbered sectors a year — partner flying alone can\'t reach or hold status.');
  }
  return {
    program: 'QF', name, relationship: rel,
    redeemable: { name: 'Qantas Points', amount: points },
    status: { name: 'Status Credits', amount: sc },
    estimated, notes,
  };
}

// ---------- KrisFlyer / PPS Club ----------

export const KF_TIERS = ['None', 'Elite Silver', 'Elite Gold'] as const;

const KF_OWN_PCT: Record<Cabin, [number, number, number]> = {
  Economy: [50, 75, 100], 'Premium Economy': [100, 100, 125], Business: [125, 125, 150], First: [200, 200, 200],
};
// [econLow, econMid, econFlex, premium, bizStd, bizFlex, first]; '—' as null.
const KF_PARTNER: Record<string, (number | null)[]> = {
  LH: [50, 75, 100, 100, 125, 150, 200], LX: [50, 75, 100, 100, 125, 150, 200],
  OS: [50, 75, 100, 100, 125, 150, null], SN: [50, 75, 100, 100, 125, 150, null],
  UA: [50, 75, 100, 100, 125, 125, 125],
  AC: [25, 50, 100, 100, 100, 125, 125],
  NH: [50, 75, 100, 125, 125, 150, 200],
  TG: [50, 100, 100, 100, 125, 125, 150],
  TK: [25, 50, 100, 100, 125, 125, 125],
  AI: [50, 100, 100, 100, 125, 125, 150],
  BR: [50, 100, 110, 100, 125, 125, 125],
  OZ: [70, 100, 100, 100, 125, 135, 135],
  NZ: [50, 100, 110, 110, 125, 125, null],
  VA: [50, 100, 100, null, 200, 200, null],
  AS: [100, 100, 100, 100, 100, 150, 150],
  OU: [50, 100, 100, null, 125, 125, null], CM: [50, 100, 100, null, 125, 125, null],
};
const KF_GENERIC: (number | null)[] = [25, 50, 100, 100, 125, 150, 150];

function kfIndices(cabin: Cabin, fareLevel: FareLevel): number[] {
  const idx = MI_TIERS[fareLevel];
  if (cabin === 'Economy') return [idx]; // 0,1,2 map straight to econLow/Mid/Flex
  if (cabin === 'Premium Economy') return [3];
  if (cabin === 'Business') return [fareLevel === 'flex' ? 5 : 4];
  return [6];
}

export function computeKF(input: CreditInput): ProgramResult {
  const { operatingCarrier: carrier, cabin, fareLevel, distanceMiles } = input;
  const tier = input.tiers.KF ?? 'None';
  const name = 'KrisFlyer / PPS Club';
  const c = CARRIERS.find((x) => x.code === carrier);

  if (carrier === 'SQ') {
    const pct = KF_OWN_PCT[cabin][MI_TIERS[fareLevel]];
    const base = Math.round((distanceMiles * pct) / 100);
    const bonus = tier !== 'None' ? 1.25 : 1;
    return {
      program: 'KF', name, relationship: 'own',
      redeemable: { name: 'KrisFlyer miles', amount: Math.round(base * bonus) },
      status: { name: 'Elite miles', amount: base },
      estimated: false,
      notes: [tier !== 'None' ? `+25% tier bonus applies to KrisFlyer miles only — Elite miles "are not affected by tier status" per SIA.` : 'No elite tier held — base rate.'],
    };
  }
  if (c?.alliance !== 'star') {
    return { program: 'KF', name, relationship: 'none', redeemable: null, status: null, estimated: false, notes: ['No Star Alliance relationship — this carrier earns nothing into KrisFlyer.'] };
  }
  const row = KF_PARTNER[carrier] ?? KF_GENERIC;
  const idxs = kfIndices(cabin, fareLevel);
  const pct = row[idxs[0]] ?? (KF_GENERIC[idxs[0]] as number);
  const base = Math.round((distanceMiles * pct) / 100);
  return {
    program: 'KF', name, relationship: 'partner',
    redeemable: { name: 'KrisFlyer miles', amount: base },
    status: { name: 'Elite miles', amount: base },
    estimated: !KF_PARTNER[carrier],
    notes: [
      !KF_PARTNER[carrier] ? `No specific chart for ${carrierName(carrier)} — using SIA's generic partner ladder.` : 'From SIA\'s published partner accrual chart.',
      'No tier bonus on partner metal — that only applies to Singapore/Scoot-operated flights.',
    ],
  };
}

// ---------- Overall ----------

export const REDEEMABLE_VALUE_PENCE: Record<ProgramId, number> = { BA: 0.8, QR: 0.8, QF: 0.9, KF: 1.2 };

export interface AdvisorResult {
  results: ProgramResult[];
  bestValue: ProgramResult | null;
  bestValueGBP: number;
}

export function runAdvisor(input: CreditInput): AdvisorResult {
  const results = [computeBA(input), computeQR(input), computeQF(input), computeKF(input)];
  let bestValue: ProgramResult | null = null;
  let bestValueGBP = 0;
  for (const r of results) {
    if (!r.redeemable) continue;
    const gbp = (r.redeemable.amount * REDEEMABLE_VALUE_PENCE[r.program]) / 100;
    if (gbp > bestValueGBP) { bestValueGBP = gbp; bestValue = r; }
  }
  return { results, bestValue, bestValueGBP };
}
