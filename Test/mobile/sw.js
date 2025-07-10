// sw.js - Service Worker

const CACHE_NAME = 'isp-manager-cache-v3'; // Increment version to force update
const urlsToCache = [
  '/',
  '/mobile.html', // Changed from index.html
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Cairo:wght@400;700&family=El+Messiri:wght@400;700&family=Lalezar&family=Noto+Sans+Arabic:wght@400;700&family=Readex+Pro:wght@400;700&family=Tajawal:wght@400;700&display=swap',
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
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            console.log('Fetch failed; returning offline page instead.', error);
            // Fallback to the main app file
            return caches.match('./index.html');
        });
      })
  );
});