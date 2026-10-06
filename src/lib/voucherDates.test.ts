import { describe, expect, test } from 'vitest';
import { voucherDates } from './voucherDates';

describe('voucherDates', () => {
  test('a renewal voucher not yet issued shows when it arrives and until when', () => {
    expect(voucherDates({ earnedDate: '2026-12-01', expiryDate: '2027-12-01' }, '2026-10-06')).toBe('From 1 December 2026 · until 1 December 2027');
  });
  test('an issued voucher shows its expiry, or nothing if there is none', () => {
    expect(voucherDates({ earnedDate: '2026-08-13', expiryDate: '2027-08-13' }, '2026-10-06')).toBe('Until 13 August 2027');
    expect(voucherDates({ earnedDate: '2026-08-13', expiryDate: null }, '2026-10-06')).toBe('');
  });
});
