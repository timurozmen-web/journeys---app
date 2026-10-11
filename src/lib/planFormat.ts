// Small display helpers for Plan a trip, kept out of the screen file.

// Anything over an hour rounds to the nearest 15 minutes -- a formula
// estimate has no business claiming false precision like "12h 46m";
// under an hour, exact minutes are kept since that level of precision
// is normal for a short local hop.
export function formatHours(h: number): string {
  const totalMins = h * 60;
  const rounded = totalMins > 60 ? Math.round(totalMins / 15) * 15 : Math.round(totalMins);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

// No hotel loyalty programme, dynamic or fixed-chart, actually prices a
// night at an exact figure like 58,434 points -- Hyatt's real chart
// values land on round 500-multiples (3,500, 6,500, 40,000, etc.) and
// the dynamic programmes (Marriott, Hilton, IHG) round to similarly
// clean numbers in practice. Snapping the estimate to the nearest 500
// reads as a realistic figure instead of false formula precision.
export function roundPointsEstimate(points: number): number {
  return Math.round(points / 500) * 500;
}

// Several airports in the dataset are genuine dual-use civilian/military
// fields (Komatsu, Nagoya-Komaki, etc.) named with a "/ JASDF ... Air
// Base" or similar suffix -- accurate for an aviation reference, but
// alarming and irrelevant to a traveller booking a real commercial
// flight. Strips that back to the plain civilian name actually used for
// booking and check-in.
export function civilianAirportName(name: string): string {
  return name.split(' / ')[0];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2–6 Apr", or "29 Apr – 3 May" across a month end, for a stop's stay.
export function stayRange(checkIn: string, checkOut: string): string {
  const [, m1, d1] = checkIn.split('-').map(Number);
  const [, m2, d2] = checkOut.split('-').map(Number);
  return m1 === m2 ? `${d1}–${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
}

// Programme names short enough to sit side by side ("Marriott", "Hyatt").
export function shortProgramme(name: string): string {
  return name.replace('World of ', '').replace(' Bonvoy', '').replace(' Honors', '').replace(' One Rewards', '').replace(' ALL', '');
}
