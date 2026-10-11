import { normalizeBrand } from '../data/brandMap';
import { airlineBadge } from '../data/airlineBrand';
import { awardCabin } from './fareClass';

export interface ExtractedBooking {
  type: 'hotel' | 'flight';
  [key: string]: unknown;
}

export interface ReturnTo { pathname: string; state?: unknown }

export function summarizeBooking(b: ExtractedBooking): string {
  if (b.type === 'hotel') return `${b.name ?? 'Hotel'} · ${b.checkIn ?? 'date unknown'}${b.nights ? ` · ${b.nights}n` : ''}`;
  return `${b.airline ?? 'Flight'} ${b.from ?? '?'} → ${b.to ?? '?'} · ${b.date ?? 'date unknown'}`;
}

// Where an extracted booking goes to be reviewed: the matching form,
// prefilled, attached to the trip it was imported for (if any). Shared by
// email and calendar import so both land in the same place.
export function bookingRoute(b: ExtractedBooking, ctx: { tripId?: string; returnTo?: ReturnTo } = {}): { to: string; state: Record<string, unknown> } {
  const extractNote = b.currency && b.currency !== 'GBP' ? `Detected amount was in ${b.currency}, worth double-checking the £ figure.` : undefined;
  if (b.type === 'hotel') {
    return {
      to: '/log-hotel',
      state: {
        prefill: {
          name: b.name, country: b.country, city: b.city, brand: b.brand ? normalizeBrand(b.brand as string) : null,
          date: b.checkIn, nights: b.nights, total: b.total,
          roomType: b.roomType ?? null, rateType: b.rateType ?? 'Standard',
        },
        extractNote, tripId: ctx.tripId, returnTo: ctx.returnTo,
      },
    };
  }
  // The booking class says whether a seat was bought with points: a Qatar
  // "U" is a business award, where on LOT the same letter is a cash fare.
  const code = airlineBadge((b.flightNo as string) ?? null, (b.airline as string) ?? null).code;
  const award = awardCabin(code, b.bookingClass as string | null);
  return {
    to: '/log-flight',
    state: {
      prefill: {
        date: b.date, from: b.from, to: b.to, airline: b.airline, flightNo: b.flightNo,
        cabin: award ?? b.cabin, cost: b.cost, award: award != null || b.award === true,
      },
      extractNote, tripId: ctx.tripId, returnTo: ctx.returnTo,
    },
  };
}
