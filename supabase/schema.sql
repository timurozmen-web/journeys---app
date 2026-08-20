-- Journeys schema — generated directly from src/types/index.ts.
-- Run this once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

create table hotels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  country text not null,
  brand text not null,
  tier text,
  nights int not null,
  date date not null,
  status text not null check (status in ('Completed', 'Booked', 'needs-confirm')),
  total numeric,
  nightly_rate numeric,
  avg_rate numeric,
  sqm numeric,
  card text,
  category text not null check (category in ('Luxury', 'Premium', 'Midscale', 'Budget')),
  lat numeric,
  lng numeric,
  trip_id uuid,
  created_at timestamptz default now()
);

create table flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  date date,
  "from" text not null,
  via text[] default '{}',
  "to" text not null,
  airline text not null,
  flight_no text,
  cabin text not null check (cabin in ('Economy', 'Premium Economy', 'Business', 'First')),
  status text not null check (status in ('Completed', 'Booked')),
  cost numeric,
  award boolean default false,
  trip_id uuid,
  created_at timestamptz default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  title text not null,
  start_date date not null,
  end_date date not null,
  section text not null check (section in ('current', 'upcoming', 'past')),
  notes text default '',
  hero_image_url text,
  created_at timestamptz default now()
);

create table loyalty_programmes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  abbr text not null,
  points bigint not null default 0,
  pt_value numeric not null,
  color text not null,
  accent text not null,
  font text not null,
  shape text not null,
  tier text,
  next_tier text,
  nights int,
  nights_needed int,
  unique (user_id, name)
);

create table payment_cards (
  id text primary key,
  user_id uuid references auth.users not null default auth.uid(),
  programme_brand text not null,
  annual_fee numeric not null,
  fee_label text not null,
  open_date date not null
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  hotel_id uuid references hotels,
  hotel_name text not null,
  country text not null,
  date text not null,
  score numeric not null check (score between 1 and 10)
);

-- Row Level Security: every table only ever returns the signed-in user's
-- own rows. This is what makes the publishable/anon key safe to ship in
-- client code -- without these policies, that key would expose everyone's data.
alter table hotels enable row level security;
alter table flights enable row level security;
alter table trips enable row level security;
alter table loyalty_programmes enable row level security;
alter table payment_cards enable row level security;
alter table reviews enable row level security;

create policy "own rows only" on hotels for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on flights for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on loyalty_programmes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on payment_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  source text not null,
  value numeric,
  earned_date date not null,
  expiry_date date,
  redeemed boolean not null default false,
  redeemed_date date,
  source_key text,
  unique (user_id, source_key)
);

alter table vouchers enable row level security;
create policy "own rows only" on vouchers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  title text not null,
  description text,
  brand text,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

alter table promotions enable row level security;
create policy "own rows only" on promotions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table promotions add column if not exists promo_type text not null default 'other'
  check (promo_type in ('multiplier', 'threshold_bonus', 'fixed_discount', 'status_boost', 'airline_partner', 'other'));
alter table promotions add column if not exists multiplier numeric;
alter table promotions add column if not exists threshold_spend numeric;
alter table promotions add column if not exists bonus_points numeric;
alter table promotions add column if not exists discount_value numeric;
alter table promotions add column if not exists discount_used boolean not null default false;
alter table promotions add column if not exists status_nights_bonus int;
alter table promotions add column if not exists status_nights_applied boolean not null default false;
alter table promotions add column if not exists partner_airline text;

alter table payment_cards add column if not exists manual_spend_adjustment numeric not null default 0;

create table bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  aspsp_name text not null,
  aspsp_country text not null,
  session_id text not null,
  account_uid text not null,
  account_name text,
  consent_valid_until timestamptz not null,
  last_synced_at timestamptz,
  created_at timestamptz default now()
);
alter table bank_connections enable row level security;
create policy "own rows only" on bank_connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  connection_id uuid references bank_connections not null,
  external_transaction_id text not null,
  transaction_date date not null,
  amount numeric not null,
  currency text not null,
  description text,
  matched_card_id text references payment_cards(id),
  dismissed boolean not null default false,
  created_at timestamptz default now(),
  unique (user_id, external_transaction_id)
);
alter table bank_transactions enable row level security;
create policy "own rows only" on bank_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table hotels add column if not exists created_at timestamptz default now();
alter table loyalty_programmes add column if not exists nights_baseline_date date;

-- Establish "today" as the reconciliation point: everything already
-- reflected in the current nights figure stays as-is, and only stays
-- completed from this point forward add on top live.
update loyalty_programmes set nights_baseline_date = current_date where nights_baseline_date is null;

alter table reviews add column if not exists category text not null default 'overall';

alter table payment_cards add column if not exists manual_spend_is_uk boolean not null default true;

create table promotion_scan_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  source text not null,
  brand text,
  title text not null,
  description text,
  start_date date,
  end_date date,
  promo_type text not null default 'other' check (promo_type in ('multiplier','threshold_bonus','fixed_discount','status_boost','airline_partner','other')),
  multiplier numeric,
  threshold_spend numeric,
  bonus_points numeric,
  discount_value numeric,
  status_nights_bonus int,
  partner_airline text,
  fingerprint text not null,
  dismissed boolean not null default false,
  promoted boolean not null default false,
  created_at timestamptz default now(),
  unique (user_id, fingerprint)
);
alter table promotion_scan_candidates enable row level security;
create policy "own rows only" on promotion_scan_candidates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table loyalty_programmes add column if not exists category text not null default 'hotel' check (category in ('hotel','airline'));
update loyalty_programmes set category = 'airline' where name in ('Avios', 'Virgin Points', 'Singapore KrisFlyer', 'Qantas Points');

