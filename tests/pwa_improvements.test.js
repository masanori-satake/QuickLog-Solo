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

    test('checkPWAAlarms executes pause action for active task when alarm time triggers today', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { checkPWAAlarms, setIsAppInitializedForTesting } = await import('../projects/app/js/app.js');
        const { dbGet, dbPut, dbAdd, dbClear, STORE_SETTINGS, STORE_ALARMS, STORE_LOGS, STORE_CATEGORIES } = await import('../shared/js/db.js');
        await dbClear(STORE_SETTINGS);
        await dbClear(STORE_ALARMS);
        await dbClear(STORE_LOGS);
        await dbClear(STORE_CATEGORIES);
        setIsAppInitializedForTesting(true);

        // Create a work category and an active task
        await dbAdd(STORE_CATEGORIES, { name: 'Development', color: 'primary' });
        const now = Date.now();
        const d = new Date(now);
        const hoursStr = String(d.getHours()).padStart(2, '0');
        const minsStr = String(d.getMinutes()).padStart(2, '0');
        const alarmTime = `${hoursStr}:${minsStr}`;

        const activeLog = {
            category: 'Development',
            startTime: now - 300000,
            endTime: null,
            color: 'primary',
        };
        await dbAdd(STORE_LOGS, activeLog);

        // Add a matching alarm with action "pause"
        await dbAdd(STORE_ALARMS, {
            id: 101,
            enabled: true,
            time: alarmTime,
            type: 'daily',
            action: 'pause',
            message: 'Pause Test',
        });

        await checkPWAAlarms();

        // Verify pauseState setting was saved and task is paused
        const pauseState = await dbGet(STORE_SETTINGS, 'pauseState');
        expect(pauseState).toBeDefined();
        expect(pauseState.value).toBeDefined();
        expect(pauseState.value.isPaused).toBe(true);
        expect(pauseState.value.resumableCategory).toBe('Development');
    });

    test('checkPWAAlarms skips alarm execution on non-business days for daily_business alarms', async () => {
        jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { checkPWAAlarms, setIsAppInitializedForTesting } = await import('../projects/app/js/app.js');
        const { dbGet, dbPut, dbAdd, dbClear, STORE_SETTINGS, STORE_ALARMS, STORE_LOGS, STORE_CATEGORIES } = await import('../shared/js/db.js');
        await dbClear(STORE_SETTINGS);
        await dbClear(STORE_ALARMS);
        await dbClear(STORE_LOGS);
        await dbClear(STORE_CATEGORIES);
        setIsAppInitializedForTesting(true);

        await dbAdd(STORE_CATEGORIES, { name: 'Work', color: 'primary' });
        const now = Date.now();
        const d = new Date(now);
        const hoursStr = String(d.getHours()).padStart(2, '0');
        const minsStr = String(d.getMinutes()).padStart(2, '0');
        const alarmTime = `${hoursStr}:${minsStr}`;

        const activeLog = {
            category: 'Work',
            startTime: now - 300000,
            endTime: null,
            color: 'primary',
        };
        await dbAdd(STORE_LOGS, activeLog);

        // Configure businessDays to exclude current day of week
        const currentDay = d.getDay();
        const nonMatchingBusinessDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => day !== currentDay);
        await dbPut(STORE_SETTINGS, { key: 'businessDays', value: nonMatchingBusinessDays });

        await dbAdd(STORE_ALARMS, {
            id: 102,
            enabled: true,
            time: alarmTime,
            type: 'daily_business',
            action: 'pause',
            message: 'Business Skip Test',
        });

        await checkPWAAlarms();

        // Since current day is not in businessDays, alarm action must not execute
        const pauseState = await dbGet(STORE_SETTINGS, 'pauseState');
        expect(pauseState).toBeUndefined();
    });
});
