// Real Supabase queries. Same shape as src/data/mock.ts, so components
// don't need to change when they switch from mock data to this.
import { supabase } from './supabase';
import type { Trip, Hotel, Flight, LoyaltyProgramme, PaymentCard, Review } from '../types';

export async function fetchTrips(): Promise<Trip[]> {
  const { data: trips, error } = await supabase.from('trips').select('*');
  if (error) throw error;
  const { data: hotels } = await supabase.from('hotels').select('*');
  const { data: flights } = await supabase.from('flights').select('*');

  return (trips ?? []).map((t): Trip => ({
    id: t.id,
    title: t.title,
    start: t.start_date,
    end: t.end_date,
    section: t.section,
    notes: t.notes ?? '',
    heroImageUrl: t.hero_image_url,
    hotels: (hotels ?? []).filter((h) => h.trip_id === t.id).map(mapHotel),
    flights: (flights ?? []).filter((f) => f.trip_id === t.id).map(mapFlight),
  }));
}

function mapHotel(h: any): Hotel {
  return {
    id: h.id, name: h.name, country: h.country, brand: h.brand, tier: h.tier,
    nights: h.nights, date: h.date, status: h.status, total: h.total,
    nightlyRate: h.nightly_rate, avgRate: h.avg_rate, sqm: h.sqm, card: h.card,
    category: h.category, lat: h.lat, lng: h.lng,
  };
}
function mapFlight(f: any): Flight {
  return {
    id: f.id, date: f.date, from: f.from, via: f.via ?? [], to: f.to,
    airline: f.airline, flightNo: f.flight_no, cabin: f.cabin, status: f.status,
    cost: f.cost, award: f.award,
  };
}

export async function fetchLoyaltyProgrammes(): Promise<LoyaltyProgramme[]> {
  const { data, error } = await supabase.from('loyalty_programmes').select('*');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    name: p.name, abbr: p.abbr, points: p.points, ptValue: p.pt_value,
    color: p.color, accent: p.accent, font: p.font, shape: p.shape,
    tier: p.tier, nextTier: p.next_tier, nights: p.nights, nightsNeeded: p.nights_needed,
  }));
}

export async function fetchPaymentCards(): Promise<PaymentCard[]> {
  const { data, error } = await supabase.from('payment_cards').select('*');
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id, programmeBrand: c.programme_brand, annualFee: c.annual_fee,
    feeLabel: c.fee_label, openDate: c.open_date,
  }));
}

export async function fetchReviews(): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select('*').order('score', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    hotelId: r.hotel_id, hotelName: r.hotel_name, country: r.country, date: r.date, score: r.score,
  }));
}
