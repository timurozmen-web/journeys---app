-- Seed data matching the sample data already shown in the app.
-- Every date literal is explicitly cast with ::date -- a UNION ALL of
-- multiple SELECTs can make Postgres infer plain date strings as text
-- instead of date, which is what broke the first version of this script.
-- Run this once: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- IMPORTANT: replace 'YOUR_EMAIL_HERE' (5 occurrences) with the exact
-- email you sign into the app with.

with me as (
  select id as uid from auth.users where email = 'YOUR_EMAIL_HERE'
),
new_trip as (
  insert into trips (user_id, title, start_date, end_date, section, notes)
  select uid, 'Türkiye', '2026-07-25'::date, '2026-08-15'::date, 'current',
    'Kemer check-in from 3pm — flag Titanium status on arrival.'
  from me
  returning id, user_id
),
ins_hotels as (
  insert into hotels (user_id, trip_id, name, country, brand, nights, date, status, total, nightly_rate, avg_rate, card, category, lat, lng)
  select user_id, id, 'Hilton Dalaman', 'Türkiye', 'Hilton Honors', 3, '2026-07-25'::date, 'Completed', 480, 160, 190, 'Hilton Debit', 'Premium', 36.7, 28.8 from new_trip
  union all
  select user_id, id, 'Maxx Royal Kemer', 'Türkiye', 'Independent', 3, '2026-08-04'::date, 'Booked', 890, 296, 340, null, 'Luxury', 36.5, 30.5 from new_trip
  union all
  select user_id, id, 'Maxx Royal Bodrum', 'Türkiye', 'Independent', 2, '2026-08-13'::date, 'Booked', 620, 310, 350, null, 'Luxury', 37.0, 27.4 from new_trip
)
insert into flights (user_id, trip_id, date, "from", "to", airline, flight_no, cabin, status, cost, award)
select user_id, id, '2026-07-25'::date, 'LGW', 'DLM', 'easyJet', 'U2 8565', 'Economy', 'Completed', 180, false from new_trip
union all
select user_id, id, '2026-08-15'::date, 'BJV', 'LTN', 'easyJet', 'U2 2554', 'Economy', 'Booked', 210, false from new_trip;

with me as (select id as uid from auth.users where email = 'YOUR_EMAIL_HERE')
insert into trips (user_id, title, start_date, end_date, section, notes)
select uid, 'India · Spain', '2027-01-16'::date, '2027-01-23'::date, 'upcoming', '' from me
union all
select uid, 'Australia · Indonesia +2', '2026-05-03'::date, '2026-06-01'::date, 'past', '' from me
union all
select uid, 'Canada', '2026-04-09'::date, '2026-04-14'::date, 'past', '' from me;

with me as (select id as uid from auth.users where email = 'YOUR_EMAIL_HERE')
insert into loyalty_programmes (user_id, name, abbr, points, pt_value, color, accent, font, shape, tier, next_tier, nights, nights_needed)
select uid, v.* from me, (values
  ('Marriott Bonvoy', 'MA', 415343, 0.5, '#5B2245', '#D8B673', 'Playfair Display, serif', 'crown', 'Titanium Elite', 'Ambassador', 77, 23),
  ('Avios', 'AV', 67309, 1, '#1544A6', '#AFC4EE', 'DM Sans, sans-serif', 'wing', null, null, null, null),
  ('Hilton Honors', 'HI', 63963, 0.4, '#0B4F9C', '#BFD9F2', 'Poppins, sans-serif', 'shield', 'Gold', 'Diamond', 0, 30),
  ('Virgin Points', 'VI', 24005, 1, '#C8102E', '#FFE5E5', 'Yellowtail, cursive', 'arrowUp', null, null, null, null),
  ('Accor ALL', 'AC', 7157, 1.72, '#7A2856', '#F0B3C8', 'Space Grotesk, sans-serif', 'orbit', 'Gold', 'Platinum', 31, 29),
  ('Singapore KrisFlyer', 'SI', 7553, 1.2, '#0A2240', '#C6A15B', 'Marcellus, serif', 'bird', null, null, null, null),
  ('Qantas Points', 'QA', 2460, 1, '#D2001F', '#FFFFFF', 'Barlow Semi Condensed, sans-serif', 'starCompass', null, null, null, null),
  ('World of Hyatt', 'WO', 0, 1.5, '#0F2B46', '#C6A15B', 'Jost, sans-serif', 'gem', 'Member', 'Discoverist', 0, 10),
  ('IHG One Rewards', 'IH', 0, 0.45, '#4A2F6B', '#D8C9EE', 'Manrope, sans-serif', 'compass', 'Member', 'Silver Elite', 0, 10)
) as v(name, abbr, points, pt_value, color, accent, font, shape, tier, next_tier, nights, nights_needed);

with me as (select id as uid from auth.users where email = 'YOUR_EMAIL_HERE')
insert into payment_cards (id, user_id, programme_brand, annual_fee, fee_label, open_date)
select v.id, uid, v.programme_brand, v.annual_fee, v.fee_label, v.open_date::date
from me, (values
  ('Marriott Bonvoy Debit', 'Marriott Bonvoy', 165, '£165/yr', '2025-12-01'),
  ('Virgin Atlantic Reward+', 'Virgin Points', 160, '£160/yr', '2025-09-07'),
  ('Marriott Bonvoy Amex', 'Marriott Bonvoy', 95, '£95/yr', '2025-08-15'),
  ('Hilton Honors Debit', 'Hilton Honors', 150, '£150/yr', '2025-08-29'),
  ('IHG One Rewards Elite', 'IHG One Rewards', 216, '£216/yr', '2026-07-24')
) as v(id, programme_brand, annual_fee, fee_label, open_date);
