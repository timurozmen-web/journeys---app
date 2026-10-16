import { describe, expect, it } from 'vitest';
import { overlappingStay } from './stayOverlap';
import { makeHotel } from '../test/fixtures';

describe('overlappingStay', () => {
  const stays = [makeHotel({ id: 'a', name: 'Sofitel', date: '2026-10-14', nights: 1 }), makeHotel({ id: 'b', name: 'Croydon', date: '2026-10-20', nights: 1 })];

  it('lets a stay start on the day another checks out', () => {
    expect(overlappingStay(stays, '2026-10-15', 5)).toBeNull();
  });

  it('finds a stay sharing a night', () => {
    expect(overlappingStay(stays, '2026-10-19', 2)?.name).toBe('Croydon');
  });

  it('ignores the stay being edited', () => {
    expect(overlappingStay(stays, '2026-10-20', 1, 'b')).toBeNull();
  });

  it('ends on the right day across the clocks going forward (28 Mar + 2 nights checks out on the 30th)', () => {
    const next = [makeHotel({ id: 'c', name: 'Next', date: '2026-03-30', nights: 1 })];
    expect(overlappingStay(next, '2026-03-28', 2)).toBeNull();
    const sharing = [makeHotel({ id: 'd', name: 'Shared', date: '2026-03-29', nights: 1 })];
    expect(overlappingStay(sharing, '2026-03-28', 2)?.name).toBe('Shared');
  });
});
