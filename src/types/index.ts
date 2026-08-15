// Core domain types. These map almost 1:1 onto Supabase tables later —
// designing them properly now means the database migration is mechanical,
// not a redesign.

export interface Hotel {
  id: string;
  name: string;
  country: string;
  city: string | null;
  brand: string;
  tier?: string;
  nights: number;
  date: string; // ISO date
  status: 'Completed' | 'Booked' | 'needs-confirm';
  total: number | null;
  nightlyRate: number | null;
  avgRate: number | null;
  sqm: number | null;
  card: string | null;
  category: 'Luxury' | 'Premium' | 'Midscale' | 'Budget';
  lat: number;
  lng: number;
  benefitValue: number | null; // £ value of upgrades/perks received, e.g. free breakfast, suite upgrade
  benefitNote: string | null; // what the benefit actually was
  bookingChannel: string | null; // e.g. 'Expedia' — which OTA/channel this was booked through, if not direct
  roomType: string | null;
  rateType: string | null; // 'Standard' | 'Member' | 'Promotional' | 'Non-refundable' | 'Other'
}

export interface Flight {
  id: string;
  date: string | null;
  from: string;
  via: string[];
  to: string;
  airline: string;
  flightNo: string | null;
  cabin: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  status: 'Completed' | 'Booked';
  cost: number | null;
  award: boolean;
  overnight: boolean; // true if this flight itself covers a night (long-haul, no hotel needed that night)
}

export interface LoyaltyProgramme {
  name: string;
  abbr: string;
  points: number;
  ptValue: number; // pence per point
  color: string;
  accent: string;
  font: string;
  shape: string;
  tier?: string;
  nextTier?: string;
  nights?: number;
  nightsNeeded?: number;
  nightsBaselineDate?: string | null; // nights count is accurate as of this date; only Completed stays after it add on top live
  category: 'hotel' | 'airline';
}

export interface PaymentCard {
  id: string;
  programmeBrand: string;
  annualFee: number;
  feeLabel: string;
  openDate: string;
  manualSpendAdjustment: number; // spend not captured by logged hotels/flights (everyday purchases etc)
  manualSpendIsUK: boolean; // whether that manual spend was in the UK, since earning rates differ
  closedDate: string | null; // set once the card has been closed -- moves it into the archived section
}

export interface Trip {
  id: string;
  title: string;
  start: string;
  end: string;
  section: 'current' | 'upcoming' | 'past';
  tripType: 'work' | 'leisure';
  hotels: Hotel[];
  flights: Flight[];
  notes: string;
  heroImageUrl: string | null; // real photo, once storage exists
}

export interface Review {
  id: string;
  hotelId: string | null;
  hotelName: string;
  country: string;
  date: string;
  category: string;
  score: number; // 1–10, derived from the bucket-ranking algorithm
}

export interface Voucher {
  id: string;
  name: string;
  source: string;
  value: number | null;
  earnedDate: string;
  expiryDate: string | null;
  redeemed: boolean;
  redeemedDate: string | null;
  sourceKey: string | null; // stable key for auto-synced card vouchers, prevents duplicate creation
}

export type PromoType = 'multiplier' | 'threshold_bonus' | 'fixed_discount' | 'status_boost' | 'airline_partner' | 'other';

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  startDate: string | null;
  endDate: string | null;
  promoType: PromoType | null;
  multiplier: number | null; // e.g. 2 for "2x points"
  thresholdSpend: number | null; // £ needed to earn bonus_points
  bonusPoints: number | null;
  discountValue: number | null; // £ off
  discountUsed: boolean;
  statusNightsBonus: number | null;
  statusNightsApplied: boolean; // has the qualifying stay happened
  partnerAirline: string | null; // for airline_partner type -- which airline programme also earns
}
