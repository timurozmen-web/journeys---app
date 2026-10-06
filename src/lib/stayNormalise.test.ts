import { describe, expect, test } from 'vitest';
import { canonicalStay } from './stayNormalise';
import { makeHotel } from '../test/fixtures';

const TODAY = '2026-10-06';

describe('canonicalStay', () => {
  test('a sub-brand counts toward its programme', () => {
    expect(canonicalStay(makeHotel({ brand: 'ibis Styles', name: 'ibis Styles London Gatwick Airport' }), TODAY).brand).toBe('Accor ALL');
    expect(canonicalStay(makeHotel({ brand: 'Westin', name: 'The Westin London City' }), TODAY).brand).toBe('Marriott Bonvoy');
    expect(canonicalStay(makeHotel({ brand: 'Hyatt', name: 'Hyatt Regency London Olympia' }), TODAY).brand).toBe('World of Hyatt');
  });

  test('a generic brand is read from the hotel name; unknown names stay as they are', () => {
    expect(canonicalStay(makeHotel({ brand: 'Other', name: 'Courtyard Vilnius' }), TODAY).brand).toBe('Marriott Bonvoy');
    expect(canonicalStay(makeHotel({ brand: 'Other', name: 'Liberty Signa' }), TODAY).brand).toBe('Other');
    expect(canonicalStay(makeHotel({ brand: 'Airbnb', name: 'Airbnb - Exmouth' }), TODAY).brand).toBe('Airbnb');
  });

  test('a stay still marked Booked after check-out is completed; one still under way is not', () => {
    expect(canonicalStay(makeHotel({ status: 'Booked', date: '2026-09-15', nights: 1 }), TODAY).status).toBe('Completed');
    expect(canonicalStay(makeHotel({ status: 'Booked', date: '2026-10-05', nights: 1 }), TODAY).status).toBe('Completed'); // checked out today
    expect(canonicalStay(makeHotel({ status: 'Booked', date: '2026-10-06', nights: 1 }), TODAY).status).toBe('Booked');
    expect(canonicalStay(makeHotel({ status: 'needs-confirm', date: '2026-09-01', nights: 1 }), TODAY).status).toBe('needs-confirm');
  });
});

import { computeStatusProgress } from './statusProgress';
import type { LoyaltyProgramme } from '../types';

describe('Accor nights to Platinum, from the real stays', () => {
  // Bug: "33 nights to Platinum" -- sub-brand stays (ibis Styles) weren't
  // counted, past stays still marked Booked only counted as pending, and a
  // card that was never held added elite nights.
  const accor: LoyaltyProgramme = {
    name: 'Accor ALL', abbr: 'ALL', points: 7157, ptValue: 1.72, color: '#000', accent: '#fff', font: 'x', shape: 'x',
    tier: 'Gold', nextTier: 'Platinum', nights: 7, nightsNeeded: 29, nightsBaselineDate: '2026-08-13', statusPointsOverride: 4476, category: 'hotel',
  };
  const stay = (id: string, brand: string, date: string, nights: number, status: 'Completed' | 'Booked') =>
    canonicalStay(makeHotel({ id, name: `${brand} ${id}`, brand, date, nights, status }), TODAY);
  const hotels = [
    stay('a', 'ibis Styles', '2026-08-16', 1, 'Completed'),
    stay('b', 'Accor ALL', '2026-08-25', 1, 'Completed'),
    stay('c', 'Accor ALL', '2026-09-01', 3, 'Completed'),
    stay('d', 'Accor ALL', '2026-09-09', 1, 'Completed'),
    stay('e', 'Accor ALL', '2026-09-15', 1, 'Booked'),
    stay('f', 'Accor ALL', '2026-09-22', 1, 'Booked'),
    stay('g', 'Accor ALL', '2026-09-29', 1, 'Booked'),
    stay('h', 'Accor ALL', '2026-05-08', 3, 'Completed'), // before the baseline: already in the stored 7
  ];
  test('nights so far and nights to go add up to the 60 Platinum needs', () => {
    const p = computeStatusProgress(accor, hotels, [], []);
    expect(p.total).toBe(60);
    expect(p.currentNights).toBe(16);
    expect(p.total - p.currentNights).toBe(44);
  });
});
