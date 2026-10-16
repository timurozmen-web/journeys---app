import { normalizeBrand } from '../data/brandMap';
import { airlineBadge } from '../data/airlineBrand';
import { awardCabin } from './fareClass';

export interface ExtractedBooking {
  type: 'hotel' | 'flight';
  [key: string]: unknown;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d: unknown) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}` : null);

/** A found booking as a list row: "W Budapest" over "23 Oct · 2 nights". */
export function summarizeBooking(b: ExtractedBooking): { title: string; sub: string } {
  if (b.type === 'hotel') {
    const nights = typeof b.nights === 'number' ? `${b.nights} night${b.nights === 1 ? '' : 's'}` : null;
    return { title: (b.name as string) ?? 'Hotel', sub: [shortDate(b.checkIn) ?? 'No date', nights].filter(Boolean).join(' · ') };
  }
  return {
    title: `${(b.flightNo as string) ?? (b.airline as string) ?? 'Flight'} · ${(b.from as string) ?? '?'} → ${(b.to as string) ?? '?'}`,
    sub: [shortDate(b.date) ?? 'No date', b.flightNo ? (b.airline as string) : null].filter(Boolean).join(' · '),
  };
}

// Where an extracted booking goes to be reviewed: the matching form,
// prefilled, attached to the trip it was imported for (if any). Shared by
// email and calendar import so both land in the same place.
export function bookingRoute(b: ExtractedBooking, ctx: { tripId?: string } = {}): { to: string; state: Record<string, unknown> } {
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
        extractNote, tripId: ctx.tripId,
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
      extractNote, tripId: ctx.tripId,
    },
  };
}
