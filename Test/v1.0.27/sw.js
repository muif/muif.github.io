// sw.js - Service Worker

const CACHE_NAME = 'isp-manager-cache-v2'; // Increment version to force update
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  // Note: Caching Google Fonts can be tricky. This is a basic approach.
  'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Cairo:wght@400;700&family=El+Messiri:wght@400;700&family=Lalezar&family=Noto+Sans+Arabic:wght@400;700&family=Readex+Pro:wght@400;700&family=Tajawal:wght@400;700&display=swap',
  // Add paths to your icons here. Create a folder named 'images' and place them inside.
  'images/icon-192x192.png',
  'images/icon-512x512.png'
];

// Install event: opens a cache and adds the core files to it.
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        // Use addAll with a catch to prevent a single failed asset from breaking the entire cache
        return cache.addAll(urlsToCache).catch(err => {
            console.error('Failed to cache one or more resources:', err);
        });
      })
  );
});

// Activate event: cleans up old caches.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event: serves assets from cache first (Cache-First strategy).
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Cache hit - return response from cache
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache - fetch from network, then cache it
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            console.log('Fetch failed; returning offline page instead.', error);
            // If fetch fails (e.g., offline), return the main index.html as a fallback.
            // This is crucial for SPA functionality.
            return caches.match('/index.html');
        });
      })
  );
});
