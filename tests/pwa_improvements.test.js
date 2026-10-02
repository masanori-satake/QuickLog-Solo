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

    test('isPinWindowSupported checks documentPictureInPicture availability', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { isPinWindowSupported } = await import('../projects/app/js/app.js');

        delete window.documentPictureInPicture;
        expect(isPinWindowSupported()).toBe(false);

        window.documentPictureInPicture = { requestWindow: jest.fn() };
        expect(isPinWindowSupported()).toBe(true);
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

    test('applyTimerHeight sets --timer-height-factor on body and documentElement', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { applyTimerHeight } = await import('../projects/app/js/app.js');

        applyTimerHeight('compact');
        expect(document.body.classList.contains('timer-compact')).toBe(true);
        expect(document.body.style.getPropertyValue('--timer-height-factor')).toBe('0.6666666666666666');
        expect(document.documentElement.style.getPropertyValue('--timer-height-factor')).toBe('0.6666666666666666');

        applyTimerHeight('mini');
        expect(document.body.classList.contains('timer-mini')).toBe(true);
        expect(document.body.style.getPropertyValue('--timer-height-factor')).toBe('0.5');
        expect(document.documentElement.style.getPropertyValue('--timer-height-factor')).toBe('0.5');

        applyTimerHeight('normal');
        expect(document.body.classList.contains('timer-normal')).toBe(true);
        expect(document.body.style.getPropertyValue('--timer-height-factor')).toBe('1');
        expect(document.documentElement.style.getPropertyValue('--timer-height-factor')).toBe('1');
    });

    test('showPipPlaceholder and hidePipPlaceholder manage placeholder UI and body class', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { showPipPlaceholder, hidePipPlaceholder } = await import('../projects/app/js/app.js');

        showPipPlaceholder();
        expect(document.body.classList.contains('pip-active')).toBe(true);
        const placeholder = document.getElementById('pip-placeholder');
        expect(placeholder).not.toBeNull();
        expect(placeholder.querySelector('.pip-placeholder-text')).not.toBeNull();

        const restoreBtn = document.getElementById('pip-restore-btn');
        expect(restoreBtn).not.toBeNull();

        hidePipPlaceholder();
        expect(document.body.classList.contains('pip-active')).toBe(false);
        expect(document.getElementById('pip-placeholder')).toBeNull();
    });

    test('openPinWindow creates placeholder and onPipWindowClosed cleans up and returns focus', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { openPinWindow, isPinWindowSupported } = await import('../projects/app/js/app.js');

        const mockPipBody = document.createElement('body');
        const mockPipHead = document.createElement('head');
        const mockPipDocEl = document.createElement('html');
        let pageHideListener = null;

        const mockPipWindow = {
            document: {
                head: mockPipHead,
                body: mockPipBody,
                documentElement: mockPipDocEl,
                getElementById: (id) => mockPipBody.querySelector(`#${id}`) || document.getElementById(id),
                querySelectorAll: (sel) => mockPipBody.querySelectorAll(sel),
            },
            addEventListener: jest.fn((event, cb) => {
                if (event === 'pagehide') {
                    pageHideListener = cb;
                }
            }),
            close: jest.fn(() => {
                if (pageHideListener) pageHideListener();
            }),
        };

        window.documentPictureInPicture = {
            requestWindow: jest.fn().mockResolvedValue(mockPipWindow),
        };
        const focusSpy = jest.spyOn(window, 'focus').mockImplementation(() => {});

        expect(isPinWindowSupported()).toBe(true);
        await openPinWindow();

        expect(document.body.classList.contains('pip-active')).toBe(true);
        expect(document.getElementById('pip-placeholder')).not.toBeNull();
        expect(mockPipBody.querySelector('#app')).not.toBeNull();
        expect(mockPipBody.style.getPropertyValue('--timer-height-factor')).toBe('1');
        expect(mockPipDocEl.style.getPropertyValue('--timer-height-factor')).toBe('1');

        // Restore via button click
        const restoreBtn = document.getElementById('pip-restore-btn');
        expect(restoreBtn).not.toBeNull();
        restoreBtn.click();

        expect(document.body.classList.contains('pip-active')).toBe(false);
        expect(document.getElementById('pip-placeholder')).toBeNull();
        expect(document.body.classList.contains('pip-active')).toBe(false);
        expect(document.getElementById('pip-placeholder')).toBeNull();
        expect(document.getElementById('app')).not.toBeNull();
        expect(focusSpy).toHaveBeenCalled();
    });

    test('setupPinSync attaches keyboard navigation, input type, and paste events to PIN inputs', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        document.body.innerHTML = `
            <div id="pin-inputs-container">
                <input type="text" pattern="[0-9]*" inputmode="numeric" maxlength="1" class="pin-digit-input" />
                <input type="text" pattern="[0-9]*" inputmode="numeric" maxlength="1" class="pin-digit-input" />
                <input type="text" pattern="[0-9]*" inputmode="numeric" maxlength="1" class="pin-digit-input" />
                <input type="text" pattern="[0-9]*" inputmode="numeric" maxlength="1" class="pin-digit-input" />
                <input type="text" pattern="[0-9]*" inputmode="numeric" maxlength="1" class="pin-digit-input" />
                <input type="text" pattern="[0-9]*" inputmode="numeric" maxlength="1" class="pin-digit-input" />
            </div>
            <button id="pwa-start-pin-sync-btn"></button>
            <button id="pin-sync-close-btn"></button>
            <button id="pin-reset-attempts-btn"></button>
        `;

        const { setupPinSync } = await import('../projects/app/js/app.js');
        setupPinSync();

        const inputs = Array.from(document.querySelectorAll('.pin-digit-input'));
        expect(inputs.length).toBe(6);
        inputs.forEach((input) => {
            expect(input.getAttribute('type')).toBe('text');
        });

        // Test ArrowUp / ArrowDown preventDefault
        const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
        inputs[0].dispatchEvent(arrowUpEvent);
        expect(arrowUpEvent.defaultPrevented).toBe(true);

        const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
        inputs[0].dispatchEvent(arrowDownEvent);
        expect(arrowDownEvent.defaultPrevented).toBe(true);

        // Test ArrowRight focus move
        inputs[0].focus();
        const arrowRightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
        inputs[0].dispatchEvent(arrowRightEvent);
        expect(arrowRightEvent.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(inputs[1]);

        // Test ArrowLeft focus move
        const arrowLeftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
        inputs[1].dispatchEvent(arrowLeftEvent);
        expect(arrowLeftEvent.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(inputs[0]);

        // Test Paste event handling for 6 digits
        const pasteData = { getData: (format) => (format === 'text' ? '123456' : '') };
        const pasteEvent = new Event('paste', { cancelable: true });
        pasteEvent.clipboardData = pasteData;
        inputs[0].dispatchEvent(pasteEvent);

        expect(pasteEvent.defaultPrevented).toBe(true);
        expect(inputs.map((i) => i.value).join('')).toBe('123456');
        inputs.forEach((input) => {
            expect(input.disabled).toBe(true);
        });
    });

    test('renderAboutQRCodes handles pwaSupport toggle state and visibility', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        document.body.innerHTML = `
            <div id="pwa-qr-export-section">
                <input type="checkbox" id="pwa-support-toggle" />
                <div id="pwa-support-details-container" class="hidden"></div>
            </div>
        `;

        const { renderAboutQRCodes } = await import('../projects/app/js/app.js');
        const { dbGet, STORE_SETTINGS, SETTING_KEY_PWA_SUPPORT } = await import('../shared/js/db.js');

        // Initial render (pwaSupport default OFF)
        await renderAboutQRCodes();
        const toggle = document.getElementById('pwa-support-toggle');
        const detailsContainer = document.getElementById('pwa-support-details-container');

        expect(toggle.checked).toBe(false);
        expect(detailsContainer.classList.contains('hidden')).toBe(true);

        // Toggle ON and trigger change event
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));

        expect(detailsContainer.classList.contains('hidden')).toBe(false);

        // Verify persistence via dbGet
        const savedSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PWA_SUPPORT);
        expect(savedSetting).toBeDefined();
        expect(savedSetting.value).toBe(true);

        // Re-render reflects ON state without direct dbPut
        await renderAboutQRCodes();
        expect(toggle.checked).toBe(true);
        expect(detailsContainer.classList.contains('hidden')).toBe(false);
    });

    test('copyToClipboard uses navigator.clipboard.writeText when available and succeeds', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { copyToClipboard } = await import('../projects/app/js/app.js');

        const writeTextSpy = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextSpy },
            configurable: true,
        });

        const result = await copyToClipboard('7:39');
        expect(result).toBe(true);
        expect(writeTextSpy).toHaveBeenCalledWith('7:39');
    });

    test('copyToClipboard falls back to execCommand when writeText rejects', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { copyToClipboard } = await import('../projects/app/js/app.js');

        const writeTextSpy = jest.fn().mockRejectedValue(new DOMException('Document is not focused', 'NotAllowedError'));
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextSpy },
            configurable: true,
        });

        document.execCommand = jest.fn().mockReturnValue(true);

        const result = await copyToClipboard('移動 7:39');
        expect(result).toBe(true);
        expect(writeTextSpy).toHaveBeenCalledWith('移動 7:39');
        expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    test('copyToClipboard returns false when both writeText and execCommand fail', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { copyToClipboard } = await import('../projects/app/js/app.js');

        const writeTextSpy = jest.fn().mockRejectedValue(new Error('Failed'));
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextSpy },
            configurable: true,
        });

        document.execCommand = jest.fn().mockReturnValue(false);

        const result = await copyToClipboard('fail text');
        expect(result).toBe(false);
    });

    test('copyToClipboard uses pipWindow navigator when pipWindow is open', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { copyToClipboard, openPinWindow } = await import('../projects/app/js/app.js');

        const pipWriteTextSpy = jest.fn().mockResolvedValue(undefined);
        const mockPipBody = document.createElement('body');
        const mockPipWindow = {
            closed: false,
            document: {
                body: mockPipBody,
                head: document.createElement('head'),
                documentElement: document.createElement('html'),
                getElementById: () => null,
                querySelectorAll: () => [],
                execCommand: jest.fn().mockReturnValue(false),
            },
            navigator: {
                clipboard: {
                    writeText: pipWriteTextSpy,
                },
            },
            addEventListener: jest.fn(),
            close: jest.fn(),
        };

        window.documentPictureInPicture = {
            requestWindow: jest.fn().mockResolvedValue(mockPipWindow),
        };

        await openPinWindow();

        const parentWriteTextSpy = jest.fn().mockRejectedValue(new DOMException('Document not focused', 'NotAllowedError'));
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: parentWriteTextSpy },
            configurable: true,
        });

        const result = await copyToClipboard('pip text');
        expect(result).toBe(true);
        expect(pipWriteTextSpy).toHaveBeenCalledWith('pip text');
    });
});
