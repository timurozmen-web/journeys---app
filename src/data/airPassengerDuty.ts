// UK Air Passenger Duty: the one tax on a flight from the UK that is
// known exactly in advance. It's charged per passenger on departure from
// a UK airport (not on the way home), on cash and points tickets alike.
//
// Rates per gov.uk, "Air Passenger Duty: rates from 1 April 2026 to 31
// March 2027" and the 2027-28 table on "Rates for Air Passenger Duty",
// checked 18 Oct 2026. Reduced rate: the lowest class on the aircraft
// (economy). Standard rate: any other class (premium economy, business,
// first). The higher rate is for private jets and isn't used here.
//
// Bands (gov.uk, "Rates for Air Passenger Duty"): until 31 March 2023
// there were two, A up to 2,000 miles and B for everything else. Since
// 1 April 2023 there are four: domestic, then A, B and C. A is a list,
// not a distance: every EU and EEA country plus the places gov.uk names
// below. B is the places 2,001-5,500 miles from London (capital to
// capital), C everything further.

export type ApdBand = 'domestic' | 'A' | 'B' | 'C';

interface ApdRates { from: string; reduced: Record<ApdBand, number>; standard: Record<ApdBand, number> }

export const APD_RATES: ApdRates[] = [
  { from: '2026-04-01', reduced: { domestic: 8, A: 15, B: 102, C: 106 }, standard: { domestic: 16, A: 32, B: 244, C: 253 } },
  { from: '2027-04-01', reduced: { domestic: 8.26, A: 15.49, B: 105.33, C: 109.46 }, standard: { domestic: 16.52, A: 33.04, B: 251.95, C: 261.25 } },
];

// Band A: the EU and EEA, and the extra places gov.uk lists (checked 18
// Oct 2026 via search results quoting its Band A table). Russia is only
// in A west of the Urals, so it's left out rather than guessed.
export const APD_BAND_A = new Set([
  // EU
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France',
  'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland',
  'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
  // EEA
  'Iceland', 'Liechtenstein', 'Norway',
  // Named by gov.uk
  'Albania', 'Algeria', 'Andorra', 'Belarus', 'Bosnia and Herzegovina', 'Faroe Islands', 'Gibraltar', 'Greenland', 'Kosovo',
  'Libya', 'Moldova', 'Monaco', 'Montenegro', 'Morocco', 'North Macedonia', 'San Marino', 'Serbia', 'Switzerland', 'Tunisia',
  'Turkey', 'Türkiye', 'Ukraine', 'Guernsey', 'Jersey', 'Isle of Man',
]);

// B or C where gov.uk states it outright, for capitals close to the
// 5,500-mile edge: worked out here, Seoul came to 5,504 miles (C) but
// gov.uk lists South Korea in B. Brazil, Costa Rica and Sri Lanka are in
// its Band B table; South Africa is beyond 5,500 miles (secondary source
// placing it with Japan and Singapore). Checked 18 Oct 2026.
export const APD_BAND_LISTED: Record<string, ApdBand> = {
  'South Korea': 'B', Brazil: 'B', 'Costa Rica': 'B', 'Sri Lanka': 'B', 'South Africa': 'C',
};

// Places whose band depends on where in them you land: Russia is A west
// of the Urals only. No band rather than a guess.
export const APD_BAND_DEPENDS = new Set(['Russia']);

// Within this many miles of 5,500, a distance worked out here (on a
// sphere, from central London) isn't trusted to land on the same side
// as gov.uk's: no band rather than a possibly wrong one.
export const APD_EDGE_MILES = 40;

