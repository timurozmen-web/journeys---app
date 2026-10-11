import { AWARD_CLASSES, type AwardCabin } from '../data/awardClasses';

/**
 * The cabin of an award (points) seat, from the operating airline's code
 * and the booking class letter, or null when that letter is a cash fare
 * on that airline (or the airline's award classes aren't known).
 */
export function awardCabin(airlineCode: string | null | undefined, bookingClass: string | null | undefined): AwardCabin | null {
  if (!airlineCode || !bookingClass) return null;
  const letter = bookingClass.trim().toUpperCase();
  if (letter.length !== 1) return null;
  return AWARD_CLASSES[airlineCode.trim().toUpperCase()]?.[letter] ?? null;
}
