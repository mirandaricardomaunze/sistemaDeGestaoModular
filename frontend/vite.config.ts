import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { compression } from 'vite-plugin-compression2'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Multicore',
        short_name: 'Multicore',
        description: 'Multicore - Sistema de Gestão Empresarial',
        theme_color: '#2563eb',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Allow large bundles to be precached so the app cold-boots offline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Read-only API calls: serve cached response immediately, then refresh.
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/api\//.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-get-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Static fonts / images: cache-first with long TTL.
          {
            urlPattern: ({ request }) =>
              request.destination === 'image' ||
              request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false
      }
    }),
    // Pre-compressão dos assets para servir via nginx `gzip_static on;` e
    // `brotli_static on;`. CPU não é gasto em runtime; ficheiros ≥1KB ficam
    // ~70–80% mais pequenos. Ver performance-and-caching §4.
    compression({
      algorithms: ['gzip', 'brotliCompress'],
      threshold: 1024,
      deleteOriginalAssets: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.replace(/\\/g, '/').includes('/node_modules/recharts/')
            ? 'recharts'
            : undefined;
        },
      },
    },
  },
})
