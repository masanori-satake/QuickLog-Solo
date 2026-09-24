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

    test('isPWAMode returns true when window.IS_PWA is true', async () => {
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
});
