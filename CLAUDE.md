# Journeys: notes for Claude

Personal travel PWA (React 19 + TypeScript + Vite), Supabase backend,
Netlify hosting and functions. See README.md for features, layout and
env vars.

## Before pushing

Run all three; all must be clean:

    npm test
    npm run lint
    npm run build   # tsc -b + vite build; also typechecks the tests

## Conventions

- **Real data only.** Rates, climate, prices, holidays, loyalty earn
  rates: use sourced figures and say where they came from in a comment.
  If something is approximate, label it (e.g. `estimated: true` plus a
  note in the crediting engine). Never invent a value to fill a gap;
  leave it empty and flag it.
- **Comments explain why**, often referencing the bug a line fixes.
  Keep that style: when you fix a bug, say what went wrong in the
  comment and add a regression test.
- **Dates are `YYYY-MM-DD` strings.** Use `addDays` from
  `src/lib/tripDay.ts` rather than adding milliseconds to a local-time
  `Date` and calling `toISOString()`. That shifts a day in BST and has
  caused real bugs. Tests run in `Europe/London` for this reason.
- **Keep logic out of component files.** Pure helpers go in `src/lib/`,
  static tables in `src/data/`; component files export only components
  (lint enforces this for fast refresh).
- **Styling has one master copy.** Every colour, font size, radius,
  shadow and photo scrim is a token in `src/styles/tokens.css`; shared
  pieces (`ScreenHeader`, `Field`, `Button`, `Segmented`, `PhotoHero`,
  `Eyebrow`, `SectionLabel`, `ErrorText`, `EmptyState`) live in
  `src/components/ui.tsx` with their CSS in `src/styles/components.css`.
  Use those first. Any remaining inline style should reference tokens
  (`fontSize: 'var(--fs-body)'`), never raw px sizes or hex colours.
  Form controls take `className="input"` inside a `Field`.
- **One app, four tabs** (`TabBar`, routes in `src/App.tsx`): Today
  (`/`) and Trips either side of the +, then Status and Cards. There
  are no sections or modes; the old two-section addresses (`/now`,
  `/then`, `/loyalty`, `/wallet`, `/action/*`) redirect. The + opens one
  sheet: Screenshots (picked straight from the sheet and read at once by
  `ScanEmail`), Paste email, then by hand (stay, flight, trip,
  promotion, card, calendar file). Plan sits behind "Where next?" on
  Trips; the crediting advisor behind each flight's "Credit to" chip.
  One Paper theme: off-white ground (`--bg`),
  black text, orange as the single accent (`--brand` for text,
  `--brand2` for fills). Headings, trip names and map labels are Space
  Mono, a modern typewriter face; other text is Archivo. Every control
  follows it: ink-outlined, square-cornered Space Mono tags (`.tag`,
  `.maptag`, `.tagbtn`, `.iconbtn`, and the `:root` control overrides in
  components.css). Type is one system (the block at the end of
  components.css): Space Mono bold for titles, trip and programme
  names, section labels (`SectionLabel`, never a hand-styled uppercase
  div) and every headline figure (`.figure`); Archivo for the rest.
  Lists are `.listcard` rows (`.nextrow`, `.triprow`, `.progrow`) with a
  `.datecol` and square `.badge-sq` brand badges.
  - **Today** (`Today.tsx`, `src/lib/today.ts`): tonight's stay and the
    trip's day count, then Next (the rest of the trip under way, nights
    with nothing booked as "No stay booked", the next trip), To do and
    a status ring per programme. To do is promotions to register for
    (deadline read from the wording, `registrationDeadline`, shown only
    when booked stays would earn the bonus; the tick sets
    `promotions.registered`, so every device stops asking, and the
    promotion shows a Registered box), card spend goals (`loyaltyHighlights.ts`), flights a
    trip still needs (`useTripFlightGaps`: a trip starting away from
    home needs a flight there, one not landing back where it began
    needs one home; airports within 150km are one place) and stays to
    rate.
  - **Trips** (`Trips.tsx`): under way, coming up (the next trip as a
    photo card), "Where next?", then past trips by year as polaroids
    (this year open, earlier years folded to a row with countries and
    trip count). The map button opens `/map` (`Places.tsx`): the
    scratch-off world map (every country stayed in or flown to,
    connections excluded: `visitedCountries` in `src/lib/logbook.ts`)
    and rated stays.
  - **Status** (`Status.tsx`): wallet value with its change on last
    month, then hotels (ring, tier, nights to go and to come, balance;
    tiers being worked toward first) and airlines. Each opens
    `/status/:name` (`Programme.tsx`, `ProgrammeDetail`): the ring pager,
    balance, tier and nights edited in place, bonus nights, stays to
    come, that programme's promotions (`PromotionsTab brand=`) and
    vouchers. `/promotions` lists them all. Airline status is set in
    Settings.
  - **Cards** (`Cards.tsx`): bank sync, the ring carousel, memberships,
    archived cards. `useCardResults` works out every held card once and
    records newly earned vouchers.
  Anything on an orange fill uses `--on-brand` (white). Photos carry a
  dark scrim so white text on them stays readable; photos under 90px
  tall are drawn scenes instead, as the photographer credit would cover
  them. The status bar is translucent: every screen starts below
  `--safe-top` (the safe area plus 12px, as iOS blurs a little below
  it; tab screens use `.topspace`, others `.head`), and
  `StatusBarCover` fills it, fading at its foot, once the page scrolls.
  Every screen's first row is the same distance below it (`--safe-top`
  then `--s4`: `.homehead` on tab screens, `.head`, `.tdback`).
  Destination photos are the first Unsplash result with no people in
  it (`pickPlacePhoto`); none means the drawn scene.
  Wallet cards take
  each programme's own brand colour (`src/lib/cardTheme.ts`); map
  colours live in `src/data/mapTheme.ts` because Leaflet and SVG
  attributes can't read CSS variables. Maps are drawn as a pencil
  sketch: hatched land, a doubled ink outline, orange dashed routes.
