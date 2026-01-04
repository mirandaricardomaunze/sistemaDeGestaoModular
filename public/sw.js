// Service Worker for Sistema de Gestão
const CACHE_NAME = 'sistema-gestao-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Removing old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    // Take control of all pages immediately
    self.clients.claim();
});

// Fetch event - network first, cache fallback strategy
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API requests - always go to network
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone response for caching
                const responseClone = response.clone();

                // Only cache successful responses
                if (response.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }

                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Background sync for offline sales (future implementation)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-sales') {
        console.log('[SW] Syncing offline sales');
        // TODO: Implement sync logic
    }
});

// Push notifications (future implementation)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        self.registration.showNotification(data.title, {
            body: data.message,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: data.tag || 'default',
        });
    }
});
