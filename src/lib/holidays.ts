import { addDays } from './tripDay';
import { countryKey } from './countryName';

// Public holidays (fetched through netlify/functions/holidays.js, from
// Nager.Date), matched to a trip's stays.

export interface Holiday {
  date: string;
  name: string;
  localName: string;
  /** Kept nationwide; false for a holiday only some regions keep. */
  global: boolean;
  types: string[];
}

// ISO 3166-1 alpha-2 codes: the countries and territories a holiday can
// be asked for. Names come from the browser's own list (Intl), matched
// loosely to the app's spellings.
const CODES = ('AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG '
  + 'CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN '
  + 'GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT '
  + 'LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH '
  + 'PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM '
  + 'TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');

// Spellings the browser's list and the app's data don't share.
const OTHER_NAMES: Record<string, string> = {
  'democratic republic of congo': 'CD', 'republic of congo': 'CG', 'ivory coast': 'CI', "cote d'ivoire": 'CI',
  macau: 'MO', palestine: 'PS', 'cape verde': 'CV', swaziland: 'SZ', 'east timor': 'TL', 'vatican city': 'VA',
  micronesia: 'FM', 'north korea': 'KP', 'western sahara (disputed territory)': 'EH', 'caribbean netherlands': 'BQ',
};

function nameKey(name: string): string {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'").replace(/\s*\(.*?\)\s*/g, ' ').replace(/ sar china$/, '')
    .replace(/&/g, 'and').replace(/\bst\.\s*/g, 'saint ').replace(/\bthe\b/g, '').replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return countryKey(n);
}

let byName: Map<string, string> | null = null;

/** The two-letter code for a country as the app names it, or null. */
export function countryCode(name: string): string | null {
  if (!byName) {
    byName = new Map();
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    for (const code of CODES) {
      const n = names.of(code);
      if (n) byName.set(nameKey(n), code);
    }
    for (const [n, code] of Object.entries(OTHER_NAMES)) byName.set(nameKey(n), code);
  }
  return byName.get(nameKey(name)) ?? byName.get(nameKey(name.replace(/^(the )?(republic|democratic republic) of /i, ''))) ?? null;
}

/** National public holidays on any night of a stay, check-in night to the last. */
export function holidaysDuring(holidays: Holiday[], checkIn: string, nights: number): Holiday[] {
  const checkOut = addDays(checkIn, nights);
  return holidays.filter((h) => h.global && h.date >= checkIn && h.date < checkOut).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Whether a holiday makes a long weekend: on a Monday or Friday it does;
 * on a Tuesday or Thursday many take the day between off too (a bridge).
 */
export function longWeekend(date: string): 'long weekend' | 'bridge' | null {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 1 || day === 5) return 'long weekend';
  if (day === 2 || day === 4) return 'bridge';
  return null;
}

/** "3 May" from "2027-05-03". */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`;
}