- **Bookings share one card shape** on a trip's itinerary: a square
  badge in the airline's colour (`src/data/airlineBrand.ts`) or the
  hotel programme's colour (`src/lib/bookingBadge.ts`), then a plane and
  the flight number, or one moon per night.
- **Cards are a ring carousel** (`CardCarousel`, `src/lib/cardCarousel.ts`):
  faces stood round a ring seen from slightly above, the lead card at
  the front and the rest visible behind it (smaller, higher, paler).
  A sideways drag turns the ring with the finger (`touch-action:
  pan-y` keeps vertical scrolling); letting go hands it to a spring
  that snaps the nearest card to the front like a magnet. Tapping a
  card behind brings it forward the short way round; dots and arrow
  keys too. Pose maths, snapping and the spring are pure functions with
  tests. The lead card's details sit below; an active card is removed
  with a two-tap button there; archived cards are swipe-to-delete rows.
- **Memberships are not cards.** A catalogue entry with `kind:
  'subscription'` (ALL Accor+ Explorer: 30 status nights each
  membership year, sourced) has its own Memberships section in the
  wallet, never the carousel or Archived, and no fee or earning.
- **Spent things archive.** Closed cards and promotions that have ended,
  been used or been applied (`promoArchiveReason`) move to an Archived
  list of compact swipe-to-delete rows that open in place.
- **Status rings** (`src/lib/statusRing.ts`, `StatusRing`): one tick
  per night toward the next tier, coloured by source (`nightSegments`:
  stays, cards, membership, promos, to come) from
  `computeStatusProgress().breakdown`; swipe across for the spend
  requirement on the same kind of ring (the Nights / Spend tabs stay
  put; only the rings slide).
- **Nights: stays are stored, bonuses are added.** A programme's stored
  `nights` are nights *stayed* this year as of its baseline date
  (editable as "Nights stayed this year"). Card, membership and
  promotion nights are never stored; `computeStatusProgress` adds each
  from its source (`bonusNights`, listed under the ring), so a baseline
  roll-forward must save `breakdown.stays`, not the total. Status
  nights reset each calendar year: a baseline from last year counts for
  nothing this year.
- **No explanatory copy in the UI.** Labels, buttons, empty states and
  errors only. No intro paragraphs, how-it-works blurbs, confirmation
  banners or hint text unless it is needed to complete the task.
- **Plan a trip** (`Plan.tsx`, helpers in `src/lib/planFormat.ts`): one
  form card (destination, nights stepper, cities, from, leave date),
  then each destination at a glance (weather icons, season and crowd
  flags, year strip). After planning: a summary card with Save, For you,
  the map, the route as numbered stop cards with the hops between (and
  the holiday a stop lands on), flights on points, the best-value
  programme with its logo, and cost with UK APD. Anything else folds
  away under "Search options", "Other programmes" and "Cash or points".
