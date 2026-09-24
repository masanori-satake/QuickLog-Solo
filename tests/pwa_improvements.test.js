/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

describe('PWA Improvements & Session Sync Fallback', () => {
    beforeEach(() => {
        localStorage.clear();
        delete globalThis.window.IS_PWA;
        delete globalThis.chrome;

        document.body.innerHTML = `
            <div id="app">
                <button id="advanced-editor-link"></button>
                <button id="alarm-editor-link"></button>
                <button id="test-notification-btn"></button>
                <button id="backup-change-dir-btn"></button>
            </div>
        `;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('isPWAMode returns true when window.IS_PWA is true', async () => {
        // Importing app.js must not start its asynchronous UI initialization in this unit test.
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        globalThis.window.IS_PWA = true;
        const { isPWAMode } = await import('../projects/app/js/app.js');
        expect(isPWAMode()).toBe(true);
    });

    test('ensureStorageSyncFallback initializes chrome.storage.sync backed by localStorage', async () => {
        expect(globalThis.chrome).toBeUndefined();

        const { ensureStorageSyncFallback } = await import('../shared/js/session_sync.js');
        ensureStorageSyncFallback();

        expect(globalThis.chrome).toBeDefined();
        expect(globalThis.chrome.storage).toBeDefined();
        expect(globalThis.chrome.storage.sync).toBeDefined();

        // Test fallback set & get
        await globalThis.chrome.storage.sync.set({ test_key: 'test_val' });
        const res = await globalThis.chrome.storage.sync.get('test_key');
        expect(res.test_key).toBe('test_val');

        // Test fallback remove
        await globalThis.chrome.storage.sync.remove('test_key');
        const res2 = await globalThis.chrome.storage.sync.get('test_key');
        expect(res2.test_key).toBeUndefined();
    });

    test('writes independent keys and preserves legacy data without rewriting it', async () => {
        const legacy = JSON.stringify({ first: 'old', second: 'legacy' });
        localStorage.setItem('ql_pwa_session_sync', legacy);
        const { ensureStorageSyncFallback } = await import('../shared/js/session_sync.js');
        ensureStorageSyncFallback();
        const firstTab = globalThis.chrome.storage.sync;
        delete globalThis.chrome;
        ensureStorageSyncFallback();
        const secondTab = globalThis.chrome.storage.sync;

        await firstTab.set({ first: 'new' });
        const firstKey = 'ql_pwa_session_sync:first';
        const firstEntry = localStorage.getItem(firstKey);
        await secondTab.set({ third: 'other' });
        await firstTab.remove('second');

        expect(localStorage.getItem(firstKey)).toBe(firstEntry);
        expect(localStorage.getItem('ql_pwa_session_sync')).toBe(legacy);
        expect(await secondTab.get(null)).toEqual({ first: 'new', third: 'other' });
    });

    test.each(['set', 'remove'])('%s reports failed storage writes to callbacks and Promise callers', async (operation) => {
        const { ensureStorageSyncFallback } = await import('../shared/js/session_sync.js');
        ensureStorageSyncFallback();
        const error = new DOMException('Storage is full', 'QuotaExceededError');
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw error;
        });
        jest.spyOn(console, 'error').mockImplementation(() => {});
        let callbackError;
        const argument = operation === 'set' ? { key: 'value' } : 'key';

        await expect(globalThis.chrome.storage.sync[operation](argument, () => {
            callbackError = globalThis.chrome.runtime.lastError;
        })).rejects.toBe(error);

        expect(callbackError).toBe(error);
        expect(globalThis.chrome.runtime.lastError).toBeUndefined();
    });
});
