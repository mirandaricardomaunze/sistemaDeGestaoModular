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
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          if (normalizedId.includes('/node_modules/react-router')) {
            return 'router';
          }

          if (normalizedId.includes('/node_modules/@tanstack/')) {
            return 'tanstack';
          }

          if (
            normalizedId.includes('/node_modules/i18next') ||
            normalizedId.includes('/node_modules/react-i18next')
          ) {
            return 'i18n-vendor';
          }

          if (normalizedId.includes('/node_modules/react-icons/')) {
            return 'icons';
          }

          if (
            normalizedId.includes('/node_modules/socket.io-client/') ||
            normalizedId.includes('/node_modules/engine.io-client/') ||
            normalizedId.includes('/node_modules/@socket.io/')
          ) {
            return 'realtime-vendor';
          }

          if (normalizedId.includes('/node_modules/axios/')) {
            return 'http-vendor';
          }

          if (normalizedId.includes('/node_modules/zod/')) {
            return 'zod-vendor';
          }

          if (normalizedId.includes('/node_modules/date-fns/')) {
            return 'date-vendor';
          }

          if (
            normalizedId.includes('/node_modules/html5-qrcode/') ||
            normalizedId.includes('/node_modules/@zxing/')
          ) {
            return 'scanner-vendor';
          }

          if (
            normalizedId.includes('/node_modules/qrcode.react/') ||
            normalizedId.includes('/node_modules/qrcode/')
          ) {
            return 'qr-vendor';
          }

          if (normalizedId.includes('/node_modules/@headlessui/')) {
            return 'headlessui-vendor';
          }

          if (normalizedId.includes('/node_modules/@dnd-kit/')) {
            return 'dnd-vendor';
          }

          if (normalizedId.includes('/node_modules/zustand/')) {
            return 'state-vendor';
          }

          if (normalizedId.includes('/node_modules/react-hot-toast/')) {
            return 'toast-vendor';
          }

          if (normalizedId.includes('/node_modules/file-saver/')) {
            return 'file-vendor';
          }

          if (
            normalizedId.includes('/node_modules/clsx/') ||
            normalizedId.includes('/node_modules/tailwind-merge/')
          ) {
            return 'ui-vendor';
          }

          if (normalizedId.includes('/node_modules/dexie/')) {
            return 'offline-vendor';
          }

          if (normalizedId.includes('/node_modules/recharts')) {
            return 'recharts';
          }

          if (normalizedId.includes('/node_modules/xlsx/')) {
            return 'xlsx';
          }

          if (normalizedId.includes('/node_modules/html2canvas')) {
            return 'html2canvas-vendor';
          }

          if (normalizedId.includes('/node_modules/dompurify')) {
            return 'sanitize-vendor';
          }

          if (normalizedId.includes('/node_modules/jspdf-autotable')) {
            return 'pdf-table-vendor';
          }

          if (normalizedId.includes('/node_modules/jspdf')) {
            return 'pdf-vendor';
          }

          if (
            normalizedId.includes('/node_modules/leaflet') ||
            normalizedId.includes('/node_modules/react-leaflet')
          ) {
            return 'map-vendor';
          }

          if (
            normalizedId.includes('/node_modules/react-markdown') ||
            normalizedId.includes('/node_modules/remark-') ||
            normalizedId.includes('/node_modules/micromark') ||
            normalizedId.includes('/node_modules/unified') ||
            normalizedId.includes('/node_modules/unist-') ||
            normalizedId.includes('/node_modules/mdast-') ||
            normalizedId.includes('/node_modules/hast-') ||
            normalizedId.includes('/node_modules/vfile') ||
            normalizedId.includes('/node_modules/property-information') ||
            normalizedId.includes('/node_modules/comma-separated-tokens') ||
            normalizedId.includes('/node_modules/space-separated-tokens')
          ) {
            return 'markdown-vendor';
          }

          // ── App Domain Chunks (P4 Performance Fix) ────────────────────────
          // Separa o código da aplicação por módulo de negócio para reduzir
          // o chunk index.js de 1.5 MB em chunks lazy-loadáveis independentes.
          // Os chunks de vendor (node_modules) já estão separados acima.
          if (!normalizedId.includes('/node_modules/')) {
            const appChunks: [string, string][] = [
              ['/src/components/commercial/', 'app-commercial'],
              ['/src/components/pharmacy/', 'app-pharmacy'],
              ['/src/components/logistics/', 'app-logistics'],
              ['/src/components/hospitality/', 'app-hospitality'],
              ['/src/components/restaurant/', 'app-restaurant'],
              ['/src/components/bottlestore/', 'app-bottle-store'],
              ['/src/components/fiscal/', 'app-fiscal'],
              ['/src/components/accounting/', 'app-accounting'],
              ['/src/pages/commercial/', 'app-commercial'],
              ['/src/pages/pharmacy/', 'app-pharmacy'],
              ['/src/pages/logistics/', 'app-logistics'],
              ['/src/pages/hotel/', 'app-hotel'],
              ['/src/pages/restaurant/', 'app-restaurant'],
              ['/src/pages/bottlestore/', 'app-bottle-store'],
              ['/src/pages/hr/', 'app-hr'],
              ['/src/stores/', 'app-stores'],
              ['/src/hooks/', 'app-hooks'],
            ];
            for (const [pattern, chunkName] of appChunks) {
              if (normalizedId.includes(pattern)) return chunkName;
            }
          }

          return 'vendor';
        },
      },
    },
  },
})
