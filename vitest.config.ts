import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so tests don't load the PWA plugin.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Timezone pinned to one with a positive UTC offset in summer (BST) --
    // that's where the date bugs this project has hit actually showed up.
    env: {
      TZ: 'Europe/London',
      // src/lib/supabase.ts throws at import time without these. Tests
      // never talk to the network; the client is just constructed.
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
