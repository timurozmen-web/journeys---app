# Journeys

Real React + TypeScript app, structured to replace the HTML prototype.

## Run it

    npm install
    npm run dev

## What's real vs. stubbed right now

- **Home** — fully wired to typed data (`src/data/mock.ts`), computes trip day/span live rather than hardcoding it
- **Wallet** — data loads and is typed correctly, visual layer not yet ported
- **Trips / Profile / Action sheets** — routing works, screens are placeholders

## Next steps, in order

1. **Port Trips, Wallet, Profile screens fully** — same visual code as the prototype, now against typed data instead of a JSON blob
2. **Create a Supabase project** (you do this — needs your account) and run the schema generated from `src/types/index.ts`
3. **Replace `src/data/mock.ts` with real Supabase queries** — the types are already shaped for this
4. **`npx cap add ios`** — needs Xcode on a Mac; this step can't happen in a sandbox
5. **Wire Capture to a vision-model API** once real photo/document upload exists
