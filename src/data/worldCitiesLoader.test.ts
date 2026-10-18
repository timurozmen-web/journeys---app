import { describe, expect, it } from 'vitest';
import { nearestAirportToCity } from './worldCitiesLoader';

describe('nearestAirportToCity', () => {
  // Le Bourget (business jets only) is nearer central Paris than CDG or
  // Orly, and was picked: the plan routed London to LBG.
  it('takes a hand-picked airport with scheduled flights over a nearer business-jet field', async () => {
    expect((await nearestAirportToCity(48.86, 2.35))?.airport.iata).toBe('CDG');
  });
  it('still finds an airport where none is hand-picked', async () => {
    const r = await nearestAirportToCity(-12.05, -77.04); // Lima
    expect(r?.airport.iata).toBe('LIM');
  });
});
