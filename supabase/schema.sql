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
