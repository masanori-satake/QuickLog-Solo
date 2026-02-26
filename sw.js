const CACHE_NAME = 'quicklog-solo-v0.2.5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/m3-theme.css',
  './js/app.js',
  './js/db.js',
  './js/logic.js',
  './js/utils.js',
  './manifest.json',
  './assets/icon.svg',
  './version.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
