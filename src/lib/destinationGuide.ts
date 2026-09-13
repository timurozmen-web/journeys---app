// Month-level season (price/crowds) and weather guide, per destination
// region. This is a researched starter set, not an exhaustive one --
// destinations not listed here simply don't show a guide rather than
// guessing. Extend this list over time; the data itself (established
// climate/tourism-season patterns) doesn't go stale the way live prices
// would, so it's a reasonable one-time research investment rather than
// something that needs live lookups.
//
// Sources: Japan (all three regions) and Thailand/Phuket were verified
// via web search against multiple current travel-climate guides
// (Sept 2026). The remaining destinations use well-established, stable
// seasonal patterns (Mediterranean dry-summer climate, tropical
// wet/dry seasons, etc.) that are standard textbook climate knowledge
// rather than time-sensitive facts.

export type PriceLevel = 'high' | 'shoulder' | 'low';
export type WeatherLevel = 'good' | 'okay' | 'poor';

export interface MonthGuide {
  price: PriceLevel;
  weather: WeatherLevel;
  summary: string;
  tempRangeC: [number, number];
}

export interface DestinationGuide {
  name: string;
  country: string;
  aliases: string[];
  months: MonthGuide[]; // index 0 = January .. 11 = December
}

const M = (price: PriceLevel, weather: WeatherLevel, summary: string, tempRangeC: [number, number]): MonthGuide => ({ price, weather, summary, tempRangeC });

