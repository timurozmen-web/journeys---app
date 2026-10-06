import { matchProgrammeStrict } from '../data/brandMap';
import { addDays } from './tripDay';

const GENERIC_BRANDS = new Set(['', 'other', 'independent']);

// The programmes' own names, for a brand stored as just "Hyatt" or "Hilton".
const PROGRAMME_WORDS: [RegExp, string][] = [
  [/\bhyatt\b/i, 'World of Hyatt'], [/\bmarriott\b|\bbonvoy\b/i, 'Marriott Bonvoy'], [/\bhilton\b/i, 'Hilton Honors'],
  [/\bihg\b/i, 'IHG One Rewards'], [/\baccor\b/i, 'Accor ALL'],
];
const programmeFor = (text: string) => matchProgrammeStrict(text) ?? PROGRAMME_WORDS.find(([re]) => re.test(text))?.[1] ?? null;

// One consistent reading of a stored stay, applied wherever stays are loaded.
// Bugs this fixes:
//  - A stay stored under a sub-brand ("ibis Styles", "Westin", "Hyatt") was
//    not counted toward its programme (Accor ALL, Marriott Bonvoy, World of
//    Hyatt), so status nights and points came out short.
//  - A stay still marked Booked after its check-out date counted only as
//    pending, never as a completed night, unless edited by hand.
export function canonicalStay<T extends { brand: string; name: string; status: string; date: string; nights: number }>(h: T, today: string): T {
  const fromBrand = programmeFor(h.brand ?? '');
  const fromName = GENERIC_BRANDS.has((h.brand ?? '').trim().toLowerCase()) ? programmeFor(h.name ?? '') : null;
  const brand = fromBrand ?? fromName ?? h.brand;
  const checkedOut = h.date && addDays(h.date, h.nights || 1) <= today;
  const status = h.status === 'Booked' && checkedOut ? 'Completed' : h.status;
  return brand === h.brand && status === h.status ? h : { ...h, brand, status };
}