- **Trip planning knowledge is in one place**, `src/lib/planIntel.ts`;
  the screen and the agent both use it, so neither works from its own
  idea of the facts:
  - Weather and crowds: `stopOutlook` (the climate and crowd tables via
    `blendedGuideForMonth`, plus a quieter month either side when a stop
    is busy, never one with worse weather).
  - Flights on points: `awardOptions` prices a seat from London against
    the user's balances and their own point values, with the award
    class to look for (`awardClasses.ts`) and status perks. Prices and
    cash charges are in `src/data/awardFlights.ts` (BA and Qatar Avios,
    Virgin Saver caps, KrisFlyer Saver), sourced and dated; a route
    with no sourced price shows nothing. Seats are priced on the day where
    the airline's peak calendar is known (`src/data/awardSeasons.ts`: BA
    2026, Virgin's windows to early 2027; disputed dates and 2027 BA stay
    unknown and show both prices). BA's cash part is its own fixed
    amount per band (it can be under APD: £2.50 to Amsterdam), so a BA
    seat never gets APD added; airlines that pass taxes on (`taxesPassedOn`)
    show APD as the floor ("£106 APD + fees") when their cash isn't known.
  - Taxes: `airPassengerDuty` (gov.uk rates, `src/data/airPassengerDuty.ts`).
    Bands since April 2023: domestic, A (a list: the EU, the EEA and named
    places, whatever the distance), B (2,001-5,500 miles to the capital)
    and C. Near 5,500 miles only a band gov.uk states is used.
  - Hotel points: `nightPoints` prices a night the way each programme
    does (`src/data/hotelAwardPricing.ts`): Accor is money off (2,000 per
    €40), Hyatt is its chart (the category whose Moderate price fits the
    cash rate, at the season's level), Marriott and IHG are dynamic with no
    cap, Hilton dynamic up to 250,000. A researched rate is put in the
    stay's season by the city's measured month factor where it has one
    (`stayCashUsd`: the range's middle times the factor), else by the
    month's price level (`seasonalCashUsd`: bottom in a cheap month, top
    in a dear one); the level itself is measured where it can be
    (`marketPriceLevel`). Marriott cash is the booking sites' price
    less its member rate (2.5%, the user's own figure: `MEMBER_RATE_DISCOUNT`).
  - Hotel prices are measured: `src/data/hotelPrices.json` is a database of
    every hotel price search as it came back (SlickTrip, comparing the
    booking sites; 2 adults, cheapest room, USD a night), read through
    `src/lib/hotelPrices.ts`. Each hotel is put to its programme by name
    (`programmeOfHotel`: a Sheraton, Westin, Moxy or W is Marriott, or a
    brand given as a fourth field: Hotel Arts is a Ritz-Carlton) and to a
    price level: Marriott by its own tiers (Luxury, Premium, Select),
    anything else by stars. `measuredCash` prices a programme's night at a
    level in a city from its hotels there (two or more): as priced where the
    search covers the stay's nights, else plain-night prices moved to the
    stay's month by the city's month index, then any event. The index
    (`seasonIndex`) is fitted to the same hotels priced in different months
    (log price = hotel + month), from one 4-5★ search a month (Wednesday to
    Saturday in the second week; rates more than about eleven months out
    aren't published). Held out one hotel-month at a time it predicts a
    hotel's price in another month to 6-12% (Dubai, Tokyo, New York, London,
    Paris, Las Vegas, Edinburgh, Sydney, Hong Kong, Barcelona, Rome,
    Amsterdam, Milan, Lisbon, Abu Dhabi, Rio de Janeiro); the researched
    ranges it replaced were 19-30% out, worse than no change in Tokyo.
    Edinburgh gains most (34% out unchanged: January is under half the
    year's average). Mexico City's, Singapore's and Bangkok's hotels mostly
    hold one price all year: no change is 5-5.5% out there, the index 4-6%.
    A month search that lands on an event (Edinburgh's July on the Open)
    becomes that event, with plain nights a fortnight away, so the index
    never learns an event as a season. Cities without one fall back to the
    researched range. It replaces the researched rate for that programme in
    Where to stay, the voucher advice and Cash or points. Searching: the
    brand filter matches the hotel's group, so one search each for Marriott,
    Accor, Hilton, Hyatt and IHG covers a city's programme hotels, Design
    Hotels and Autograph Collection included (it matched the name until
    October 2026; the old brand-by-brand list is at the top of
    `hotelPrices.ts`). A hotel whose name doesn't say its brand carries it
    as a fourth field; hotels from towns nearby are left out. AC Hotels
    never come back priced.
  - Events (`src/data/priceEvents.ts`): an event's nights and plain nights a
    fortnight away; `eventPrices` pairs the hotels priced on both and takes
    the median ratio: at the stay's price level where four or more were
    paired there (the programme's own first), as levels move apart (Dubai
    New Year: Marriott Select x1.95, Luxury x2.81), else the programme's own
    hotels where at least two, else all. Held out one hotel at a time this
    predicts a hotel's event price to a median 12.8% (271 hotels); ignoring
    events would be 46% out. Holidays don't all raise prices: Dubai's
    Marriotts were x2.4 over New Year, Barcelona's x3.85 for the Mobile
    World Congress, but Tokyo's x0.93 in Golden Week, Rome's x0.82 at
    Easter, Las Vegas's flat for the Grand Prix. Edinburgh's were x1.83 for
    the Open at St Andrews, 50 miles away, and Lisbon's x1.62 for Web
    Summit. A city with no event measured gets no uplift.
  - Public holidays: Nager.Date (free, no key) through
    `netlify/functions/holidays.js`, as the browser can't reach it;
    `useHolidays` keeps each country and year on the device for 30 days.
    `holidaysDuring` lists the national ones on a stay's nights, and a
    Monday or Friday one is flagged as a long weekend.
  - School holidays: OpenHolidays (free, no key; 33 countries, mostly
    Europe, plus Mexico and South Africa; not the UK) through the same
    function with `&kind=school`. They're regional, so `schoolBreakDuring`
    reads how much of the country is off on the stay's busiest night:
    all, most or some regions (regions counted within six months of the
    stay, as some publish later). The stop card shows it unless the crowd
    note already names it (`schoolNote`); For you only when all or most.
  - Free-night vouchers: `voucherAdvice` weighs each stop's price levels
    in season, the programme's top-up (`src/data/freeNights.ts`: Marriott
    25,000), the voucher's worth to the user (its stored value, else cap x
    their point value) and expiry (its full worth until the last six
    months, then less). Verdicts: use, top up, use before it goes, keep.
  - Country names differ between data sets ("United Arab Emirates" /
    "UAE", "Turkey" / "Türkiye"): match them with `sameCountry`
    (`src/lib/countryName.ts`), never `===`.
  - The account: `stayInsights` gives each programme's nights toward the
    tier being worked on (or, for a trip next year, toward keeping the
    tier held; a card-granted tier, or one a membership's yearly nights
    keep, aims at the tier above instead), points a night and nights the
    balance covers (free fifth night where given), voucher advice and
    promotion bonus points.
    `forYou` picks the few worth acting on. `planIntel.scenarios.test.ts`
    plans whole trips against the user's account and checks the tables
    hold together.
  - The agent (`netlify/functions/suggest-cities.js`, prompt and checks
    in `netlify/lib/planPrompt.js`) is sent `agentContext`: each region's
    weather and crowds in the month of travel, the public and school
    holidays during the trip and the cities already stayed in. It's told to rely on those
    facts, not its memory, and not to assume a holiday makes hotels
    dearer; its
    answer is checked (real coordinates, airport codes, nights that add
    up to the trip) before the app sees it.
- **Fewest taps.** Lists delete by swipe-left then tapping Delete
  (`SwipeToDelete`, with `itemLabel`); values edit in place where they're
  shown; forms show only essentials with the rest under "More details",
  and fill what they can (brand from hotel name, airline from flight
  number, country from the trip).
- **Forms and flow.** A form leaves through `useFinish`
  (`src/lib/useFinish.ts`): opened from a screen with `state.back`, it
  returns there (`done`), otherwise its result replaces it (a new trip's
  page replaces the trip form), so Back never lands on a saved form.
  Deleting uses `gone` (from a trip's edit form, 2 steps, past the trip's
  page too), and a page for something deleted this session moves on to its
  list (`src/lib/deleted.ts`). Stays and flights are added straight from a
  trip page (no "how would you like to add it" step); the mail icon in a
  form's header imports instead. Fields use `Field` (the label wraps the
  control), warnings and deletes use `Confirm`, and things to act on in a
  screen (missing flights, unbooked nights) use `Notice`, the to-do row
  shape. One 20px gutter (`--s5`) on every screen; controls share
  `--r-control` (6px) and Space Mono. The QA journeys that exercise all of
  this (add, edit and delete trips, stays, flights, programmes and cards,
  then Back) were run in Chromium against a copy of the live data.
- Routing uses `HashRouter`; routes are listed in `src/App.tsx`.

## Data layer

- Screens read through hooks in `src/lib/useLiveData.ts` (cache, then
  Supabase, then mock fallback). Each `useLive` call needs an explicit
  string cache key, not `fetcher.name`, which production builds minify.
- Loading tidies two things (`src/lib/tripFold.ts`): a stay logged twice
  (same hotel, same check-in) counts once, and an empty trip inside
  another trip of the same name is folded into it.
- All Supabase reads and writes are in `src/lib/queries.ts`. Writes made
  offline go through `src/lib/offlineQueue.ts`.
- Hotel points (`stayPoints`): spend x base rate x tier, any multiplier
  promotion, then bonus promotions (`src/lib/promoBonus.ts`), whose terms
  are read from their own wording: "every 2 nights", "on your second
  stay", "stays of 2+ nights", "at Ruby Hotels". Wording it can't read
  earns nothing rather than a guess. Upcoming trips show "Points to earn"
  from their booked stays, line by line (`tripPointsLines`: each stay's
  own points, promotions together, then each card's).
- Booking classes mean different things per airline: award classes live
  in `src/data/awardClasses.ts` (sourced; Qatar and BA so far) and
  `awardCabin` turns airline + letter into an award cabin or null. The
  email scanner extracts the letter, so a Qatar "U" arrives as a business
  award while LOT's "U" (a cash Saver fare) doesn't; the Credit advisor
  shows an award seat as earning nothing.
- A flight's "Credit to" chip (`creditPick`, `src/lib/flightCredit.ts`)
  is the advisor's best-value programme for it, assuming a standard
  fare (the fare level isn't logged). None for an award seat, a carrier
  no programme partners with, or an own-metal BA/Qatar/Qantas flight
  with no price, where the answer would hang on the missing price.
- Stays are read through `canonicalStay` (`src/lib/stayNormalise.ts`):
  sub-brands map to their programme and a Booked stay past check-out
  counts as completed. Hotel points come only from `src/lib/loyaltyPoints.ts`;
  balances shown are the stored balance plus stays completed since its
  baseline date (`withLiveOverrides`). Entering a balance moves the baseline
  to today.
- Every write in `queries.ts` ends with `notifyDataChanged()`, which makes
  every `useLive` hook refetch, so totals and badges update everywhere.
- Adding a DB column: update `src/types/index.ts`, the mapping in
  `queries.ts`, and `supabase/schema.sql` (as an `alter table ... add
  column if not exists` at the end).
- Keep `schema.sql` in step with the live database: if a table or
  column is added live, add it to the file too. The two drifted apart
  once, and a column the app writes was missing live as a result.
- Don't change the live Supabase database without the user's explicit
  go-ahead.

## Server side

- `netlify/functions/*.js` are plain JS. Secrets (`ANTHROPIC_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `TRUELAYER_*`) are only read there,
  never with a `VITE_` prefix, which would ship them to the browser.
- `netlify.toml` stops `index.html`, `sw.js` and the manifest being
  cached. Keep that when touching headers; stale HTML pointing at old
  chunk names has broken deploys before.

## Card earning and open banking

- Each card in `src/data/cardDefs.ts` has its own `earnCategories`; rates
  always come from its `rateFor`. A test checks every own-brand x region
  combination lands in exactly one category, so edit both together.
- Adding a card: add it to `CARDS_STATIC` with a `detect` rule (matched
  against the linked account's name, most specific card first), sourced
  fee/earn rates with a dated comment, and limited-time welcome bonuses as
  `offers` (only apply when the card was opened inside the offer dates; no
  welcome milestone otherwise, since standard terms aren't a sourced
  figure). Cards added by hand in the app are `custom`: spend only, no
  points, because their earn rate isn't known.
- A card paid for from a current account (Marriott Debit via Monzo) has a
  rule in `netlify/lib/fundingRules.js` saying which lines on that account
  are its purchases; only those are stored. Rules come from the
  cardholder's own statement text, never guessed.
- Wallet cards are drawn from `src/data/cardFaces.ts`: brand-colour
  illustrations at real card proportions, not issuers' artwork. Only add a
  network mark where the network is certain.
- Bank spend is totalled per category (`src/lib/earning.ts`), never listed.
  A card with synced bank data uses only that (no double counting with
  logged stays). Spend billed in GBP is assumed UK; say so in the UI.
- Bank tables: `open_banking_*` and `card_spend`. Writes are server-only
  (Netlify functions, service role); tokens are unreadable by the app key.
  Test schema/RLS changes in a scratch Postgres (PGlite), not live.

## Tests

Vitest, `src/**/*.test.ts` next to the code. Build test data with
`makeHotel` / `makeFlight` / `makeTrip` from `src/test/fixtures.ts`.
