# Journeys

A personal travel app: log trips, hotels and flights, track loyalty
points and status, and plan the next trip. It's a React + TypeScript
PWA backed by Supabase, deployed on Netlify, with a Capacitor config
ready for an iOS build.

## What it does

- **One app, four tabs**: Today and Trips either side of the +, then
  Status and Cards. The + opens one sheet: screenshots or a pasted email
  first, then adding a stay, flight, trip, promotion, card or calendar
  file by hand.
- **Today**: tonight's stay and how far into the trip you are, what's
  next (stays, flights, nights with nothing booked, the next trip), a
  to-do list (promotions to register for, card spend goals with their
  deadlines, flights a trip still needs, stays to rate) and a status
  ring per programme.
- **Trips**: the trip under way, what's coming (with any missing flights
  flagged), a card to add or plan the next one, and past trips as
  polaroids by year. The scratch-off world map and rated stays are one
  tap away.
- **Trip detail**: the itinerary (flights and stays in one card shape),
  where each flight is best credited (BA, Qatar, Qantas or KrisFlyer),
  a sketched map, points to earn or earned line by line, cost, photos.
- **Status**: wallet value, then every programme with its ring toward
  the next tier (nights from stays, cards, memberships and promotions,
  each shown) and balance. Each programme has its own page: the ring,
  balance, tier and nights edited in place, bonus nights, stays to come,
  its promotions (spent ones archived) and vouchers.
- **Cards**: payment cards on a ring carousel with each card's goals
  and earning, memberships such as ALL Accor+ Explorer, archived cards.
- **Logging**: add a hotel, flight, trip or loyalty programme by hand,
  or **scan a booking email / screenshot** (Claude extracts the
  bookings) and **scan a promotion**. Likely duplicates are flagged.
  Works offline: entries queue locally and sync when back online.
- **Card spend tracking**: links the bank or card that pays for each
  rewards card (TrueLayer open banking). Purchases are totalled by that
  card's own earning categories (e.g. "Marriott stays abroad",
  "Everyday in the UK") and tracked live against its spending goals,
  welcome bonuses and renewal vouchers. Individual transactions are
  never listed, and accounts not mapped to a rewards card are never read.
- **Plan a trip**: weather, season and crowd levels for the month you'd
  go, annual leave needed (UK bank holidays), a route of stops with the
  hops between (rail where it's likely), the best-value hotel programme,
  costs and a live budget check, with points-vs-cash for the city. Picks
  for you from your own account: the flight on your points (Avios, Virgin
  Points, KrisFlyer) with taxes and the award class, nights toward or to
  keep your tier, a free-night voucher that fits, and the crowds or wet
  season to avoid. UK Air Passenger Duty from gov.uk's bands. Public
  holidays at each stop (Nager.Date), school holidays and how much of the
  country is off (OpenHolidays), and hotel prices over events taken from
  measured samples rather than assumed. The city suggestions are given
  the season, the holidays and the places you've already been.
- **Credit advisor**: the full calculation behind a flight's "Credit
  to", for any flight.

## Project layout

| Path | What's there |
| --- | --- |
| `src/screens/` | One file per screen; routes are in `src/App.tsx` |
| `src/components/` | Shared UI: trip cards, maps, logos, tab bar, auth gate |
| `src/lib/` | App logic: points and status maths, planning, formatting, offline cache/queue, Supabase queries (`queries.ts`) and data hooks (`useLiveData.ts`) |
| `src/data/` | Static data: airports, world cities, rail links, hotel brands, card definitions, and the mock data used as a fallback |
| `src/types/index.ts` | Core types, mapping onto the Supabase tables |
| `netlify/functions/` | Server-side functions: Claude-powered extraction and suggestions, bank linking, public holidays, and two daily scheduled jobs (bank sync 06:00 UTC, promotion scan 07:00 UTC) |
| `supabase/` | SQL for the schema, storage bucket and sample data |

## How data loads

Each screen reads through a hook in `src/lib/useLiveData.ts`. It shows
the last cached copy instantly, then fetches from Supabase. If Supabase
returns nothing or fails, it keeps whatever it already had, falling back
to `src/data/mock.ts`. The map screen shows a "sample data" notice
when that fallback is in use. Sign-in is enforced by `AuthGate`.

## Running locally

    npm install
    cp .env.example .env   # then fill in the values below
    npm run dev

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm test` | Runs the tests once (`npm run test:watch` to re-run on save) |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Typecheck and production build into `dist/` |

## Configuration

**App (`.env`, also set in Netlify):**

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: required; the app
  won't start without them.
- `VITE_UNSPLASH_ACCESS_KEY`: optional; destination photos. Without it
  the app draws a generated scene instead.

**Server-side only (Netlify environment variables, never in `.env`
with a `VITE_` prefix):**

- `ANTHROPIC_API_KEY`: email/promotion scanning and the smart
  suggestion functions.
- `SUPABASE_SERVICE_ROLE_KEY`: scheduled jobs and bank linking.
- `TRUELAYER_CLIENT_ID`, `TRUELAYER_CLIENT_SECRET`: bank linking.
  `TRUELAYER_ENV=sandbox` switches to TrueLayer's mock bank (default is
  live). In the TrueLayer console, register
  `https://<your-site>/bank-link-callback` as a
  redirect URI. Bank logins are stored in a table the app's own key
  cannot read.

## Database

Run `supabase/schema.sql`, then `supabase/storage.sql`, in the Supabase
SQL editor. `supabase/seed.sql` adds sample data.

`schema.sql` matches the live Supabase project, including the tables
and columns that were first added there directly. The shared reference
tables (climate, crowd/price, points value, city cash rates) are
created empty; their rows are loaded separately.

## Tests

Tests live next to the code they cover (`src/lib/*.test.ts`) and use
Vitest. They cover the calculation logic: trip dates, points, status,
the crediting engine, currency, annual leave, duplicate detection and
formatting. Shared test data builders are in `src/test/fixtures.ts`.
Tests run with the timezone set to Europe/London, where the date bugs
this project has had actually showed up.

## iOS

`capacitor.config.ts` is set up (`com.timur.journeys`). Building needs a
Mac with Xcode: `npm run build && npx cap add ios && npx cap open ios`.
