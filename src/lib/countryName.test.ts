import { describe, expect, it } from 'vitest';
import { countryKey, sameCountry } from './countryName';

describe('sameCountry', () => {
  // The planner's list said "United Arab Emirates", the climate table
  // "UAE": Dubai got no weather.
  it('matches the spellings the data sets use', () => {
    expect(sameCountry('United Arab Emirates', 'UAE')).toBe(true);
    expect(sameCountry('Turkey', 'Türkiye')).toBe(true);
    expect(sameCountry('United States of America', 'United States')).toBe(true);
    expect(sameCountry(' japan ', 'Japan')).toBe(true);
  });
  it('keeps different countries apart', () => {
    expect(sameCountry('Austria', 'Australia')).toBe(false);
    expect(countryKey('Oman')).toBe('oman');
  });
});
