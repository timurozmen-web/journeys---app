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
}

export interface PaymentCard {
  id: string;
  programmeBrand: string;
  annualFee: number;
  feeLabel: string;
  openDate: string;
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
  hotelId: string;
  hotelName: string;
  country: string;
  date: string;
  category: string;
  score: number; // 1–10, derived from the bucket-ranking algorithm
}
