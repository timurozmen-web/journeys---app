import { describe, expect, it } from 'vitest';
import { awardCabin } from './fareClass';

describe('awardCabin', () => {
  it('reads a Qatar U as a business award (8GAQIL, HEL-DOH-HND)', () => {
    expect(awardCabin('QR', 'U')).toBe('Business');
    expect(awardCabin('QR', 'x')).toBe('Economy');
  });
  it('knows BA reward classes', () => {
    expect(awardCabin('BA', 'Z')).toBe('First');
    expect(awardCabin('BA', 'P')).toBe('Premium Economy');
  });
  it("treats a letter as a cash fare on an airline where it isn't an award class", () => {
    expect(awardCabin('LO', 'U')).toBeNull(); // LOT Saver economy
    expect(awardCabin('BA', 'J')).toBeNull();
    expect(awardCabin(null, 'U')).toBeNull();
  });
});
