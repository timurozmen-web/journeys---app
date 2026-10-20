import { describe, expect, test } from 'vitest';
import { matchProgrammeStrict, normalizeBrand, programmeOfHotel } from './brandMap';
import { PRICE_SAMPLES } from './priceSamples';

describe('programmeOfHotel (hotel names in the price samples)', () => {
  test('puts sub-brands with no parent name in them to their programme', () => {
    for (const name of ['Sheraton Miyako Hotel Tokyo', 'The Westin Singapore', 'Moxy NYC Chelsea', 'W Edinburgh', 'Le Royal Méridien Beach Resort & Spa',
      'Renaissance Paris Republique', 'Four Points by Sheraton Flushing', 'The St. Regis Singapore', 'Element Las Vegas Symphony Park']) {
      expect(programmeOfHotel(name), name).toBe('Marriott Bonvoy');
    }
    expect(programmeOfHotel('Mercure Sydney')).toBe('Accor ALL');
    expect(programmeOfHotel('Hyatt Centric Milan Centrale')).toBe('World of Hyatt');
    expect(programmeOfHotel('Hyatt Herald Square New York')).toBe('World of Hyatt');
    expect(programmeOfHotel('Hotel Indigo Lower East Side')).toBe('IHG One Rewards');
  });

  test('leaves independents alone, even when a word looks like a brand', () => {
    // "Four Elements" isn't an Element, Park Regis isn't a St. Regis, and an
    // Ascott on Raffles Place isn't a Raffles.
    for (const name of ['Four Elements Hotel Amsterdam', 'Park Regis by Prince Singapore', 'Ascott Raffles Place Singapore', 'Atlantis The Palm', 'Hotel Da Vinci Milano', 'Wanderlust Inn']) {
      expect(programmeOfHotel(name), name).toBeNull();
    }
    expect(programmeOfHotel('Sheraton Grand Sydney Hyde Park')).toBe('Marriott Bonvoy');
  });

  test('every sampled hotel either belongs to a programme or is independent, as counted on 20 Oct 2026', () => {
    const counts: Record<string, number> = {};
    for (const hotel of new Set(PRICE_SAMPLES.flatMap((s) => s.pairs.map((q) => q.hotel)))) {
      const pr = programmeOfHotel(hotel) ?? 'independent';
      counts[pr] = (counts[pr] ?? 0) + 1;
    }
    expect(counts).toEqual({ 'Marriott Bonvoy': 96, independent: 32, 'IHG One Rewards': 3, 'Accor ALL': 6, 'Hilton Honors': 1, 'World of Hyatt': 1 });
  });
});

describe('matchProgrammeStrict (merchant text)', () => {
  test('recognises hotel-group merchants in card statement text', () => {
    expect(matchProgrammeStrict('MARRIOTT LONDON GB')).toBe('Marriott Bonvoy');
    expect(matchProgrammeStrict('HILTON DALAMAN TR')).toBe('Hilton Honors');
    expect(matchProgrammeStrict('Courtyard by Marriott Bodrum')).toBe('Marriott Bonvoy');
    expect(matchProgrammeStrict('SWISSOTEL BERLIN')).toBe('Accor ALL');
  });

  test('ordinary shops are not mistaken for a hotel brand', () => {
    for (const shop of ['WAITROSE 1234', 'W H SMITH', 'TESCO STORES', 'AMAZON.CO.UK', 'NETFLIX.COM', 'PRET A MANGER']) {
      expect(matchProgrammeStrict(shop)).toBeNull();
    }
  });

  test('regression: the substring matcher used for hotel names does misfire on shops', () => {
    // Why a separate strict matcher exists. If normalizeBrand is ever
    // tightened this test can go -- the strict one stays correct either way.
    expect(normalizeBrand('WAITROSE')).toBe('Marriott Bonvoy');
  });
});
