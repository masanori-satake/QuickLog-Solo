import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { jest } from '@jest/globals';

const scope = 'https://example.test/projects/pwa/';
const source = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');

function createWorker() {
    const listeners = {};
    const cache = { addAll: jest.fn().mockResolvedValue(undefined), put: jest.fn() };
    const caches = {
        open: jest.fn().mockResolvedValue(cache),
        match: jest.fn().mockResolvedValue(undefined),
    };
    const self = {
        addEventListener: (type, listener) => {
            listeners[type] = listener;
        },
        skipWaiting: jest.fn(),
    };
    const fetch = jest.fn();
    class OfflineResponse {
        constructor(body, options) {
            this.body = body;
            this.status = options.status;
        }
    }
    const { staticAssets, cacheName } = runInNewContext(
        `${source}\n({ staticAssets: STATIC_ASSETS, cacheName: CACHE_NAME })`,
        { self, caches, fetch, URL, Response: OfflineResponse, console: { warn: jest.fn() } }
    );
    return { listeners, cache, caches, self, fetch, staticAssets, cacheName };
}

test('precaches every reachable static JS import and both shared-module paths', () => {
    const { staticAssets, cacheName } = createWorker();
    expect(cacheName).toBe('quicklog-pwa-v1.31.0');
    const cachedUrls = new Set(staticAssets.map((asset) => new URL(asset, scope).href));
    const pending = [new URL('./js/pwa.js', scope), new URL('../app/shared/js/animation_worker.js', scope)];
    const visited = new Set();

    for (const moduleUrl of pending) {
        if (visited.has(moduleUrl.href)) continue;
        visited.add(moduleUrl.href);
        expect(cachedUrls.has(moduleUrl.href)).toBe(true);
        const filename = realpathSync(join(process.cwd(), moduleUrl.pathname.slice(1)));
        const content = readFileSync(filename, 'utf8');
        const imports = /\b(?:from\s*|import\s*(?:\(\s*)?)['"](\.{1,2}\/[^'"]+\.js)['"]/g;
        for (const match of content.matchAll(imports)) {
            pending.push(new URL(match[1], moduleUrl));
        }
    }

    for (const asset of staticAssets) {
        realpathSync(join(process.cwd(), new URL(asset, scope).pathname.slice(1)));
    }
    expect(cachedUrls.has(new URL('../../shared/js/messages.js', scope).href)).toBe(true);
    expect(cachedUrls.has(new URL('../app/shared/js/utils/storage.js', scope).href)).toBe(true);
});

test('failed precaching rejects install without activating the new worker', async () => {
    const { listeners, cache, self } = createWorker();
    const error = new Error('precache failed');
    cache.addAll.mockRejectedValue(error);
    let installPromise;
    listeners.install({
        waitUntil: (promise) => {
            installPromise = promise;
        },
    });

    await expect(installPromise).rejects.toBe(error);
    expect(self.skipWaiting).not.toHaveBeenCalled();
});

test('offline navigation with a query uses the cached shell', async () => {
    const { listeners, caches, fetch } = createWorker();
    const cachedResponse = { status: 200 };
    caches.match.mockResolvedValue(cachedResponse);
    fetch.mockRejectedValue(new Error('offline'));
    let responsePromise;
    const request = { method: 'GET', mode: 'navigate', url: `${scope}?pwa` };
    listeners.fetch({
        request,
        respondWith: (promise) => {
            responsePromise = promise;
        },
    });

    await expect(responsePromise).resolves.toBe(cachedResponse);
    expect(caches.match).toHaveBeenCalledWith(request, { ignoreSearch: true });
});

test('offline cache misses return a 503 response', async () => {
    const { listeners, caches, fetch } = createWorker();
    fetch.mockRejectedValue(new Error('offline'));
    let responsePromise;
    const request = { method: 'GET', mode: 'cors', url: new URL('./missing.js', scope).href };
    listeners.fetch({
        request,
        respondWith: (promise) => {
            responsePromise = promise;
        },
    });

    await expect(responsePromise).resolves.toMatchObject({ status: 503, body: 'Offline' });
    expect(caches.match).toHaveBeenCalledWith(request, { ignoreSearch: false });
});
