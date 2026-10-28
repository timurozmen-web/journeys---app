import { describe, expect, test } from 'vitest';
import { matchProgrammeStrict, normalizeBrand, programmeOfHotel } from './brandMap';

describe('programmeOfHotel (hotel names in the price database)', () => {
  test('puts sub-brands with no parent name in them to their programme', () => {
    for (const name of ['Sheraton Miyako Hotel Tokyo', 'The Westin Singapore', 'Moxy NYC Chelsea', 'W Edinburgh', 'Le Royal Méridien Beach Resort & Spa',
      'Renaissance Paris Republique', 'Four Points by Sheraton Flushing', 'The St. Regis Singapore', 'Element Las Vegas Symphony Park']) {
      expect(programmeOfHotel(name), name).toBe('Marriott Bonvoy');
    }
    expect(programmeOfHotel('Mercure Sydney')).toBe('Accor ALL');
    expect(programmeOfHotel('Hyatt Centric Milan Centrale')).toBe('World of Hyatt');
    expect(programmeOfHotel('Hyatt Herald Square New York')).toBe('World of Hyatt');
    expect(programmeOfHotel('Hotel Indigo Lower East Side')).toBe('IHG One Rewards');
    // Each AC is named "AC Hotel <place>", which "AC Hotels" didn't match;
    // none had come back priced until the group search priced Madrid's.
    expect(programmeOfHotel('AC Hotel Recoletos')).toBe('Marriott Bonvoy');
    // Garner's the same: "Garner Hotel Berlin - Mitte", with no "IHG" in it.
    expect(programmeOfHotel('Garner Hotel Berlin - Mitte')).toBe('IHG One Rewards');
    // Accor runs some hotels under their own name: the Park Royal City in
    // Buenos Aires came back in the Accor search with no brand in its name.
    expect(programmeOfHotel('Park Royal Buenos Aires managed by Accor')).toBe('Accor ALL');
  });

  test('leaves independents alone, even when a word looks like a brand', () => {
    // "Four Elements" isn't an Element, Park Regis isn't a St. Regis, an
    // Ascott on Raffles Place isn't a Raffles, the Regent Warsaw, a Hyatt
    // until 2014 and independent since, isn't one of IHG's Regents, and Arlo
    // NoMad (named for its Manhattan district) isn't Hilton's NoMad. Vancouver's
    // St Regis Hotel, independent since 1913, came back counted as Marriott's,
    // as did Cartagena's Casa Lola, listed as "Casa Lola Luxury Collection".
    for (const name of ['Four Elements Hotel Amsterdam', 'Park Regis by Prince Singapore', 'Ascott Raffles Place Singapore', 'Atlantis The Palm', 'Hotel Da Vinci Milano', 'Wanderlust Inn', 'Regent Warsaw Hotel', 'Arlo NoMad', 'St Regis Hotel', 'Casa Lola Luxury Collection']) {
      expect(programmeOfHotel(name), name).toBeNull();
    }
    expect(programmeOfHotel('Sheraton Grand Sydney Hyde Park')).toBe('Marriott Bonvoy');
    expect(programmeOfHotel('Regent Hong Kong')).toBe('IHG One Rewards');
    expect(programmeOfHotel('The Ritz-Carlton New York, NoMad')).toBe('Marriott Bonvoy');
    expect(programmeOfHotel('The St. Regis Toronto')).toBe('Marriott Bonvoy');
  });

  test('reads SLS and SO/, under the four-letter floor, as Accor', () => {
    // SLS Barcelona and the SO/ hotels in Paris, Vienna and Dubai were read
    // as independents. The SLS Beverly Hills is now a Luxury Collection hotel.
    for (const name of ['SLS Barcelona', 'SO/ PARIS', 'SO/ Vienna', 'SO/ Uptown Dubai']) {
      expect(programmeOfHotel(name), name).toBe('Accor ALL');
    }
    expect(programmeOfHotel('SLS Hotel, a Luxury Collection Hotel, Beverly Hills')).toBe('Marriott Bonvoy');
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
