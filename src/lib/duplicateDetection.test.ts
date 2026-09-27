import { describe, expect, test } from 'vitest';
import { findLikelyDuplicateFlight, findLikelyDuplicateHotel } from './duplicateDetection';
import { makeFlight, makeHotel } from '../test/fixtures';

describe('findLikelyDuplicateHotel', () => {
  const existing = [makeHotel({ id: 'jw', name: 'JW Marriott Grosvenor House', brand: 'Marriott Bonvoy', date: '2026-09-04' })];

  test('same programme within a day counts as a duplicate, even with a different sub-brand name', () => {
    expect(findLikelyDuplicateHotel({ name: 'JW Marriott London', brand: 'JW Marriott', checkIn: '2026-09-05' }, existing)?.id).toBe('jw');
  });

  test('two days apart is a different stay', () => {
    expect(findLikelyDuplicateHotel({ name: 'JW Marriott London', brand: 'JW Marriott', checkIn: '2026-09-06' }, existing)).toBeNull();
  });

  test('with no brand, falls back to a case-insensitive name match', () => {
    expect(findLikelyDuplicateHotel({ name: '  jw marriott grosvenor house ', brand: null, checkIn: '2026-09-04' }, existing)?.id).toBe('jw');
    expect(findLikelyDuplicateHotel({ name: 'Somewhere Else', brand: null, checkIn: '2026-09-04' }, existing)).toBeNull();
  });

  test('no check-in date -> never flagged', () => {
    expect(findLikelyDuplicateHotel({ name: 'JW Marriott', brand: 'JW Marriott', checkIn: null }, existing)).toBeNull();
  });
});

describe('findLikelyDuplicateFlight', () => {
  const existing = [makeFlight({ id: 'out', date: '2026-09-04', from: 'LHR', to: 'JFK' })];

  test('same date and route, in either direction', () => {
    expect(findLikelyDuplicateFlight({ date: '2026-09-04', from: 'LHR', to: 'JFK' }, existing)?.id).toBe('out');
    expect(findLikelyDuplicateFlight({ date: '2026-09-04', from: 'JFK', to: 'LHR' }, existing)?.id).toBe('out');
  });

  test('different date, or missing fields -> not a duplicate', () => {
    expect(findLikelyDuplicateFlight({ date: '2026-09-05', from: 'LHR', to: 'JFK' }, existing)).toBeNull();
    expect(findLikelyDuplicateFlight({ date: '2026-09-04', from: null, to: 'JFK' }, existing)).toBeNull();
  });
});
