import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cue Score',
        short_name: 'Cue Score',
        description: 'Snooker scoreboard for the club table',
        theme_color: '#3b2414',
        background_color: '#0f3d26',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Latin font subsets are precached; other scripts are cached the first time they're used.
        globPatterns: ['**/*.{js,css,html,svg,png}', 'assets/*-latin-{400,500,600,700}-normal-*.woff2'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2') || url.pathname.endsWith('.woff'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
