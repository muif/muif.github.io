// Service Worker for Offline-First PWA

const CACHE_NAME = 'isp-manager-cache-v1';

// List of assets to cache on installation
const assetsToCache = [
    'index.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
    'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpQdkhYl0sm.woff2' // Example font file, might need adjustment
];

// --- 1. Install Event ---
// Fired when the service worker is first installed.
// We open a cache and add our assets to it.
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install event');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                // Use addAll which is atomic. If one file fails, the whole operation fails.
                return cache.addAll(assetsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Caching failed:', error);
            })
    );
});

// --- 2. Activate Event ---
// Fired when the service worker is activated.
// This is a good place to clean up old caches.
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate event');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // If a cache's name is not our current cache, delete it.
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Force the activated service worker to take control of the page immediately.
    return self.clients.claim();
});

// --- 3. Fetch Event ---
// Fired for every network request made by the page.
// We implement a "Cache-First" strategy.
self.addEventListener('fetch', (event) => {
    // We only want to handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // If the request is in the cache, return the cached response
                if (cachedResponse) {
                    // console.log('[Service Worker] Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                // If the request is not in the cache, fetch it from the network
                // console.log('[Service Worker] Fetching from network:', event.request.url);
                return fetch(event.request).then(
                    (networkResponse) => {
                        // We can't cache responses from Chrome extensions
                        if (event.request.url.startsWith('chrome-extension://')) {
                            return networkResponse;
                        }

                        // Clone the response because it's a stream and can only be consumed once.
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // Add the new response to the cache for next time.
                                cache.put(event.request, responseToCache);
                            });
                        
                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('[Service Worker] Fetch failed:', error);
                    // Here you could return a generic fallback page if needed,
                    // but for assets, failing here means the app is truly offline and the asset wasn't cached.
                });
            })
    );
});
