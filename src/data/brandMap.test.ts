import { describe, expect, test } from 'vitest';
import { matchProgrammeStrict, normalizeBrand } from './brandMap';

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
