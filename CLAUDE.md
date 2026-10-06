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
- **The theme is Night Flight:** near-black ground, warm white text,
  champagne gold (`--brand`) as the single accent, font Jost. Anything
  on a gold fill uses `--on-brand` (dark), never white. Photos fade
  into the page via the scrim tokens. Wallet cards take each
  programme's own brand colour (`src/lib/cardTheme.ts`); map colours
  live in `src/data/mapTheme.ts` because Leaflet and SVG attributes
  can't read CSS variables.
- **No explanatory copy in the UI.** Labels, buttons, empty states and
  errors only. No intro paragraphs, how-it-works blurbs, confirmation
  banners or hint text unless it is needed to complete the task.
- **Fewest taps.** Lists delete by swipe-left then tapping Delete
  (`SwipeToDelete`, with `itemLabel`); values edit in place where they're
  shown; forms show only essentials with the rest under "More details",
  and fill what they can (brand from hotel name, airline from flight
  number, country from the trip).
- Routing uses `HashRouter`; routes are listed in `src/App.tsx`.

## Data layer

- Screens read through hooks in `src/lib/useLiveData.ts` (cache, then
  Supabase, then mock fallback). Each `useLive` call needs an explicit
  string cache key, not `fetcher.name`, which production builds minify.
- All Supabase reads and writes are in `src/lib/queries.ts`. Writes made
  offline go through `src/lib/offlineQueue.ts`.
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