// Capitals as [lat, lng], to two decimals, for working out the band.
// Countries not listed get no band (and no APD figure) rather than a
// guess from whichever city is being visited.
export const CAPITALS: Record<string, [number, number]> = {
  Afghanistan: [34.53, 69.17], Albania: [41.33, 19.82], Algeria: [36.75, 3.06], Andorra: [42.51, 1.52], Angola: [-8.84, 13.23],
  'Antigua and Barbuda': [17.12, -61.85], Argentina: [-34.6, -58.38], Armenia: [40.18, 44.51], Aruba: [12.52, -70.03],
  Australia: [-35.28, 149.13], Austria: [48.21, 16.37], Azerbaijan: [40.41, 49.87], Bahamas: [25.05, -77.35], Bahrain: [26.23, 50.59],
  Bangladesh: [23.81, 90.41], Barbados: [13.1, -59.62], Belarus: [53.9, 27.57], Belgium: [50.85, 4.35], Belize: [17.25, -88.77],
  Bermuda: [32.29, -64.78], Bhutan: [27.47, 89.64], Bolivia: [-16.5, -68.15], 'Bosnia and Herzegovina': [43.86, 18.41],
  Botswana: [-24.65, 25.91], Brazil: [-15.79, -47.88], Brunei: [4.9, 114.94], Bulgaria: [42.7, 23.32], Cambodia: [11.56, 104.92],
  Canada: [45.42, -75.7], 'Cape Verde': [14.93, -23.51], 'Cayman Islands': [19.29, -81.37], Chile: [-33.45, -70.67], China: [39.9, 116.41],
  Colombia: [4.71, -74.07], 'Costa Rica': [9.93, -84.09], Croatia: [45.81, 15.98], Cuba: [23.11, -82.37], 'Curaçao': [12.11, -68.93],
  Cyprus: [35.19, 33.38], 'Czech Republic': [50.08, 14.44], Denmark: [55.68, 12.57], Dominica: [15.3, -61.39], 'Dominican Republic': [18.49, -69.93],
  Ecuador: [-0.18, -78.47], Egypt: [30.04, 31.24], 'El Salvador': [13.69, -89.22], Estonia: [59.44, 24.75], Ethiopia: [9.03, 38.74],
  Fiji: [-18.14, 178.44], Finland: [60.17, 24.94], France: [48.86, 2.35], 'French Polynesia': [-17.53, -149.57], Georgia: [41.72, 44.79],
  Germany: [52.52, 13.4], Ghana: [5.6, -0.19], Gibraltar: [36.14, -5.35], Greece: [37.98, 23.73], Greenland: [64.18, -51.72],
  Grenada: [12.06, -61.75], Guatemala: [14.63, -90.51], Honduras: [14.07, -87.19], 'Hong Kong': [22.32, 114.17], Hungary: [47.5, 19.04],
  Iceland: [64.15, -21.94], India: [28.61, 77.21], Indonesia: [-6.21, 106.85], Iran: [35.69, 51.39], Iraq: [33.31, 44.37],
  Ireland: [53.35, -6.26], Israel: [31.77, 35.21], Italy: [41.9, 12.5], Jamaica: [18.02, -76.8], Japan: [35.68, 139.69],
  Jordan: [31.95, 35.93], Kazakhstan: [51.17, 71.45], Kenya: [-1.29, 36.82], Kuwait: [29.38, 47.99], Kyrgyzstan: [42.87, 74.59],
  Laos: [17.98, 102.63], Latvia: [56.95, 24.11], Lebanon: [33.89, 35.5], Lithuania: [54.69, 25.28], Luxembourg: [49.61, 6.13],
  Macau: [22.2, 113.54], Madagascar: [-18.88, 47.51], Malawi: [-13.96, 33.79], Malaysia: [3.14, 101.69], Maldives: [4.18, 73.51],
  Malta: [35.9, 14.51], Mauritius: [-20.16, 57.5], Mexico: [19.43, -99.13], Moldova: [47.01, 28.86], Monaco: [43.74, 7.42],
  Mongolia: [47.89, 106.91], Montenegro: [42.44, 19.26], Morocco: [34.02, -6.83], Mozambique: [-25.97, 32.57], Myanmar: [19.76, 96.08],
  Namibia: [-22.56, 17.08], Nepal: [27.72, 85.32], Netherlands: [52.37, 4.9], 'New Caledonia': [-22.28, 166.46], 'New Zealand': [-41.29, 174.78],
  Nicaragua: [12.11, -86.24], Nigeria: [9.08, 7.4], 'North Macedonia': [42.0, 21.43], Norway: [59.91, 10.75], Oman: [23.59, 58.41],
  Pakistan: [33.68, 73.05], Panama: [8.98, -79.52], 'Papua New Guinea': [-9.44, 147.18], Paraguay: [-25.26, -57.58], Peru: [-12.05, -77.04],
  Philippines: [14.6, 120.98], Poland: [52.23, 21.01], Portugal: [38.72, -9.14], 'Puerto Rico': [18.47, -66.11], Qatar: [25.29, 51.53],
  Romania: [44.43, 26.1], Russia: [55.76, 37.62], Rwanda: [-1.94, 30.06], 'Saint Lucia': [14.01, -60.99], Samoa: [-13.83, -171.76],
  'Saudi Arabia': [24.71, 46.68], Senegal: [14.72, -17.47], Serbia: [44.79, 20.45], Seychelles: [-4.62, 55.45], Singapore: [1.29, 103.85],
  Slovakia: [48.15, 17.11], Slovenia: [46.06, 14.51], 'South Africa': [-25.75, 28.19], 'South Korea': [37.57, 126.98], Spain: [40.42, -3.7],
  'Sri Lanka': [6.93, 79.86], Sweden: [59.33, 18.07], Switzerland: [46.95, 7.45], Taiwan: [25.03, 121.57], Tanzania: [-6.16, 35.75],
  Thailand: [13.76, 100.5], 'Trinidad and Tobago': [10.65, -61.51], Tunisia: [36.81, 10.18], Turkey: [39.93, 32.86], 'Türkiye': [39.93, 32.86],
  'Turks and Caicos Islands': [21.46, -71.14], Uganda: [0.35, 32.58], Ukraine: [50.45, 30.52], 'United Arab Emirates': [24.45, 54.38],
  UAE: [24.45, 54.38], 'United States': [38.91, -77.04], 'United States of America': [38.91, -77.04], Uruguay: [-34.9, -56.16],
  Uzbekistan: [41.3, 69.24], Vanuatu: [-17.73, 168.32], Venezuela: [10.48, -66.9], Vietnam: [21.03, 105.85], Zambia: [-15.39, 28.32],
  Zimbabwe: [-17.83, 31.05],
};
