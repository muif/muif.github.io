const CACHE_NAME = 'isp-v1';
const ASSETS = [
  './',
  './index.html',
  'https://unpkg.com/dexie/dist/dexie.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});