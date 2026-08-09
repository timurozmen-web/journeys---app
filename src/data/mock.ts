// Stand-in for what Supabase will return once Phase 2 is wired up.
// Same shape as the real query results — swapping this for a real
// `supabase.from('trips').select()` call later is mechanical, not a rewrite.
import type { Trip, LoyaltyProgramme, PaymentCard, Review } from '../types';

export const trips: Trip[] = [
  {
    id: 'tr1', title: 'Türkiye', start: '2026-07-25', end: '2026-08-15', section: 'current',
    notes: 'Kemer check-in from 3pm — flag Titanium status on arrival.', heroImageUrl: null,
    hotels: [
      { id: 'h1', name: 'Hilton Dalaman', country: 'Türkiye', brand: 'Hilton Honors', nights: 3, date: '2026-07-25', status: 'Completed', total: 480, nightlyRate: 160, avgRate: 190, sqm: null, card: 'Hilton Debit', category: 'Premium', lat: 36.7, lng: 28.8, benefitValue: null, benefitNote: null },
      { id: 'h2', name: 'Maxx Royal Kemer', country: 'Türkiye', brand: 'Independent', nights: 3, date: '2026-08-04', status: 'Booked', total: 890, nightlyRate: 296, avgRate: 340, sqm: null, card: null, category: 'Luxury', lat: 36.5, lng: 30.5, benefitValue: null, benefitNote: null },
      { id: 'h3', name: 'Maxx Royal Bodrum', country: 'Türkiye', brand: 'Independent', nights: 2, date: '2026-08-13', status: 'Booked', total: 620, nightlyRate: 310, avgRate: 350, sqm: null, card: null, category: 'Luxury', lat: 37.0, lng: 27.4, benefitValue: null, benefitNote: null },
    ],
    flights: [
      { id: 'f1', date: '2026-07-25', from: 'LGW', via: [], to: 'DLM', airline: 'easyJet', flightNo: 'U2 8565', cabin: 'Economy', status: 'Completed', cost: 180, award: false },
      { id: 'f2', date: '2026-08-15', from: 'BJV', via: [], to: 'LTN', airline: 'easyJet', flightNo: 'U2 2554', cabin: 'Economy', status: 'Booked', cost: 210, award: false },
    ],
  },
  {
    id: 'tr2', title: 'India · Spain', start: '2027-01-16', end: '2027-01-23', section: 'upcoming',
    notes: '', heroImageUrl: null, hotels: [], flights: [],
  },
  {
    id: 'tr3', title: 'Australia · Indonesia +2', start: '2026-05-03', end: '2026-06-01', section: 'past',
    notes: '', heroImageUrl: null, hotels: [], flights: [],
  },
  {
    id: 'tr4', title: 'Canada', start: '2026-04-09', end: '2026-04-14', section: 'past',
    notes: '', heroImageUrl: null, hotels: [], flights: [],
  },
];

export const loyaltyProgrammes: LoyaltyProgramme[] = [
  { name: 'Marriott Bonvoy', abbr: 'MA', points: 415343, ptValue: 0.5, color: '#5B2245', accent: '#D8B673', font: "'Playfair Display', serif", shape: 'crown', tier: 'Titanium Elite', nextTier: 'Ambassador', nights: 77, nightsNeeded: 23 },
  { name: 'Avios', abbr: 'AV', points: 67309, ptValue: 1, color: '#1544A6', accent: '#AFC4EE', font: "'DM Sans', sans-serif", shape: 'wing' },
  { name: 'Hilton Honors', abbr: 'HI', points: 63963, ptValue: 0.4, color: '#0B4F9C', accent: '#BFD9F2', font: "'Poppins', sans-serif", shape: 'shield', tier: 'Gold', nextTier: 'Diamond', nights: 0, nightsNeeded: 30 },
  { name: 'Virgin Points', abbr: 'VI', points: 24005, ptValue: 1, color: '#C8102E', accent: '#FFE5E5', font: "'Yellowtail', cursive", shape: 'arrowUp' },
  { name: 'Accor ALL', abbr: 'AC', points: 7157, ptValue: 1.72, color: '#7A2856', accent: '#F0B3C8', font: "'Space Grotesk', sans-serif", shape: 'orbit', tier: 'Gold', nextTier: 'Platinum', nights: 31, nightsNeeded: 29 },
  { name: 'Singapore KrisFlyer', abbr: 'SI', points: 7553, ptValue: 1.2, color: '#0A2240', accent: '#C6A15B', font: "'Marcellus', serif", shape: 'bird' },
  { name: 'Qantas Points', abbr: 'QA', points: 2460, ptValue: 1, color: '#D2001F', accent: '#FFFFFF', font: "'Barlow Semi Condensed', sans-serif", shape: 'starCompass' },
  { name: 'World of Hyatt', abbr: 'WO', points: 0, ptValue: 1.5, color: '#0F2B46', accent: '#C6A15B', font: "'Jost', sans-serif", shape: 'gem', tier: 'Member', nextTier: 'Discoverist', nights: 0, nightsNeeded: 10 },
  { name: 'IHG One Rewards', abbr: 'IH', points: 0, ptValue: 0.45, color: '#4A2F6B', accent: '#D8C9EE', font: "'Manrope', sans-serif", shape: 'compass', tier: 'Member', nextTier: 'Silver Elite', nights: 0, nightsNeeded: 10 },
];

export const paymentCards: PaymentCard[] = [
  { id: 'Marriott Bonvoy Debit', programmeBrand: 'Marriott Bonvoy', annualFee: 165, feeLabel: '£165/yr', openDate: '2025-12-01' },
  { id: 'Virgin Atlantic Reward+', programmeBrand: 'Virgin Points', annualFee: 160, feeLabel: '£160/yr', openDate: '2025-09-07' },
  { id: 'Marriott Bonvoy Amex', programmeBrand: 'Marriott Bonvoy', annualFee: 95, feeLabel: '£95/yr', openDate: '2025-08-15' },
  { id: 'Hilton Honors Debit', programmeBrand: 'Hilton Honors', annualFee: 150, feeLabel: '£150/yr', openDate: '2025-08-29' },
  { id: 'IHG One Rewards Elite', programmeBrand: 'IHG One Rewards', annualFee: 216, feeLabel: '£216/yr', openDate: '2026-07-24' },
];

export const reviews: Review[] = [
  { hotelId: 'r1', hotelName: 'Taaktana Komodo', country: 'Indonesia', date: '2026-05', category: 'overall', score: 10.0 },
  { hotelId: 'r2', hotelName: 'W Melbourne', country: 'Australia', date: '2026-05', category: 'overall', score: 9.9 },
  { hotelId: 'r3', hotelName: 'Waldorf Astoria Bangkok', country: 'Thailand', date: '2025-07', category: 'overall', score: 9.8 },
  { hotelId: 'r4', hotelName: 'St Regis Kanai', country: 'Mexico', date: '2026-02', category: 'overall', score: 9.7 },
  { hotelId: 'r5', hotelName: 'Marriott Marble Arch', country: 'United Kingdom', date: '2026-07', category: 'overall', score: 9.4 },
  { hotelId: 'r6', hotelName: 'Hilton Dalaman', country: 'Türkiye', date: '2026-07', category: 'overall', score: 8.6 },
  { hotelId: 'r7', hotelName: 'Courtyard London City', country: 'United Kingdom', date: '2026-07', category: 'overall', score: 5.8 },
];
