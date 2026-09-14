// Stand-in for what Supabase will return once Phase 2 is wired up.
// Same shape as the real query results — swapping this for a real
// `supabase.from('trips').select()` call later is mechanical, not a rewrite.
import type { Trip, LoyaltyProgramme, PaymentCard, Review, DiscoverItem } from '../types';

export const trips: Trip[] = [
  {
    id: 'tr1', title: 'Türkiye', start: '2026-07-25', end: '2026-08-15', section: 'current', tripType: 'leisure',
    notes: 'Kemer check-in from 3pm — flag Titanium status on arrival.', heroImageUrl: null,
    hotels: [
      { id: 'h1', name: 'Hilton Dalaman', country: 'Türkiye', city: 'Dalaman', brand: 'Hilton Honors', nights: 3, date: '2026-07-25', status: 'Completed', total: 480, nightlyRate: 160, avgRate: 190, sqm: null, card: 'Hilton Debit', category: 'Premium', lat: 36.7, lng: 28.8, benefitValue: null, benefitNote: null, bookingChannel: null, roomType: null, rateType: 'Standard', award: false, benefitType: null, createdAt: null },
      { id: 'h2', name: 'Maxx Royal Kemer', country: 'Türkiye', city: 'Kemer', brand: 'Independent', nights: 3, date: '2026-08-04', status: 'Booked', total: 890, nightlyRate: 296, avgRate: 340, sqm: null, card: null, category: 'Luxury', lat: 36.5, lng: 30.5, benefitValue: null, benefitNote: null, bookingChannel: null, roomType: null, rateType: 'Standard', award: false, benefitType: null, createdAt: null },
      { id: 'h3', name: 'Maxx Royal Bodrum', country: 'Türkiye', city: 'Bodrum', brand: 'Independent', nights: 2, date: '2026-08-13', status: 'Booked', total: 620, nightlyRate: 310, avgRate: 350, sqm: null, card: null, category: 'Luxury', lat: 37.0, lng: 27.4, benefitValue: null, benefitNote: null, bookingChannel: null, roomType: null, rateType: 'Standard', award: false, benefitType: null, createdAt: null },
    ],
    flights: [
      { id: 'f1', date: '2026-07-25', from: 'LGW', via: [], to: 'DLM', airline: 'easyJet', flightNo: 'U2 8565', cabin: 'Economy', status: 'Completed', cost: 180, award: false, overnight: false, departureTime: null, arrivalTime: null },
      { id: 'f2', date: '2026-08-15', from: 'BJV', via: [], to: 'LTN', airline: 'easyJet', flightNo: 'U2 2554', cabin: 'Economy', status: 'Booked', cost: 210, award: false, overnight: false, departureTime: null, arrivalTime: null },
    ],
  },
  {
    id: 'tr2', title: 'India · Spain', start: '2027-01-16', end: '2027-01-23', section: 'upcoming', tripType: 'leisure',
    notes: '', heroImageUrl: null, hotels: [], flights: [],
  },
  {
    id: 'tr3', title: 'Australia · Indonesia +2', start: '2026-05-03', end: '2026-06-01', section: 'past', tripType: 'leisure',
    notes: '', heroImageUrl: null, hotels: [], flights: [],
  },
  {
    id: 'tr4', title: 'Canada', start: '2026-04-09', end: '2026-04-14', section: 'past', tripType: 'leisure',
    notes: '', heroImageUrl: null, hotels: [], flights: [],
  },
];

