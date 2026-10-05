import { describe, expect, test } from 'vitest';
import { airlineFromFlightNo } from './flightNumber';

describe('airlineFromFlightNo', () => {
  test('a known IATA prefix gives the airline', () => {
    expect(airlineFromFlightNo('BA866', [])).toBe('British Airways');
    expect(airlineFromFlightNo('qr 8', [])).toBe('Qatar Airways');
  });
  test('your own past flights teach prefixes the list does not have', () => {
    expect(airlineFromFlightNo('U2 8565', [{ flightNo: 'U2 1234', airline: 'easyJet' }])).toBe('easyJet');
  });
  test('unknown, numeric or too-short input gives nothing', () => {
    expect(airlineFromFlightNo('ZZ1', [])).toBeNull();
    expect(airlineFromFlightNo('12345', [])).toBeNull();
    expect(airlineFromFlightNo('B', [])).toBeNull();
  });
});
