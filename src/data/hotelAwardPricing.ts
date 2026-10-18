// How each hotel programme prices a free night in points, as it actually
// works, rather than one average value per point for all of them.
// Checked 18 Oct 2026.

export type HotelPricing =
  // Points are money off: a fixed amount of points per euro of the stay.
  | { kind: 'fixed-value'; pointsPerBlock: number; eurPerBlock: number }
  // A published chart: categories, each priced at five levels by date.
  | { kind: 'chart'; categories: Record<number, [number, number, number, number, number]> }
  // Priced by the hotel each night, tracking its cash rate; `cap` is the
  // most a standard room can cost, where the programme states one.
  | { kind: 'dynamic'; cap: number | null };

export const HYATT_LEVELS = ['Lowest', 'Low', 'Moderate', 'Upper', 'Top'] as const;

export const HOTEL_PRICING: Record<string, HotelPricing> = {
  // ALL Accor: 2,000 points always take €40 off a stay, at any Accor hotel,
  // any night, used in blocks of 2,000 (dailydrop.com, Award Travel Finder;
  // points_value_data's Accor row, confidence High).
  'Accor ALL': { kind: 'fixed-value', pointsPerBlock: 2000, eurPerBlock: 40 },

  // World of Hyatt: still a fixed chart, eight categories, five price
  // levels from 20 May 2026 (standard room, per night). High Earner
  // Playbook's table; the Category 1 row matches Upgraded Points, Category
  // 6's 20,000-40,000 and Category 8's 75,000 top match NerdWallet,
  // Category 4 Moderate matches Milesopedia. Hyatt sets one level per
  // hotel per night for the year and doesn't publish which nights are
  // which, saying few nights will be Upper or Top in 2026.
  'World of Hyatt': {
    kind: 'chart',
    categories: {
      1: [3000, 4500, 6000, 7500, 9000],
      2: [6000, 7500, 10000, 12000, 15000],
      3: [8000, 12000, 15000, 17500, 20000],
      4: [12000, 15000, 20000, 22500, 25000],
      5: [15000, 20000, 25000, 30000, 35000],
      6: [20000, 25000, 30000, 35000, 40000],
      7: [25000, 30000, 35000, 45000, 55000],
      8: [35000, 45000, 55000, 65000, 75000],
    },
  },

  // Marriott Bonvoy: no chart since 29 March 2022, and from 2023 no limits:
  // prices follow the hotel's cash rate (Head for Points, One Mile at a
  // Time, Oct 2021 announcement coverage). No cap.
  'Marriott Bonvoy': { kind: 'dynamic', cap: null },

  // IHG One Rewards: dynamic, and its terms publish no floor or ceiling
  // ("may vary according to... brand, hotel, and day of week"). No cap.
  'IHG One Rewards': { kind: 'dynamic', cap: null },

  // Hilton Honors: dynamic, each hotel with its own unpublished maximum;
  // standard rooms top out at 250,000 points since September 2025
  // (AwardWallet, High Earner Playbook).
  'Hilton Honors': { kind: 'dynamic', cap: 250000 },
};