export const loyaltyProgrammes: LoyaltyProgramme[] = [
  { name: 'Marriott Bonvoy', abbr: 'MA', points: 415343, ptValue: 0.5, color: '#1C1C1C', accent: '#FF9962', font: "'Playfair Display', serif", shape: 'crown', tier: 'Titanium Elite', nextTier: 'Ambassador', nights: 66, nightsNeeded: 19 , category: 'hotel' },
  { name: 'Avios', abbr: 'AV', points: 67309, ptValue: 1, color: '#2D5495', accent: '#FFFFFF', font: "'DM Sans', sans-serif", shape: 'wing' , category: 'airline' },
  { name: 'Hilton Honors', abbr: 'HI', points: 63963, ptValue: 0.4, color: '#012F60', accent: '#FFFFFF', font: "'Poppins', sans-serif", shape: 'shield', tier: 'Gold', nextTier: 'Diamond', nights: 0, nightsNeeded: 30 , category: 'hotel' },
  { name: 'Virgin Points', abbr: 'VI', points: 24005, ptValue: 1, color: '#DA0630', accent: '#FFFFFF', font: "'Yellowtail', cursive", shape: 'arrowUp' , category: 'airline' },
  { name: 'Accor ALL', abbr: 'AC', points: 7157, ptValue: 1.72, color: '#050033', accent: '#B88D5B', font: "'Space Grotesk', sans-serif", shape: 'orbit', tier: 'Gold', nextTier: 'Platinum', nights: 7, nightsNeeded: 29 , category: 'hotel' },
  { name: 'Singapore KrisFlyer', abbr: 'SI', points: 7553, ptValue: 1.2, color: '#00266B', accent: '#FFA107', font: "'Marcellus', serif", shape: 'bird' , category: 'airline' },
  { name: 'Qantas Points', abbr: 'QA', points: 2460, ptValue: 1, color: '#E40000', accent: '#FFFFFF', font: "'Barlow Semi Condensed', sans-serif", shape: 'starCompass' , category: 'airline' },
  { name: 'World of Hyatt', abbr: 'WO', points: 0, ptValue: 1.5, color: '#041761', accent: '#FFB612', font: "'Jost', sans-serif", shape: 'gem', tier: 'Member', nextTier: 'Discoverist', nights: 0, nightsNeeded: 10 , category: 'hotel' },
  { name: 'IHG One Rewards', abbr: 'IH', points: 0, ptValue: 0.45, color: '#000000', accent: '#FFFFFF', font: "'Manrope', sans-serif", shape: 'compass', tier: 'Member', nextTier: 'Silver Elite', nights: 0, nightsNeeded: 10 , category: 'hotel' },
];

export const paymentCards: PaymentCard[] = [
  { id: 'Marriott Debit', programmeBrand: 'Marriott Bonvoy', annualFee: 165, feeLabel: '£165/yr', openDate: '2025-12-01', manualSpendAdjustment: 1000, manualSpendIsUK: true, closedDate: null },
  { id: 'Virgin Atlantic Mastercard+', programmeBrand: 'Virgin Points', annualFee: 160, feeLabel: '£160/yr', openDate: '2025-09-07', manualSpendAdjustment: 0, manualSpendIsUK: true, closedDate: null },
  { id: 'Marriott Amex', programmeBrand: 'Marriott Bonvoy', annualFee: 95, feeLabel: '£95/yr', openDate: '2025-08-15', manualSpendAdjustment: 0, manualSpendIsUK: true, closedDate: null },
  { id: 'Hilton Debit', programmeBrand: 'Hilton Honors', annualFee: 150, feeLabel: '£150/yr', openDate: '2025-08-29', manualSpendAdjustment: 0, manualSpendIsUK: true, closedDate: null },
  { id: 'IHG Revolut Elite', programmeBrand: 'IHG One Rewards', annualFee: 216, feeLabel: '£216/yr', openDate: '2026-07-24', manualSpendAdjustment: 0, manualSpendIsUK: true, closedDate: null },
];