alter table payment_cards add column if not exists closed_date date;

alter table flights drop constraint if exists flights_status_check;
alter table flights add constraint flights_status_check check (status in ('Completed', 'Booked', 'needs-confirm'));

-- Global landmark/hotspot reference data -- natural, cultural, and historic
-- sites that aren't captured by the populated-places city dataset (e.g.
-- Mount Fuji is a mountain, not a city). Read-only global reference data,
-- not scoped per-user.
create table landmarks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  lat double precision not null,
  lng double precision not null,
  category text not null check (category in ('natural', 'cultural', 'historic', 'beach', 'island')),
  description text not null,
  nearest_city text,
  created_at timestamptz default now()
);
alter table landmarks enable row level security;
create policy "landmarks are readable by all authenticated users" on landmarks
  for select using (auth.role() = 'authenticated');

insert into landmarks (name, country, lat, lng, category, description, nearest_city) values
  ('Mount Fuji', 'Japan', 35.3606, 138.7274, 'natural', 'Japan''s iconic peak -- most visitors base themselves in Kawaguchiko or Hakone for the view rather than staying on the mountain itself.', 'Kawaguchiko'),
  ('Miyajima (Itsukushima)', 'Japan', 34.2966, 132.3200, 'island', 'Small island famous for the floating torii gate, a short ferry ride from Hiroshima.', 'Hiroshima'),
  ('Hakone', 'Japan', 35.2323, 139.1069, 'natural', 'Hot spring town with views of Mount Fuji, popular for a ryokan stay.', 'Tokyo'),
  ('Nikko', 'Japan', 36.7199, 139.6982, 'historic', 'UNESCO-listed shrine and temple complex north of Tokyo, set in forested mountains.', 'Tokyo'),
  ('Shirakawa-go', 'Japan', 36.2578, 136.9066, 'historic', 'UNESCO-listed historic village of traditional thatched-roof farmhouses.', 'Kanazawa'),
  ('Yakushima', 'Japan', 30.3856, 130.5228, 'natural', 'UNESCO-listed island of ancient cedar forest, said to have inspired Studio Ghibli''s Princess Mononoke.', 'Kagoshima'),
  ('Ishigaki Island', 'Japan', 24.3448, 124.1572, 'beach', 'Remote Okinawan island known for coral reefs and beaches, distinct from the main Okinawa/Naha area.', 'Naha'),
  ('Nara Park', 'Japan', 34.6851, 135.8048, 'cultural', 'Free-roaming sacred deer and Todai-ji temple, a common day trip from Kyoto or Osaka.', 'Kyoto'),

  ('Pamukkale', 'Turkey', 37.9142, 29.1198, 'natural', 'Terraced white travertine mineral pools cascading down a hillside.', 'Denizli'),
  ('Cappadocia', 'Turkey', 38.6428, 34.8289, 'natural', 'Famous for hot air balloon flights over its distinctive rock formations and cave dwellings.', 'Kayseri'),
  ('Ephesus', 'Turkey', 37.9395, 27.3417, 'historic', 'Ancient Greco-Roman city ruins, one of the best-preserved classical sites in the Mediterranean.', 'Izmir'),

  ('Uluwatu', 'Indonesia', -8.8290, 115.0864, 'beach', 'Clifftop temple and surf beaches on Bali''s southern peninsula.', 'Denpasar'),
  ('Ubud', 'Indonesia', -8.5069, 115.2625, 'cultural', 'Bali''s cultural heart -- rice terraces, temples, and art villages inland from the coast.', 'Denpasar'),
  ('Komodo National Park', 'Indonesia', -8.5455, 119.4894, 'natural', 'UNESCO-listed home of the Komodo dragon, reached by boat from Labuan Bajo.', 'Labuan Bajo'),

  ('Phi Phi Islands', 'Thailand', 7.7407, 98.7784, 'island', 'Limestone cliff islands with turquoise bays, a short boat ride from Phuket.', 'Phuket'),
  ('Railay Beach', 'Thailand', 8.0104, 98.8372, 'beach', 'Rock-climbing and beach peninsula accessible only by boat, near Krabi.', 'Krabi'),

  ('Uluru', 'Australia', -25.3444, 131.0369, 'natural', 'Sacred sandstone monolith in the Red Centre, a defining Australian landmark.', 'Alice Springs'),
  ('Great Barrier Reef (Cairns)', 'Australia', -16.9203, 145.7710, 'natural', 'World''s largest coral reef system, most commonly accessed via Cairns.', 'Cairns'),
  ('Blue Mountains', 'Australia', -33.7022, 150.3111, 'natural', 'Eucalyptus-forested escarpment and the Three Sisters rock formation, a day trip from Sydney.', 'Sydney'),

  ('Palawan (El Nido)', 'Philippines', 11.1949, 119.4085, 'island', 'Limestone karst lagoons and beaches on Palawan''s northern tip.', 'Puerto Princesa'),
  ('Chocolate Hills', 'Philippines', 9.8264, 124.1608, 'natural', 'Over a thousand cone-shaped grass-covered hills on Bohol island.', 'Tagbilaran');

alter table hotels add column if not exists award boolean not null default false;
