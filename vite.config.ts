import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
      },
    }),
  ],
  server: {
    allowedHosts: true,
  },
})