export const reviews: Review[] = [
  { id: 'rev1', hotelId: 'r1', hotelName: 'Taaktana Komodo', country: 'Indonesia', date: '2026-05', category: 'overall', score: 10.0 },
  { id: 'rev2', hotelId: 'r2', hotelName: 'W Melbourne', country: 'Australia', date: '2026-05', category: 'overall', score: 9.9 },
  { id: 'rev3', hotelId: 'r3', hotelName: 'Waldorf Astoria Bangkok', country: 'Thailand', date: '2025-07', category: 'overall', score: 9.8 },
  { id: 'rev4', hotelId: 'r4', hotelName: 'St Regis Kanai', country: 'Mexico', date: '2026-02', category: 'overall', score: 9.7 },
  { id: 'rev5', hotelId: 'r5', hotelName: 'Marriott Marble Arch', country: 'United Kingdom', date: '2026-07', category: 'overall', score: 9.4 },
  { id: 'rev6', hotelId: 'r6', hotelName: 'Hilton Dalaman', country: 'Türkiye', date: '2026-07', category: 'overall', score: 8.6 },
  { id: 'rev7', hotelId: 'r7', hotelName: 'Courtyard London City', country: 'United Kingdom', date: '2026-07', category: 'overall', score: 5.8 },
];

// Real, researched items (not fabricated) -- used as both the offline
// fallback and the basis for the initial live seed. See the Discover
// screen for how these render.
export const discoverItems: DiscoverItem[] = [
  {
    id: 'dis1', category: 'loyalty_news', title: 'Marriott Bonvoy Opens Registration for Autumn 2026 Bonus Points Promotion',
    summary: 'Marriott Bonvoy has launched registration for its autumn global promotion, offering members up to 4,500 bonus points per qualifying stay between 22 September and 22 November 2026. Registration opened on 9 September 2026 and must be completed before stays begin.',
    detail: 'Members who register and complete paid stays of two or more consecutive nights between 22 September and 22 November 2026 earn 1,500 bonus points per stay; designated resort properties earn an additional 3,000 bonus points, for a maximum of 4,500. Homes & Villas by Marriott Bonvoy properties count, though bonus posting can take up to six weeks. Award stays using points or certificates are ineligible. Registration closes 13 November 2026 via Marriott\u2019s Promotion Central page.',
    source: 'Head for Points / LoyaltyLobby', sourceUrl: 'https://www.headforpoints.com/2026/09/10/register-marriott-1500-bonus-points-promotion/',
    deadline: '2026-11-13', relatedProgramme: 'Marriott Bonvoy', annualFee: null, headlineStat: '4,500 bonus points per resort stay',
    createdAt: '2026-09-10', status: 'new', requiresRegistration: true, registered: false, registeredAt: null,
    newBookingsOnly: false, promoStart: '2026-09-22', promoEnd: '2026-11-22', minNights: 2, bonusPoints: 4500,
    bonusDescription: '1,500 points per stay of 2+ nights, +3,000 more at resort properties',
  },
  {
    id: 'dis2', category: 'loyalty_news', title: 'Qatar Airways Privilege Club Launches September Bonus Avios + Fare Sale for UK Members',
    summary: 'Qatar Airways has launched a short-window promotion giving Privilege Club members up to 10,000 bonus Avios and up to 20% off base fares on European departures, bookable 8-18 September 2026 using promo code SEPTPC26.',
    detail: 'Booking via promo code SEPTPC26 on qatarairways.com or the app gives up to 20% off the base fare plus up to 10,000 bonus Avios, credited on the Europe-to-Doha sector only and cabin-dependent. Booking window 8-18 September 2026, travel valid through 31 May 2027. Since Avios transfer freely between Privilege Club and The British Airways Club, this is accessible to UK-based Avios collectors holding either programme.',
    source: 'Head for Points', sourceUrl: 'https://www.headforpoints.com/2026/09/09/10000-avios-with-qatar-airways/',
    deadline: '2026-09-18', relatedProgramme: 'Qatar Privilege Club', annualFee: null, headlineStat: 'Up to 10,000 bonus Avios + 20% off fares',
    createdAt: '2026-09-10', status: 'new', requiresRegistration: false, registered: false, registeredAt: null,
    newBookingsOnly: true, promoStart: '2026-09-08', promoEnd: '2027-05-31', minNights: null, bonusPoints: 10000,
    bonusDescription: 'Up to 10,000 bonus Avios on Europe-Doha bookings made 8-18 Sep 2026',
  },
];
