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
    tripType: (t.trip_type as 'work' | 'leisure') ?? 'leisure',
    notes: t.notes ?? '',
    heroImageUrl: t.hero_image_url,
    hotels: (hotels ?? []).filter((h) => h.trip_id === t.id).map(mapHotel),
    flights: (flights ?? []).filter((f) => f.trip_id === t.id).map(mapFlight),
  }));
}

function computeSection(start: string, end: string, today: string): 'current' | 'upcoming' | 'past' {
  if (start <= today && today <= end) return 'current';
  if (start > today) return 'upcoming';
  return 'past';
}

export interface NewTripInput {
  title: string;
  start: string;
  end: string;
  tripType: 'work' | 'leisure';
  notes: string;
}

export async function addTrip(input: NewTripInput): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('trips')
    .insert({
      title: input.title, start_date: input.start, end_date: input.end,
      section: computeSection(input.start, input.end, today),
      trip_type: input.tripType, notes: input.notes,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateTrip(id: string, input: NewTripInput) {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('trips')
    .update({
      title: input.title, start_date: input.start, end_date: input.end,
      section: computeSection(input.start, input.end, today),
      trip_type: input.tripType, notes: input.notes,
    })
    .eq('id', id);
  if (error) throw error;
}

function mapHotel(h: any): Hotel {
  return {
    id: h.id, name: h.name, country: h.country, city: h.city ?? null, brand: h.brand, tier: h.tier,
    nights: h.nights, date: h.date, status: h.status, total: h.total,
    nightlyRate: h.nightly_rate, avgRate: h.avg_rate, sqm: h.sqm, card: h.card,
    category: h.category, lat: h.lat, lng: h.lng,
    benefitValue: h.benefit_value ?? null, benefitNote: h.benefit_note ?? null,
    bookingChannel: h.booking_channel ?? null,
  };
}
function mapFlight(f: any): Flight {
  return {
    id: f.id, date: f.date, from: f.from, via: f.via ?? [], to: f.to,
    airline: f.airline, flightNo: f.flight_no, cabin: f.cabin, status: f.status,
    cost: f.cost, award: f.award, overnight: f.overnight ?? false,
  };
}

export async function fetchAllHotels(): Promise<Hotel[]> {
  const { data, error } = await supabase.from('hotels').select('*');
  if (error) throw error;
  return (data ?? []).map(mapHotel);
}

export async function fetchAllFlights(): Promise<Flight[]> {
  const { data, error } = await supabase.from('flights').select('*');
  if (error) throw error;
  return (data ?? []).map(mapFlight);
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
    hotelId: r.hotel_id, hotelName: r.hotel_name, country: r.country, date: r.date, category: r.category ?? 'overall', score: r.score,
  }));
}

/* Uploads a photo to the `trip-photos` bucket under the signed-in user's own
   folder (required by the storage RLS policy), then saves the public URL
   against the trip. Returns the URL so the UI can show it immediately
   without waiting for a refetch. */
export async function uploadTripPhoto(tripId: string, file: File): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Not signed in');

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userData.user.id}/${tripId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('trip-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('trip-photos').getPublicUrl(path);
  const url = urlData.publicUrl;

  const { error: updateError } = await supabase.from('trips').update({ hero_image_url: url }).eq('id', tripId);
  if (updateError) throw updateError;

  return url;
}

export interface NewHotelInput {
  name: string; country: string; city: string | null; brand: string; tier?: string;
  nights: number; date: string; status: 'Completed' | 'Booked' | 'needs-confirm';
  total: number | null; card: string | null; category: 'Luxury' | 'Premium' | 'Midscale' | 'Budget';
  tripId: string | null; benefitValue: number | null; benefitNote: string | null;
  bookingChannel: string | null;
}
export async function addHotel(input: NewHotelInput) {
  const { error } = await supabase.from('hotels').insert({
    name: input.name, country: input.country, city: input.city, brand: input.brand, tier: input.tier || null,
    nights: input.nights, date: input.date, status: input.status, total: input.total,
    card: input.card, category: input.category, trip_id: input.tripId,
    benefit_value: input.benefitValue, benefit_note: input.benefitNote, booking_channel: input.bookingChannel,
  });
  if (error) throw error;
}

export async function updateHotel(id: string, input: NewHotelInput) {
  const { error } = await supabase.from('hotels').update({
    name: input.name, country: input.country, city: input.city, brand: input.brand, tier: input.tier || null,
    nights: input.nights, date: input.date, status: input.status, total: input.total,
    card: input.card, category: input.category, trip_id: input.tripId,
    benefit_value: input.benefitValue, benefit_note: input.benefitNote, booking_channel: input.bookingChannel,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteHotel(id: string) {
  const { error } = await supabase.from('hotels').delete().eq('id', id);
  if (error) throw error;
}

export interface NewFlightInput {
  date: string; from: string; to: string; airline: string; flightNo: string | null;
  cabin: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  status: 'Completed' | 'Booked'; cost: number | null; award: boolean; overnight: boolean;
  tripId: string | null;
}
export async function addFlight(input: NewFlightInput) {
  const { error } = await supabase.from('flights').insert({
    date: input.date, from: input.from.toUpperCase(), to: input.to.toUpperCase(),
    airline: input.airline, flight_no: input.flightNo, cabin: input.cabin,
    status: input.status, cost: input.cost, award: input.award, overnight: input.overnight, trip_id: input.tripId,
  });
  if (error) throw error;
}

export async function updateFlight(id: string, input: NewFlightInput) {
  const { error } = await supabase.from('flights').update({
    date: input.date, from: input.from.toUpperCase(), to: input.to.toUpperCase(),
    airline: input.airline, flight_no: input.flightNo, cabin: input.cabin,
    status: input.status, cost: input.cost, award: input.award, overnight: input.overnight, trip_id: input.tripId,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteFlight(id: string) {
  const { error } = await supabase.from('flights').delete().eq('id', id);
  if (error) throw error;
}
