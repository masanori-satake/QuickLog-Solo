const CACHE_NAME = 'quicklog-pwa-v1.31.0';

const SHARED_JS_ASSETS = [
    'db.js',
    'i18n.js',
    'messages.js',
    'logic.js',
    'utils.js',
    'utils/storage.js',
    'schema.js',
    'animations.js',
    'animation_base.js',
    'animation_worker.js',
    'animation_registry.js',
    'anim_sync.js',
    'idb_storage.js',
    'session_sync.js',
    'font_utils.js',
    'locales/common.js',
    'locales/de.js',
    'locales/en.js',
    'locales/es.js',
    'locales/fr.js',
    'locales/ja.js',
    'locales/ko.js',
    'locales/pt.js',
    'locales/zh.js',
    'animation/aura_charge.js',
    'animation/car_drive.js',
    'animation/cats.js',
    'animation/clock.js',
    'animation/coffee_drip.js',
    'animation/contour_lines.js',
    'animation/crab_alien.js',
    'animation/digital_rain.js',
    'animation/dot_typing.js',
    'animation/dune_formation.js',
    'animation/elastic_alert.js',
    'animation/forest_fire.js',
    'animation/generic_gif_animation.js',
    'animation/heart_beat.js',
    'animation/hero_pot.js',
    'animation/hexagonal_hud.js',
    'animation/left_to_right.js',
    'animation/liesegang_rings.js',
    'animation/m3_symbols_with_kb.js',
    'animation/magic_ribbons.js',
    'animation/migrating_birds.js',
    'animation/newtons_cradle.js',
    'animation/night_sky.js',
    'animation/open_reel.js',
    'animation/physarum_mold.js',
    'animation/plasma_discharge.js',
    'animation/red_cap_jumper.js',
    'animation/repelling_digital_rain.js',
    'animation/right_to_left.js',
    'animation/ripple.js',
    'animation/rising_menacing.js',
    'animation/rotational_bbq.js',
    'animation/rpg_grid.js',
    'animation/sand_clock.js',
    'animation/smoke.js',
    'animation/snoring_zzz.js',
    'animation/spectrum.js',
    'animation/spotlight_evasion.js',
    'animation/suminagashi.js',
    'animation/target_reticle.js',
    'animation/test_pattern.js',
    'animation/tetris_building.js',
    'animation/trophy_celebration.js',
    'animation/wind_tunnel.js',
    'animation/yellow_pizza.js',
];

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
    ...SHARED_JS_ASSETS.flatMap((asset) => [`../../shared/js/${asset}`, `../app/shared/js/${asset}`]),
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(STATIC_ASSETS).catch((err) => {
                    console.warn('PWA SW: Some static assets failed to precache:', err);
                    throw err;
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

    // Bypass non-http(s) requests and Vite dev server / HMR internal requests
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.pathname.startsWith('/@') || url.search.includes('import') || url.pathname.includes('node_modules')) return;

    event.respondWith(
        caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' }).then((cachedResponse) => {
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
                    return (
                        cachedResponse || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
                    );
                });

            return cachedResponse || fetchPromise;
        })
    );
});
