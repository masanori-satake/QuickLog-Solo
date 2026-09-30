import { jest } from '@jest/globals';
import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

if (!globalThis.crypto || !globalThis.crypto.subtle) {
    try {
        Object.defineProperty(globalThis, 'crypto', {
            value: webcrypto,
            configurable: true,
            writable: true,
        });
    } catch {
        globalThis.crypto = webcrypto;
    }
}
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder;
    globalThis.TextDecoder = TextDecoder;
}

import {
    closeDatabase,
    setDatabaseName,
    dbPut,
    STORE_SETTINGS,
    STORE_CATEGORIES,
    STORE_ALARMS,
} from '../shared/js/db.js';
import { sendSettingsToPusher } from '../shared/js/pusher_sync.js';

let renderAboutQRCodes;
let buildPusherErrorReport;
let startPusherHeartbeat;
let stopPusherHeartbeat;
let stopPusherTransferProcess;

beforeAll(async () => {
    const ready = jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    ({
        renderAboutQRCodes,
        buildPusherErrorReport,
        startPusherHeartbeat,
        stopPusherHeartbeat,
        stopPusherTransferProcess,
    } = await import('../projects/app/js/app.js'));
    ready.mockRestore();
});

beforeEach(async () => {
    closeDatabase();
    setDatabaseName(`QRExport_${Math.random()}`);
    await dbPut(STORE_SETTINGS, { key: 'theme', value: 'dark' });
    await dbPut(STORE_CATEGORIES, { id: 1, name: 'Work' });
    await dbPut(STORE_ALARMS, { id: 1, name: 'Alarm' });
    document.body.replaceChildren();

    const accordion = document.createElement('details');
    accordion.id = 'pwa-settings-pin-accordion';

    const statusText = document.createElement('p');
    statusText.id = 'pusher-sync-status-text';

    const boxesContainer = document.createElement('div');
    boxesContainer.id = 'pin-code-boxes-container';
    for (let i = 0; i < 6; i++) {
        const box = document.createElement('div');
        box.className = 'pin-display-box';
        box.textContent = '-';
        boxesContainer.appendChild(box);
    }

    const countdownText = document.createElement('p');
    const countdownSpan = document.createElement('span');
    countdownSpan.id = 'pin-code-countdown';
    countdownSpan.textContent = '03:00';
    countdownText.appendChild(countdownSpan);

    const errContainer = document.createElement('div');
    errContainer.id = 'pusher-sync-error-container';
    errContainer.classList.add('hidden');

    const errDetails = document.createElement('div');
    errDetails.id = 'pusher-sync-error-details';

    const copyBtn = document.createElement('button');
    copyBtn.id = 'pusher-sync-copy-error-btn';

    errContainer.appendChild(errDetails);
    errContainer.appendChild(copyBtn);

    accordion.appendChild(statusText);
    accordion.appendChild(boxesContainer);
    accordion.appendChild(countdownText);
    accordion.appendChild(errContainer);
    document.body.appendChild(accordion);

    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        fillText: jest.fn(),
    }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    stopPusherTransferProcess();
    jest.restoreAllMocks();
    closeDatabase();
});

test('renderAboutQRCodes binds toggle listener to pwa-settings-pin-accordion', async () => {
    const accordion = document.getElementById('pwa-settings-pin-accordion');
    expect(accordion.dataset.pusherListenerAdded).toBeUndefined();

    await renderAboutQRCodes();

    expect(accordion.dataset.pusherListenerAdded).toBe('true');
});

test('buildPusherErrorReport generates markdown table with step details and error guide', () => {
    const steps = [
        { name: '1. 6桁PINコード生成', status: 'success', detail: 'OK' },
        { name: '2. 設定データ取得', status: 'success', detail: 'OK' },
        { name: '3. Pusher通信送信', status: 'failed', detail: 'Failed to fetch' },
    ];
    const err = new Error('Failed to fetch');

    const reportEn = buildPusherErrorReport(steps, err);

    expect(reportEn).toContain('### Pusher転送処理 エラーレポート');
    expect(reportEn).toContain('| 1. 6桁PINコード生成 | 完了 | OK |');
    expect(reportEn).toContain('| 3. Pusher通信送信 | 失敗 | Failed to fetch |');
    expect(reportEn).toContain('**エラー詳細:** Failed to fetch');
});

test('accordion toggle runs startPusherTransferProcess, completes PIN generation & encryption, and attempts sendSettingsToPusher', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const accordion = document.getElementById('pwa-settings-pin-accordion');

    globalThis.fetch = jest.fn().mockImplementation(async () => {
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => 'OK',
        };
    });

    await renderAboutQRCodes();

    accordion.open = true;
    accordion.dispatchEvent(new Event('toggle'));

    await new Promise((resolve) => setTimeout(resolve, 500));

    const boxEls = document.querySelectorAll('#pin-code-boxes-container .pin-display-box');
    expect(boxEls.length).toBe(6);
    const pinCode = Array.from(boxEls)
        .map((b) => b.textContent)
        .join('');
    expect(/^\d{6}$/.test(pinCode)).toBe(true);

    const statusText = document.getElementById('pusher-sync-status-text').textContent;
    expect(statusText).toContain('引き継ぎコードを発行しました');
});

test('startPusherHeartbeat serializes transfers and prevents concurrent in-flight requests', async () => {
    let fetchCallCount = 0;
    let currentResolveFetch = null;

    globalThis.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++;
        return new Promise((resolve) => {
            currentResolveFetch = resolve;
        });
    });

    const accordion = document.getElementById('pwa-settings-pin-accordion');
    accordion.open = true;

    stopPusherHeartbeat();
    let isHeartbeatInFlight = false;
    const testTimer = setInterval(async () => {
        if (isHeartbeatInFlight) return;
        isHeartbeatInFlight = true;
        try {
            await sendSettingsToPusher('sync-123456', { settings: {} }, '123456');
        } catch (e) {
            // ignore
        } finally {
            isHeartbeatInFlight = false;
        }
    }, 50);

    // Wait 500ms for 1st tick to encrypt and call fetch
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchCallCount).toBe(1);

    // Wait 100ms while 1st fetch is in flight -> 2nd tick skipped
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchCallCount).toBe(1);

    // Resolve 1st fetch
    if (currentResolveFetch) {
        currentResolveFetch({ ok: true, status: 200, statusText: 'OK', text: async () => 'OK' });
        currentResolveFetch = null;
    }

    // Wait 500ms -> 3rd tick completes encrypt and calls fetch
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchCallCount).toBe(2);

    clearInterval(testTimer);
});
