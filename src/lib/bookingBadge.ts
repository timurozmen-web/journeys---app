import type { Hotel, LoyaltyProgramme } from '../types';
import { detectSubBrand } from '../data/brandMap';

// The square badge that leads a stay's card on a trip's itinerary: the
// programme's own colour (as stored with the programme) and the hotel
// brand's initials ("AC" for AC Hotels, "SR" for St. Regis, "W" for W).
// Flights get the same badge in their airline's colour (airlineBadge).
export function hotelBadge(hotel: Hotel, programmes: LoyaltyProgramme[]): { code: string; colour: string | null } {
  const colour = programmes.find((p) => p.name === hotel.brand)?.color ?? null;
  const label = detectSubBrand(hotel.name, hotel.brand ?? undefined) ?? hotel.name;
  const words = label.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  let code: string;
  if (words.length === 1 && words[0].length <= 3) code = words[0];
  else if (words.length >= 2 && words[0].length <= 3 && words[0] === words[0].toUpperCase()) code = words[0];
  else if (words.length >= 2) code = words[0][0] + words[1][0];
  else code = (words[0] ?? '?')[0];
  return { code: code.toUpperCase(), colour };
}
