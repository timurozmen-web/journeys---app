import { describe, expect, it } from 'vitest';
import { civilianAirportName, formatHours, roundPointsEstimate, shortProgramme, stayRange } from './planFormat';

describe('plan formatting', () => {
  it('rounds long estimates to 15 minutes and keeps short hops exact', () => {
    expect(formatHours(12.77)).toBe('12h 45m');
    expect(formatHours(2)).toBe('2h');
    expect(formatHours(0.5)).toBe('30m');
  });

  it('snaps points to realistic round figures', () => {
    expect(roundPointsEstimate(58434)).toBe(58500);
  });

  it('drops military suffixes from dual-use airports', () => {
    expect(civilianAirportName('Komatsu Airport / JASDF Komatsu Air Base')).toBe('Komatsu Airport');
  });

  it('writes a stay as a short date range', () => {
    expect(stayRange('2027-04-02', '2027-04-06')).toBe('2–6 Apr');
    expect(stayRange('2027-04-29', '2027-05-03')).toBe('29 Apr – 3 May');
  });

  it('shortens programme names', () => {
    expect(shortProgramme('World of Hyatt')).toBe('Hyatt');
    expect(shortProgramme('Marriott Bonvoy')).toBe('Marriott');
  });
});
