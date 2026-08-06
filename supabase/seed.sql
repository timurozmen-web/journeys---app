-- Seed data — run after schema.sql. Same numbers already verified in the
-- prototype and the mock data layer, now becoming real rows.

insert into trips (id, title, start_date, end_date, section, notes) values
  ('tr1', 'Türkiye', '2026-07-25', '2026-08-15', 'current', 'Kemer check-in from 3pm — flag Titanium status on arrival.'),
  ('tr2', 'India · Spain', '2027-01-16', '2027-01-23', 'upcoming', ''),
  ('tr3', 'Australia · Indonesia +2', '2026-05-03', '2026-06-01', 'past', ''),
  ('tr4', 'Canada', '2026-04-09', '2026-04-14', 'past', '')
on conflict (id) do nothing;

insert into hotels (id, trip_id, name, country, brand, tier, nights, stay_date, status, total, nightly_rate, avg_rate, card, category, lat, lng) values
  ('h1', 'tr1', 'Hilton Dalaman', 'Türkiye', 'Hilton Honors', null, 3, '2026-07-25', 'Completed', 480, 160, 190, 'Hilton Debit', 'Premium', 36.7, 28.8),
  ('h2', 'tr1', 'Maxx Royal Kemer', 'Türkiye', 'Independent', null, 3, '2026-08-04', 'Booked', 890, 296, 340, null, 'Luxury', 36.5, 30.5),
  ('h3', 'tr1', 'Maxx Royal Bodrum', 'Türkiye', 'Independent', null, 2, '2026-08-13', 'Booked', 620, 310, 350, null, 'Luxury', 37.0, 27.4)
on conflict (id) do nothing;

insert into flights (id, trip_id, flight_date, from_code, to_code, airline, flight_no, cabin, status, cost, award) values
  ('f1', 'tr1', '2026-07-25', 'LGW', 'DLM', 'easyJet', 'U2 8565', 'Economy', 'Completed', 180, false),
  ('f2', 'tr1', '2026-08-15', 'BJV', 'LTN', 'easyJet', 'U2 2554', 'Economy', 'Booked', 210, false)
on conflict (id) do nothing;

insert into loyalty_programmes (name, abbr, points, pt_value, color, accent, font, shape, tier, next_tier, nights, nights_needed) values
  ('Marriott Bonvoy', 'MA', 415343, 0.5, '#5B2245', '#D8B673', 'Playfair Display, serif', 'crown', 'Titanium Elite', 'Ambassador', 77, 23),
  ('Avios', 'AV', 67309, 1, '#1544A6', '#AFC4EE', 'DM Sans, sans-serif', 'wing', null, null, null, null),
  ('Hilton Honors', 'HI', 63963, 0.4, '#0B4F9C', '#BFD9F2', 'Poppins, sans-serif', 'shield', 'Gold', 'Diamond', 0, 30),
  ('Virgin Points', 'VI', 24005, 1, '#C8102E', '#FFE5E5', 'Yellowtail, cursive', 'arrowUp', null, null, null, null),
  ('Accor ALL', 'AC', 7157, 1.72, '#7A2856', '#F0B3C8', 'Space Grotesk, sans-serif', 'orbit', 'Gold', 'Platinum', 31, 29),
  ('Singapore KrisFlyer', 'SI', 7553, 1.2, '#0A2240', '#C6A15B', 'Marcellus, serif', 'bird', null, null, null, null),
  ('Qantas Points', 'QA', 2460, 1, '#D2001F', '#FFFFFF', 'Barlow Semi Condensed, sans-serif', 'starCompass', null, null, null, null),
  ('World of Hyatt', 'WO', 0, 1.5, '#0F2B46', '#C6A15B', 'Jost, sans-serif', 'gem', 'Member', 'Discoverist', 0, 10),
  ('IHG One Rewards', 'IH', 0, 0.45, '#4A2F6B', '#D8C9EE', 'Manrope, sans-serif', 'compass', 'Member', 'Silver Elite', 0, 10)
on conflict (name) do nothing;

insert into payment_cards (id, programme_brand, annual_fee, fee_label, open_date) values
  ('Marriott Bonvoy Debit', 'Marriott Bonvoy', 165, '£165/yr', '2025-12-01'),
  ('Virgin Atlantic Reward+', 'Virgin Points', 160, '£160/yr', '2025-09-07'),
  ('Marriott Bonvoy Amex', 'Marriott Bonvoy', 95, '£95/yr', '2025-08-15'),
  ('Hilton Honors Debit', 'Hilton Honors', 150, '£150/yr', '2025-08-29'),
  ('IHG One Rewards Elite', 'IHG One Rewards', 216, '£216/yr', '2026-07-24')
on conflict (id) do nothing;

insert into reviews (hotel_id, hotel_name, country, review_date, score) values
  ('r1', 'Taaktana Komodo', 'Indonesia', '2026-05', 10.0),
  ('r2', 'W Melbourne', 'Australia', '2026-05', 9.9),
  ('r3', 'Waldorf Astoria Bangkok', 'Thailand', '2025-07', 9.8),
  ('r4', 'St Regis Kanai', 'Mexico', '2026-02', 9.7),
  ('r5', 'Marriott Marble Arch', 'United Kingdom', '2026-07', 9.4),
  ('r6', 'Hilton Dalaman', 'Türkiye', '2026-07', 8.6),
  ('r7', 'Courtyard London City', 'United Kingdom', '2026-07', 5.8)
on conflict (hotel_id) do nothing;
