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
- Routing uses `HashRouter`; routes are listed in `src/App.tsx`.

## Data layer

- Screens read through hooks in `src/lib/useLiveData.ts` (cache, then
  Supabase, then mock fallback). Each `useLive` call needs an explicit
  string cache key, not `fetcher.name`, which production builds minify.
- All Supabase reads and writes are in `src/lib/queries.ts`. Writes made
  offline go through `src/lib/offlineQueue.ts`.
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
  `SUPABASE_SERVICE_ROLE_KEY`, Enable Banking keys) are only read there,
  never with a `VITE_` prefix, which would ship them to the browser.
- `netlify.toml` stops `index.html`, `sw.js` and the manifest being
  cached. Keep that when touching headers; stale HTML pointing at old
  chunk names has broken deploys before.

## Tests

Vitest, `src/**/*.test.ts` next to the code. Build test data with
`makeHotel` / `makeFlight` / `makeTrip` from `src/test/fixtures.ts`.
