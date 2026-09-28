import { describe, expect, test } from 'vitest';
import { flightLegs, greatCircle, projectLegs, lookupAirport, midpointAndHeading, splitAtAntimeridian, toPathD } from './flightPath';
import type { GlobalAirport } from '../data/globalAirportsLoader';

const global = new Map<string, GlobalAirport>([
  ['ZZZ', { iata: 'ZZZ', name: 'Test Field', lat: 10, lng: 20, city: 'Test', country: 'Nowhere' }],
]);

describe('lookupAirport', () => {
  test('uses the curated table first, then the global list', () => {
    expect(lookupAirport('lhr')?.name).toBe('London Heathrow');
    expect(lookupAirport('ZZZ')).toBeNull();
    expect(lookupAirport('ZZZ', global)?.name).toBe('Test Field');
  });
});

describe('flightLegs', () => {
  test('a direct flight is one leg', () => {
    const legs = flightLegs({ id: 'f', from: 'LGW', to: 'DLM', via: [], date: '2026-07-25' });
    expect(legs.map((l) => `${l.from.code}-${l.to.code}`)).toEqual(['LGW-DLM']);
  });

  test('a stopover (e.g. Qatar via Doha) becomes two legs through the stop', () => {
    const legs = flightLegs({ id: 'f', from: 'LHR', to: 'BKK', via: ['DOH'], date: '2026-07-25' });
    expect(legs.map((l) => `${l.from.code}-${l.to.code}`)).toEqual(['LHR-DOH', 'DOH-BKK']);
    expect(legs[1]).toMatchObject({ index: 1, of: 2 });
  });

  test('an unknown airport drops only its own legs', () => {
    const legs = flightLegs({ id: 'f', from: 'LHR', to: 'BKK', via: ['QQQ'], date: null });
    expect(legs).toEqual([]);
    expect(flightLegs({ id: 'f', from: 'LHR', to: 'ZZZ', via: [], date: null }, global)).toHaveLength(1);
  });
});

describe('greatCircle', () => {
  test('starts and ends at the two airports', () => {
    const pts = greatCircle({ lat: 51.47, lng: -0.45 }, { lat: 25.27, lng: 51.61 }, 10);
    expect(pts).toHaveLength(11);
    expect(pts[0][0]).toBeCloseTo(-0.45);
    expect(pts[0][1]).toBeCloseTo(51.47);
    expect(pts[10][0]).toBeCloseTo(51.61);
    expect(pts[10][1]).toBeCloseTo(25.27);
  });

  test('London to Los Angeles bows north over Greenland, as real flights do', () => {
    const pts = greatCircle({ lat: 51.47, lng: -0.45 }, { lat: 33.94, lng: -118.41 }, 20);
    const maxLat = Math.max(...pts.map((p) => p[1]));
    expect(maxLat).toBeGreaterThan(60);
  });
});

describe('midpointAndHeading', () => {
  test('halfway along by length, facing the direction of travel', () => {
    expect(midpointAndHeading([[0, 0], [10, 0]])).toEqual({ x: 5, y: 0, angle: 0 });
    const down = midpointAndHeading([[0, 0], [0, 4], [0, 10]])!;
    expect(down.y).toBe(5);
    expect(down.angle).toBe(90);
  });

  test('can sit part-way along instead of halfway', () => {
    expect(midpointAndHeading([[0, 0], [10, 0]], 0.25)).toEqual({ x: 2.5, y: 0, angle: 0 });
  });

  test('too few points gives nothing', () => {
    expect(midpointAndHeading([[1, 1]])).toBeNull();
  });
});

describe('splitAtAntimeridian', () => {
  test('breaks a path that jumps across the map edge', () => {
    const parts = splitAtAntimeridian([[340, 50], [355, 50], [5, 50], [20, 50]], 360);
    expect(parts).toHaveLength(2);
  });
});

test('toPathD', () => {
  expect(toPathD([[0, 0], [1.25, 2]])).toBe('M0.0,0.0 L1.3,2.0');
});

describe('projectLegs', () => {
  const flat = (lng: number, lat: number): [number, number] => [lng + 180, 90 - lat];

  test('a stopover flight draws two legs: origin ring on the first, destination dot on the last', () => {
    const drawn = projectLegs(flightLegs({ id: 'q', from: 'LHR', to: 'BKK', via: ['DOH'], date: '2026-07-25' }), flat, 360);
    expect(drawn).toHaveLength(2);
    expect(drawn[0]).toMatchObject({ fromCode: 'LHR', toCode: 'DOH', startsJourney: true, endsJourney: false });
    expect(drawn[1]).toMatchObject({ fromCode: 'DOH', toCode: 'BKK', startsJourney: false, endsJourney: true });
  });

  test('the path ends exactly on the destination airport', () => {
    const [leg] = projectLegs(flightLegs({ id: 'f', from: 'LGW', to: 'DLM', via: [], date: null }), flat, 360);
    const dlm = lookupAirport('DLM')!;
    expect(leg.end[0]).toBeCloseTo(dlm.lng + 180);
    expect(leg.end[1]).toBeCloseTo(90 - dlm.lat);
  });

  test('the plane faces the way the flight goes (London to Türkiye heads east-south-east)', () => {
    const [leg] = projectLegs(flightLegs({ id: 'f', from: 'LGW', to: 'DLM', via: [], date: null }), flat, 360);
    expect(leg.mid!.angle).toBeGreaterThan(0);
    expect(leg.mid!.angle).toBeLessThan(45);
  });
});
