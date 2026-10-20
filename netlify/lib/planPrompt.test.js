import { describe, expect, test, vi } from 'vitest';
import { buildMessage, cleanContext, fitNights, parseCities, suggestCities, SYSTEM_PROMPT } from './planPrompt.js';

const japanApril = {
  month: 'April',
  home: 'London',
  regions: [
    { region: 'Tokyo / Kanto', highC: 19.4, rainMm: 124.5, crowd: 'high', price: 'high', event: 'Cherry blossom' },
    { region: 'Okinawa', highC: 24.8, rainMm: 179.2, crowd: 'medium', price: 'medium', event: null },
  ],
  visited: ['Kyoto', 'Tokyo'],
  holidays: [{ date: '2027-04-29', name: 'Shōwa Day' }],
};

describe('what the agent is told', () => {
  test('the trip, the month, each region’s facts and where they have been', () => {
    expect(buildMessage({ country: 'Japan', nights: 12, context: japanApril })).toBe([
      'Country: Japan. Trip length: 12 nights. Month: April. Travelling from London.',
      '',
      'FACTS for April:',
      '- Tokyo / Kanto: high 19C, rain 125mm, crowds high, prices high (Cherry blossom)',
      '- Okinawa: high 25C, rain 179mm, crowds medium, prices medium',
      '',
      'HOLIDAYS: 2027-04-29 Shōwa Day',
      '',
      'VISITED: Kyoto, Tokyo',
    ].join('\n'));
  });

  test('just the trip when there are no facts (no date picked yet)', () => {
    expect(buildMessage({ country: 'Japan', nights: 12 })).toBe('Country: Japan. Trip length: 12 nights.');
  });

  test('the rules hold it to the facts it was given', () => {
    expect(SYSTEM_PROMPT).toMatch(/Rely on them, not your own memory/);
    expect(SYSTEM_PROMPT).toMatch(/Prefer places they haven't been/);
    // Holidays don't simply mean dearer hotels (Tokyo's Marriotts were
    // cheaper in Golden Week), so it isn't told they do.
    expect(SYSTEM_PROMPT).toMatch(/Don't assume they make hotels dearer/);
  });

  test('facts from the browser are trimmed to a sane size and shape', () => {
    const c = cleanContext({
      month: 'April'.repeat(10),
      regions: [...Array(30)].map((_, i) => ({ region: `R${i}`, highC: 'hot', rainMm: 10, crowd: 'high', event: 'x'.repeat(500) })),
      visited: ['Kyoto', 42, ''],
      holidays: [{ date: '2027-05-03', name: 'Constitution Memorial Day' }, { date: 'soon', name: 'x' }, null],
    });
    expect(c.holidays).toEqual([{ date: '2027-05-03', name: 'Constitution Memorial Day' }]);
    expect(c.month).toHaveLength(20);
    expect(c.regions).toHaveLength(20);
    expect(c.regions[0]).toEqual({ region: 'R0', highC: null, rainMm: 10, crowd: 'high', price: null, event: 'x'.repeat(80) });
    expect(c.visited).toEqual(['Kyoto']);
    expect(cleanContext('nonsense')).toBeNull();
  });
});

describe('checking the answer', () => {
  const answer = [
    { city: 'Tokyo', lat: 35.68, lng: 139.69, nights: 4, why: 'Food and neighbourhoods.', nearestAirport: 'hnd' },
    { city: 'Kanazawa', lat: 36.56, lng: 136.65, nights: 3, why: 'Gardens and the geisha district.', nearestAirport: 'KMQ' },
    { city: 'Hiroshima', lat: 34.39, lng: 132.46, nights: 3, why: 'Peace Park and Miyajima.', nearestAirport: 'HIJ' },
    { city: 'Fukuoka', lat: 33.59, lng: 130.4, nights: 3, why: 'Yatai food stalls.', nearestAirport: 'FUK' },
  ];

  test('reads a fenced answer and makes the nights add up to the trip', () => {
    // The model gave 13 nights for a 12-night trip: the longest stop gives one up.
    const cities = parseCities('```json\n' + JSON.stringify(answer) + '\n```', 12);
    expect(cities.map((c) => c.nights)).toEqual([3, 3, 3, 3]);
    expect(cities.reduce((s, c) => s + c.nights, 0)).toBe(12);
    expect(cities[0].nearestAirport).toBe('HND');
  });

  test('finds the list inside chatter around it', () => {
    expect(parseCities(`Here is a route:\n${JSON.stringify(answer)}\nEnjoy!`, 13)).toHaveLength(4);
  });

  test('drops cities with no name or impossible coordinates, and airports that aren’t codes', () => {
    const cities = parseCities(JSON.stringify([
      { city: '', lat: 1, lng: 1, nights: 2 },
      { city: 'Nowhere', lat: 135, lng: 35, nights: 2 },
      { city: 'Osaka', lat: '34.7', lng: 135.5, nights: 2 },
      { city: 'Nara', lat: 34.68, lng: 135.8, nights: 2, nearestAirport: 'Kansai' },
    ]), 2);
    expect(cities).toEqual([{ city: 'Nara', lat: 34.68, lng: 135.8, nights: 2, why: '', nearestAirport: null }]);
  });

  test('says what was wrong with an answer it can’t use', () => {
    expect(() => parseCities('Sorry, I cannot help with that.', 10)).toThrow(/No list of cities/);
    expect(() => parseCities('[{"city": "Tokyo",]', 10)).toThrow(/not valid JSON/);
    expect(() => parseCities('[{"city": "Tokyo"}]', 10)).toThrow(/No usable cities/);
  });

  test('never gives more stops than nights', () => {
    expect(parseCities(JSON.stringify(answer), 2).map((c) => [c.city, c.nights])).toEqual([['Tokyo', 1], ['Kanazawa', 1]]);
  });
});

describe('fitNights', () => {
  test('leaves nights alone when they already add up', () => {
    expect(fitNights([4, 3, 3], 10)).toEqual([4, 3, 3]);
  });
  test('stretches evenly when every stop was given one night', () => {
    expect(fitNights([1, 1, 1], 10)).toEqual([4, 3, 3]);
  });
  test('shrinks in proportion, never below one', () => {
    expect(fitNights([6, 1, 5], 6)).toEqual([3, 1, 2]);
  });
});

describe('suggestCities', () => {
  test('sends the facts and returns checked cities', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify([{ city: 'Sapporo', lat: 43.06, lng: 141.35, nights: 5, why: 'Cool and quiet in April.', nearestAirport: 'CTS' }]) }] }),
    }));
    const cities = await suggestCities({ country: 'Japan', nights: 4, context: japanApril }, { apiKey: 'k', fetchImpl });
    expect(cities).toEqual([{ city: 'Sapporo', lat: 43.06, lng: 141.35, nights: 4, why: 'Cool and quiet in April.', nearestAirport: 'CTS' }]);
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.system).toBe(SYSTEM_PROMPT);
    expect(sent.messages[0].content).toContain('VISITED: Kyoto, Tokyo');
  });
  test('passes on the API’s own error', async () => {
    const fetchImpl = async () => ({ ok: false, json: async () => ({ error: { message: 'overloaded' } }) });
    await expect(suggestCities({ country: 'Japan', nights: 4 }, { apiKey: 'k', fetchImpl })).rejects.toThrow('overloaded');
  });
});