export const DESTINATION_GUIDES: DestinationGuide[] = [
  {
    name: 'Tokyo', country: 'Japan', aliases: ['tokyo', 'yokohama', 'kanto'],
    months: [
      M('low', 'okay', 'Cold, clear, dry', [4, 10]), M('low', 'okay', 'Cold, clear, dry', [4, 10]),
      M('shoulder', 'good', 'Spring arriving, early blossom', [7, 14]), M('high', 'good', 'Peak cherry blossom, warm', [10, 19]),
      M('high', 'good', 'Warm, Golden Week crowds early month', [15, 22]), M('shoulder', 'okay', 'Rainy season (tsuyu) begins', [20, 25]),
      M('shoulder', 'poor', 'Hot, humid, festival season', [24, 30]), M('shoulder', 'poor', 'Peak heat, O-bon domestic crowds', [25, 31]),
      M('shoulder', 'okay', 'Still warm, typhoon risk', [21, 27]), M('high', 'good', 'Cooling, comfortable, low humidity', [15, 22]),
      M('high', 'good', 'Peak autumn foliage', [9, 16]), M('low', 'okay', 'Cold, dry, quiet', [4, 11]),
    ],
  },
  {
    name: 'Kyoto & Osaka', country: 'Japan', aliases: ['kyoto', 'osaka', 'kansai', 'nara'],
    months: [
      M('low', 'okay', 'Cold, dry, quiet', [3, 9]), M('low', 'okay', 'Cold, dry, quiet', [3, 10]),
      M('shoulder', 'good', 'Spring arriving', [6, 13]), M('high', 'good', 'Peak cherry blossom, warm', [11, 19]),
      M('high', 'good', 'Warm, Golden Week crowds early month', [16, 23]), M('shoulder', 'okay', 'Rainy season begins', [21, 26]),
      M('shoulder', 'poor', 'Hot, humid', [25, 31]), M('shoulder', 'poor', 'Peak heat, landlocked so hotter than Tokyo', [26, 33]),
      M('shoulder', 'okay', 'Still warm, typhoon risk', [22, 28]), M('high', 'good', 'Cooling, comfortable', [16, 23]),
      M('high', 'good', 'Peak autumn foliage, very popular', [9, 17]), M('low', 'okay', 'Cold, colder than Tokyo, dry', [3, 10]),
    ],
  },
  {
    name: 'Okinawa', country: 'Japan', aliases: ['okinawa', 'naha', 'ishigaki', 'miyako'],
    months: [
      M('low', 'okay', 'Mild subtropical winter', [17, 20]), M('low', 'okay', 'Mild, occasional wind', [17, 20]),
      M('shoulder', 'good', 'Warming, good for sightseeing', [18, 22]), M('shoulder', 'good', 'Warm, dry, beach season starting', [21, 25]),
      M('high', 'poor', 'Rainy season arrives (earlier than mainland)', [24, 28]), M('high', 'poor', 'Peak of rainy season, humid', [26, 30]),
      M('high', 'okay', 'Hot, past rainy season, typhoon risk begins', [28, 32]), M('high', 'okay', 'Peak heat, peak domestic beach season, typhoon risk', [28, 32]),
      M('shoulder', 'okay', 'Still warm, typhoon risk continues', [26, 30]), M('shoulder', 'good', 'Beach season winding down, pleasant', [24, 28]),
      M('low', 'good', 'Warm, comfortable, quieter', [21, 25]), M('low', 'okay', 'Mild, quiet', [18, 21]),
    ],
  },
  {
    name: 'Bangkok', country: 'Thailand', aliases: ['bangkok'],
    months: [
      M('high', 'good', 'Cool (relatively), dry, best month', [23, 32]), M('high', 'good', 'Dry, warming up', [24, 33]),
      M('shoulder', 'okay', 'Hot season begins', [26, 35]), M('shoulder', 'okay', 'Very hot, Songkran festival', [27, 35]),
      M('shoulder', 'poor', 'Hot, rains beginning', [26, 34]), M('low', 'poor', 'Rainy season, humid', [25, 33]),
      M('low', 'poor', 'Rainy season continues', [25, 33]), M('low', 'poor', 'Rainy season', [25, 32]),
      M('low', 'poor', 'Wettest month', [24, 32]), M('shoulder', 'okay', 'Rain easing', [24, 32]),
      M('high', 'good', 'Cool season begins, dry', [23, 31]), M('high', 'good', 'Cool, dry, popular', [22, 31]),
    ],
  },
  {
    name: 'Phuket & Andaman coast', country: 'Thailand', aliases: ['phuket', 'krabi', 'phang nga', 'koh lanta'],
    months: [
      M('high', 'good', 'Dry, sunny, best month', [24, 32]), M('high', 'good', 'Dry, sunny', [25, 33]),
      M('shoulder', 'good', 'Still dry, hotter', [25, 34]), M('shoulder', 'okay', 'Hot, Songkran, first showers', [25, 34]),
      M('low', 'poor', 'Green season begins, short showers', [24, 32]), M('low', 'poor', 'Monsoon, rough seas', [24, 31]),
      M('low', 'poor', 'Monsoon continues', [24, 31]), M('low', 'poor', 'Monsoon, rough seas', [24, 31]),
      M('low', 'poor', 'Wettest month, rough seas', [24, 30]), M('low', 'poor', 'Wet, easing later in month', [24, 31]),
      M('high', 'good', 'Dry season returns, calm seas', [24, 31]), M('high', 'good', 'Dry, sunny, peak season', [24, 31]),
    ],
  },
  {
    name: 'Algarve', country: 'Portugal', aliases: ['algarve', 'faro', 'lagos', 'albufeira'],
    months: [
      M('low', 'okay', 'Mild, some rain', [8, 16]), M('low', 'okay', 'Mild, some rain', [9, 17]),
      M('shoulder', 'good', 'Warming, pleasant', [10, 19]), M('shoulder', 'good', 'Warm, sunny', [12, 20]),
      M('shoulder', 'good', 'Warm, dry, great value', [14, 23]), M('high', 'good', 'Hot, dry, peak beach season begins', [17, 27]),
      M('high', 'good', 'Very hot, peak season', [19, 29]), M('high', 'good', 'Very hot, peak season', [19, 29]),
      M('shoulder', 'good', 'Warm, still dry, quieter', [17, 27]), M('shoulder', 'good', 'Mild, pleasant, good value', [14, 23]),
      M('low', 'okay', 'Mild, rain increasing', [11, 19]), M('low', 'okay', 'Mild, wetter', [8, 16]),
    ],
  },
  {
    name: 'Aegean & Mediterranean coast', country: 'Türkiye', aliases: ['bodrum', 'dalaman', 'kemer', 'antalya', 'fethiye', 'marmaris'],
    months: [
      M('low', 'okay', 'Cool, wet, quiet', [6, 14]), M('low', 'okay', 'Cool, wet', [6, 15]),
      M('shoulder', 'good', 'Warming, drier', [9, 18]), M('shoulder', 'good', 'Mild, pleasant', [12, 21]),
      M('shoulder', 'good', 'Warm, dry, great value', [16, 25]), M('high', 'good', 'Hot, dry, peak season begins', [20, 30]),
      M('high', 'good', 'Very hot, peak season', [23, 34]), M('high', 'good', 'Very hot, peak season', [23, 34]),
      M('shoulder', 'good', 'Warm, still dry, sea still warm', [19, 29]), M('shoulder', 'good', 'Mild, good value', [15, 24]),
      M('low', 'okay', 'Cooling, rain returning', [11, 19]), M('low', 'okay', 'Cool, wet', [7, 15]),
    ],
  },
  {
    name: 'Spanish coast & islands', country: 'Spain', aliases: ['ibiza', 'mallorca', 'palma', 'valencia', 'barcelona', 'alicante'],
    months: [
      M('low', 'okay', 'Mild, some rain', [8, 15]), M('low', 'okay', 'Mild', [9, 16]),
      M('shoulder', 'good', 'Warming', [11, 18]), M('shoulder', 'good', 'Pleasant, mild', [13, 20]),
      M('shoulder', 'good', 'Warm, good value', [16, 23]), M('high', 'good', 'Hot, peak season begins', [20, 28]),
      M('high', 'good', 'Very hot, peak season', [23, 30]), M('high', 'good', 'Very hot, peak season', [23, 30]),
      M('shoulder', 'good', 'Warm, quieter, sea still warm', [20, 27]), M('shoulder', 'good', 'Mild, pleasant', [16, 23]),
      M('low', 'okay', 'Cooling, wetter', [11, 18]), M('low', 'okay', 'Mild, wetter', [9, 15]),
    ],
  },
  {
    name: 'Madrid & inland Spain', country: 'Spain', aliases: ['madrid', 'seville', 'toledo'],
    months: [
      M('low', 'okay', 'Cold, dry', [2, 10]), M('low', 'okay', 'Cool, dry', [4, 12]),
      M('shoulder', 'good', 'Mild, pleasant', [6, 16]), M('shoulder', 'good', 'Pleasant, best month', [8, 18]),
      M('shoulder', 'good', 'Warm, very pleasant', [11, 22]), M('shoulder', 'okay', 'Hot, dry', [16, 28]),
      M('low', 'poor', 'Very hot, uncomfortable midday', [19, 33]), M('low', 'poor', 'Very hot', [19, 32]),
      M('shoulder', 'good', 'Cooling, pleasant', [15, 26]), M('high', 'good', 'Mild, ideal', [10, 19]),
      M('low', 'okay', 'Cool, some rain', [5, 13]), M('low', 'okay', 'Cold, dry', [3, 10]),
    ],
  },
  {
    name: 'Greek Islands', country: 'Greece', aliases: ['santorini', 'mykonos', 'crete', 'rhodes', 'corfu', 'athens'],
    months: [
      M('low', 'okay', 'Cool, wet, most closed for season', [9, 14]), M('low', 'okay', 'Cool, wet', [9, 15]),
      M('shoulder', 'good', 'Warming, season starting', [11, 17]), M('shoulder', 'good', 'Pleasant, uncrowded', [14, 20]),
      M('shoulder', 'good', 'Warm, great value', [17, 24]), M('high', 'good', 'Hot, dry, peak season begins', [21, 29]),
      M('high', 'good', 'Very hot, peak season', [23, 31]), M('high', 'good', 'Very hot, peak season', [23, 31]),
      M('shoulder', 'good', 'Warm, sea still warm, quieter', [20, 27]), M('shoulder', 'good', 'Mild, pleasant', [16, 23]),
      M('low', 'okay', 'Cooling, many places closing', [12, 18]), M('low', 'okay', 'Cool, wet, off-season', [10, 15]),
    ],
  },
  {
    name: 'Rome & mainland Italy', country: 'Italy', aliases: ['rome', 'florence', 'venice', 'milan', 'tuscany', 'amalfi'],
    months: [
      M('low', 'okay', 'Cold, some rain', [4, 12]), M('low', 'okay', 'Cool', [5, 13]),
      M('shoulder', 'good', 'Mild, pleasant', [7, 16]), M('shoulder', 'good', 'Pleasant, great for sightseeing', [9, 18]),
      M('shoulder', 'good', 'Warm, ideal', [13, 22]), M('high', 'good', 'Hot, peak season begins', [17, 27]),
      M('high', 'poor', 'Very hot, crowded, many locals leave', [19, 30]), M('high', 'poor', 'Very hot, humid in cities', [19, 30]),
      M('shoulder', 'good', 'Cooling, pleasant, great value', [15, 25]), M('high', 'good', 'Mild, beautiful light', [11, 20]),
      M('low', 'okay', 'Cool, rain', [7, 15]), M('low', 'okay', 'Cold, some rain', [5, 12]),
    ],
  },
  {
    name: 'Dubai', country: 'UAE', aliases: ['dubai', 'abu dhabi'],
    months: [
      M('high', 'good', 'Warm, dry, ideal', [14, 24]), M('high', 'good', 'Warm, pleasant', [15, 25]),
      M('shoulder', 'good', 'Warming, still pleasant', [18, 29]), M('shoulder', 'okay', 'Hot', [22, 34]),
      M('low', 'poor', 'Very hot', [26, 39]), M('low', 'poor', 'Extremely hot, humid', [29, 41]),
      M('low', 'poor', 'Extremely hot, humid, avoid outdoor activity', [30, 41]), M('low', 'poor', 'Extremely hot, humid', [30, 41]),
      M('low', 'poor', 'Still very hot', [27, 39]), M('shoulder', 'okay', 'Cooling, still hot', [23, 35]),
      M('high', 'good', 'Warm, pleasant, season begins', [18, 29]), M('high', 'good', 'Warm, ideal, peak season', [15, 25]),
    ],
  },
  {
    name: 'Maldives', country: 'Maldives', aliases: ['maldives', 'male'],
    months: [
      M('high', 'good', 'Dry season, peak', [25, 30]), M('high', 'good', 'Dry, ideal', [25, 30]),
      M('high', 'good', 'Dry, warm', [26, 31]), M('shoulder', 'okay', 'Transition, occasional rain', [26, 31]),
      M('shoulder', 'poor', 'Wet season begins', [26, 30]), M('low', 'poor', 'Wet, windier', [25, 30]),
      M('low', 'poor', 'Wet season', [25, 30]), M('low', 'poor', 'Wet season', [25, 30]),
      M('low', 'poor', 'Wet, can be rough', [25, 30]), M('shoulder', 'okay', 'Transition, improving', [25, 30]),
      M('shoulder', 'good', 'Drying out', [25, 30]), M('high', 'good', 'Dry season returns, peak', [25, 30]),
    ],
  },
  {
    name: 'Riviera Maya & Cancun', country: 'Mexico', aliases: ['cancun', 'riviera maya', 'tulum', 'playa del carmen', 'kanai'],
    months: [
      M('high', 'good', 'Dry, warm, peak season', [21, 28]), M('high', 'good', 'Dry, ideal', [21, 29]),
      M('high', 'good', 'Warm, dry, spring break crowds', [22, 30]), M('shoulder', 'good', 'Warm, drier', [23, 31]),
      M('shoulder', 'okay', 'Hot, humidity rising', [24, 32]), M('shoulder', 'poor', 'Hot, rain increasing, hurricane season begins', [25, 33]),
      M('low', 'poor', 'Hot, humid, hurricane season', [25, 33]), M('low', 'poor', 'Hot, humid, hurricane season', [25, 33]),
      M('low', 'poor', 'Peak hurricane season risk', [25, 32]), M('low', 'poor', 'Hurricane season, rain', [24, 31]),
      M('shoulder', 'good', 'Drying out, pleasant', [22, 29]), M('high', 'good', 'Dry, cooler, peak season returns', [21, 28]),
    ],
  },
  {
    name: 'Bali', country: 'Indonesia', aliases: ['bali', 'ubud', 'seminyak', 'canggu'],
    months: [
      M('low', 'poor', 'Wet season', [24, 31]), M('low', 'poor', 'Wet season', [24, 31]),
      M('shoulder', 'okay', 'Wet season easing', [24, 31]), M('shoulder', 'good', 'Transition, drying out', [24, 32]),
      M('high', 'good', 'Dry season begins', [23, 31]), M('high', 'good', 'Dry, ideal', [22, 30]),
      M('high', 'good', 'Dry, peak season', [22, 29]), M('high', 'good', 'Dry, peak season', [22, 30]),
      M('high', 'good', 'Dry, excellent', [22, 30]), M('shoulder', 'good', 'Still mostly dry', [23, 31]),
      M('shoulder', 'okay', 'Wet season begins', [23, 31]), M('low', 'poor', 'Wet season', [24, 31]),
    ],
  },
  {
    name: 'Goa', country: 'India', aliases: ['goa'],
    months: [
      M('high', 'good', 'Dry, warm, peak season', [19, 32]), M('high', 'good', 'Dry, warm', [20, 32]),
      M('shoulder', 'okay', 'Hot, dry', [23, 33]), M('low', 'poor', 'Very hot, humid, building to monsoon', [25, 33]),
      M('low', 'poor', 'Very hot, monsoon approaching', [26, 33]), M('low', 'poor', 'Monsoon season', [24, 30]),
      M('low', 'poor', 'Peak monsoon, heavy rain', [23, 28]), M('low', 'poor', 'Monsoon continues', [23, 28]),
      M('shoulder', 'okay', 'Monsoon easing', [23, 29]), M('shoulder', 'good', 'Drying out, pleasant', [23, 31]),
      M('high', 'good', 'Dry, ideal, season begins', [20, 32]), M('high', 'good', 'Dry, peak season', [19, 32]),
    ],
  },
  {
    name: 'Budapest', country: 'Hungary', aliases: ['budapest'],
    months: [
      M('low', 'okay', 'Cold', [-2, 3]), M('low', 'okay', 'Cold', [-1, 6]),
      M('shoulder', 'good', 'Mild, pleasant', [3, 12]), M('shoulder', 'good', 'Pleasant, ideal', [8, 17]),
      M('shoulder', 'good', 'Warm, great', [12, 22]), M('high', 'good', 'Warm, peak season begins', [15, 25]),
      M('high', 'good', 'Hot, peak season', [17, 28]), M('high', 'good', 'Hot, peak season', [17, 27]),
      M('shoulder', 'good', 'Mild, pleasant, thermal baths season', [12, 22]), M('shoulder', 'good', 'Mild, autumn colour', [7, 15]),
      M('low', 'okay', 'Cold, grey', [2, 8]), M('low', 'okay', 'Cold, festive markets', [-1, 4]),
    ],
  },
  {
    name: 'New York', country: 'United States', aliases: ['new york', 'nyc', 'manhattan'],
    months: [
      M('low', 'okay', 'Cold', [-3, 4]), M('low', 'okay', 'Cold', [-2, 6]),
      M('shoulder', 'okay', 'Cold, warming', [2, 11]), M('shoulder', 'good', 'Mild, pleasant', [7, 17]),
      M('high', 'good', 'Warm, ideal', [13, 22]), M('high', 'good', 'Warm, great', [18, 27]),
      M('high', 'okay', 'Hot, humid', [21, 29]), M('high', 'okay', 'Hot, humid', [21, 29]),
      M('high', 'good', 'Warm, comfortable', [17, 25]), M('high', 'good', 'Mild, autumn colour, peak season', [11, 18]),
      M('shoulder', 'okay', 'Cold, grey', [4, 11]), M('high', 'good', 'Cold, festive, holiday peak', [-1, 6]),
    ],
  },
  {
    name: 'Sydney & east coast', country: 'Australia', aliases: ['sydney', 'melbourne', 'brisbane', 'gold coast'],
    months: [
      M('high', 'good', 'Summer, warm, peak season', [19, 26]), M('high', 'good', 'Summer, warm', [19, 26]),
      M('shoulder', 'good', 'Late summer, pleasant', [17, 24]), M('shoulder', 'good', 'Autumn, mild, ideal', [14, 21]),
      M('shoulder', 'good', 'Mild, pleasant', [11, 18]), M('low', 'okay', 'Winter, cool', [9, 16]),
      M('low', 'okay', 'Winter, coolest month', [8, 16]), M('low', 'okay', 'Winter, cool', [9, 17]),
      M('shoulder', 'good', 'Spring, mild', [11, 19]), M('shoulder', 'good', 'Spring, warming', [13, 21]),
      M('high', 'good', 'Late spring, warm', [16, 23]), M('high', 'good', 'Early summer, warm, peak season begins', [18, 25]),
    ],
  },
];

function findGuideByAlias(query: string): DestinationGuide | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return DESTINATION_GUIDES.find((g) => g.aliases.some((a) => q.includes(a) || a.includes(q))) ?? null;
}

export function findDestinationGuide(city: string | null, country: string): DestinationGuide | null {
  if (city) {
    const byCity = findGuideByAlias(city);
    if (byCity) return byCity;
  }
  return findGuideByAlias(country);
}

export function dominantMonth(startDate: string, endDate: string): number {
  const counts = new Array(12).fill(0);
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    counts[d.getUTCMonth()] += 1;
  }
  let best = 0;
  for (let i = 1; i < 12; i++) if (counts[i] > counts[best]) best = i;
  return best;
}

export const PRICE_COLOR: Record<PriceLevel, string> = { high: 'var(--red)', shoulder: 'var(--amber)', low: 'var(--green)' };
export const WEATHER_COLOR: Record<WeatherLevel, string> = { poor: 'var(--red)', okay: 'var(--amber)', good: 'var(--green)' };
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
