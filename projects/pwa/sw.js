const CACHE_NAME = 'quicklog-pwa-v1.30.12';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './js/pwa.js',
    './css/pwa.css',
    '../app/css/style.css',
    '../app/js/app.js',
    '../app/js/backup.js',
    '../app/js/restore.js',
    '../app/version.json',
    '../../shared/css/m3-theme.css',
    '../../shared/css/fonts.css',
    '../../shared/css/variables.css',
    '../../shared/assets/fonts/material-symbols-outlined.woff2',
    '../../shared/assets/icon32.png',
    '../../shared/assets/icon192.png',
    '../../shared/assets/icon512.png',
    '../../shared/assets/icon.svg',
    '../../shared/js/db.js',
    '../../shared/js/i18n.js',
    '../../shared/js/logic.js',
    '../../shared/js/utils.js',
    '../../shared/js/schema.js',
    '../../shared/js/animations.js',
    '../../shared/js/animation_worker.js',
    '../../shared/js/animation_registry.js',
    '../../shared/js/idb_storage.js',
    '../../shared/js/session_sync.js',
    '../../shared/js/font_utils.js',
    '../../shared/js/locales/common.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(STATIC_ASSETS).catch((err) => {
                    console.warn('PWA SW: Some static assets failed to precache:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => {
                        if (name !== CACHE_NAME && name.startsWith('quicklog-pwa-')) {
                            return caches.delete(name);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Bypass non-http(s) requests
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // If network fails, return cached response if available
                    return cachedResponse;
                });

            return cachedResponse || fetchPromise;
        })
    );
});
