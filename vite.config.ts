import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Journeys',
        short_name: 'Journeys',
        description: 'Travel, loyalty points and card tracking',
        theme_color: '#132247',
        background_color: '#F4F6FA',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app shell (JS/CSS/HTML/icons) gets cached for fast and
        // offline loading. Supabase requests are deliberately left
        // untouched -- the app should always show real, live data, never
        // a stale cached copy of your trips or balances.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // Activate a new service worker (and its updated file list)
        // immediately rather than waiting for every open tab/PWA instance
        // to fully close first -- reduces the window where an
        // already-loaded page can request an old, no-longer-served
        // chunk filename from a previous deploy.
        skipWaiting: true,
        clientsClaim: true,
        // Explicitly delete any cached files left over from a previous
        // deploy's precache list when the new service worker activates
        // -- belt-and-suspenders alongside skipWaiting/clientsClaim, so
        // nothing stale can linger and get served by accident.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    allowedHosts: true,
  },
})
