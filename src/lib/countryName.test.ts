import { describe, expect, it } from 'vitest';
import { countryKey, sameCity, sameCountry } from './countryName';

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

describe('sameCity', () => {
  // The hotel prices say "Bogota" and "Cancun"; a stop the agent named
  // "Bogotá" found none of them.
  it('matches names with and without accents, and local names', () => {
    expect(sameCity('Bogotá', 'Bogota')).toBe(true);
    expect(sameCity('Cancún', 'Cancun')).toBe(true);
    expect(sameCity('Montréal', 'Montreal')).toBe(true);
    expect(sameCity('København', 'Copenhagen')).toBe(true);
    expect(sameCity('Lisboa', 'Lisbon')).toBe(true);
    expect(sameCity('New York City', 'New York')).toBe(true);
  });
  it('keeps different cities apart', () => {
    expect(sameCity('Lima', 'Lisbon')).toBe(false);
    expect(sameCity('Oslo', 'Stockholm')).toBe(false);
  });
});
