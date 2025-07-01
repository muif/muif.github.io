const CACHE_NAME = 'internet-subs-manager-v1';
// قائمة الملفات الأساسية التي سيتم تخزينها مؤقتًا
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png', // تأكد من وجود هذه الملفات
  '/icon-512x512.png', // تأكد من وجود هذه الملفات
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. تثبيت الـ Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Failed to cache', err);
      })
  );
});

// 2. تفعيل الـ Service Worker وتنظيف الكاش القديم
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. اعتراض طلبات الشبكة (Fetch)
self.addEventListener('fetch', event => {
  // نحن نستخدم استراتيجية "Cache First" للملفات التي تم تخزينها
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وجدنا الملف في الكاش، نعيده مباشرة
        if (response) {
          return response;
        }
        // إذا لم نجده، نجلبه من الشبكة
        return fetch(event.request);
      })
  );
});