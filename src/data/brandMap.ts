// Maps a specific hotel sub-brand (e.g. "Hyatt Regency", "Courtyard") to the
// parent loyalty programme name used throughout this app. Sourced from each
// programme's real, current brand portfolio, not guessed.

const MARRIOTT_SUBBRANDS = [
  'The Ritz-Carlton', 'Ritz-Carlton', 'Ritz-Carlton Reserve', 'St. Regis', 'St Regis', 'JW Marriott',
  'W Hotels', 'W', 'Edition', 'The Luxury Collection', 'Luxury Collection', 'Marriott Hotels', 'Marriott',
  'Sheraton', 'Marriott Vacation Club', 'Delta Hotels', 'Le Meridien', 'Le Méridien', 'Westin',
  'Renaissance Hotels', 'Renaissance', 'Autograph Collection', 'Tribute Portfolio', 'Design Hotels',
  'Courtyard', 'Four Points', 'SpringHill Suites', 'Protea Hotels', 'Fairfield', 'AC Hotels', 'AC by Marriott',
  'Aloft', 'Moxy', 'City Express', 'Marriott Executive Apartments', 'Apartments by Marriott Bonvoy',
  'Residence Inn', 'TownePlace Suites', 'Element', 'Homes & Villas by Marriott Bonvoy', 'MGM Collection',
  'citizenM', 'StudioRes',
];

const HILTON_SUBBRANDS = [
  'Waldorf Astoria', 'Conrad', 'LXR', 'Signia by Hilton', 'Signia', 'NoMad Hotels', 'NoMad',
  'Canopy by Hilton', 'Canopy', 'Graduate by Hilton', 'Graduate', 'Tempo by Hilton', 'Tempo',
  'Motto by Hilton', 'Motto', 'Hilton Hotels & Resorts', 'Hilton', 'DoubleTree', 'Curio Collection',
  'Tapestry Collection', 'Embassy Suites', 'Homewood Suites', 'Home2 Suites', 'LivSmart Studios',
  'Hilton Garden Inn', 'Hampton', 'Hampton Inn', 'Tru by Hilton', 'Tru', 'Spark by Hilton', 'Spark',
  'Small Luxury Hotels of the World', 'SLH', 'AutoCamp', 'Outset Collection', 'Apartment Collection by Hilton',
];

const IHG_SUBBRANDS = [
  'Six Senses', 'Regent', 'InterContinental', 'Vignette Collection', 'Kimpton', 'HUALUXE', 'Crowne Plaza',
  'voco', 'Hotel Indigo', 'EVEN Hotels', 'avid hotels', 'Holiday Inn Express', 'Holiday Inn Club Vacations',
  'Atwell Suites', 'Staybridge Suites', 'Candlewood Suites', 'Holiday Inn Resort', 'Holiday Inn',
  'Garner Hotels', 'the niu', 'Ruby Hotels',
];

const ACCOR_SUBBRANDS = [
  'Orient Express', 'Raffles', 'Faena', 'Banyan Tree', 'Sofitel Legend', 'Fairmont', 'Sofitel',
  'MGallery', 'Emblems Collection', 'Mantis', 'Art Series', 'Pullman', 'Swissotel', 'Swissôtel',
  'Movenpick', 'Mövenpick', 'Grand Mercure', 'Peppers', 'The Sebel', 'Mantra', 'Novotel', 'Mercure',
  'Adagio', 'Handwritten Collection', 'Tribe', 'BreakFree', 'ibis Styles', 'ibis budget', 'ibis',
  'hotelF1', 'greet', '21c Museum Hotels', '25hours', 'Delano', 'Gleneagles', 'Hyde', 'Jo&Joe',
  'Mama Shelter', 'Mondrian', 'Morgans Originals', 'SLS', 'SO/', 'The Hoxton', 'Rixos', 'Our Habitas',
  'Rikas', 'onefinestay',
];

const HYATT_SUBBRANDS = [
  'Park Hyatt', 'Grand Hyatt', 'Hyatt Regency', 'Hyatt Hotels', 'Hyatt Place', 'Hyatt House',
  'Hyatt Studios', 'UrCove', 'Miraval', 'Alila', 'Andaz', 'Thompson Hotels', 'Thompson', 'Dream Hotels',
  'Dream', 'Hyatt Centric', 'Caption by Hyatt', 'The Unbound Collection', 'Destination by Hyatt',
  'JdV by Hyatt', 'Impression by Secrets', 'Hyatt Ziva', 'Hyatt Zilara', 'Zoetry', 'Secrets Resorts',
  'Breathless Resorts', 'Dreams Resorts', 'Hyatt Vivid', 'Alua Hotels', 'Sunscape Resorts', 'Bunkhouse Hotels',
  'me and all', 'THE STANDARD', 'The Standard', 'Unscripted by Hyatt',
];

interface BrandGroup {
  programme: string;
  subBrands: string[];
}
const BRAND_GROUPS: BrandGroup[] = [
  { programme: 'Marriott Bonvoy', subBrands: MARRIOTT_SUBBRANDS },
  { programme: 'Hilton Honors', subBrands: HILTON_SUBBRANDS },
  { programme: 'IHG One Rewards', subBrands: IHG_SUBBRANDS },
  { programme: 'Accor ALL', subBrands: ACCOR_SUBBRANDS },
  { programme: 'World of Hyatt', subBrands: HYATT_SUBBRANDS },
];

// Sorted longest-name-first so "Ritz-Carlton Reserve" matches before the
// shorter "Ritz-Carlton" when both would otherwise match a substring.
const LOOKUP: { needle: string; programme: string }[] = BRAND_GROUPS
  .flatMap((g) => g.subBrands.map((s) => ({ needle: s.toLowerCase(), programme: g.programme })))
  .sort((a, b) => b.needle.length - a.needle.length);

/**
 * Given a raw hotel name or brand string (e.g. "Hyatt Regency Chicago",
 * "Courtyard by Marriott"), returns the parent loyalty programme name if a
 * known sub-brand is recognised, otherwise returns the input unchanged.
 */
export function normalizeBrand(raw: string): string {
  const text = raw.toLowerCase();
  for (const { needle, programme } of LOOKUP) {
    if (text.includes(needle)) return programme;
  }
  return raw;
}

/**
 * Given a raw hotel name, returns the specific sub-brand matched (e.g.
 * "Park Hyatt" rather than the parent "World of Hyatt"), or null if none
 * is recognised. Used for challenges that count distinct sub-brands, like
 * Hyatt's Brand Explorer, where "Park Hyatt" and "Andaz" are separate
 * brands even though both roll up to World of Hyatt.
 */
export function detectSubBrand(raw: string, programme?: string): string | null {
  const text = raw.toLowerCase();
  const pool = programme ? LOOKUP.filter((l) => l.programme === programme) : LOOKUP;
  for (const { needle, programme: prog } of pool) {
    if (text.includes(needle)) {
      const group = BRAND_GROUPS.find((g) => g.programme === prog);
      const canonical = group?.subBrands.find((s) => s.toLowerCase() === needle);
      return canonical ?? needle;
    }
  }
  return null;
}

