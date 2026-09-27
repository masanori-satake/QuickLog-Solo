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

let renderAboutQRCodes;
let buildPusherErrorReport;

beforeAll(async () => {
    const ready = jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    ({ renderAboutQRCodes, buildPusherErrorReport } = await import('../projects/app/js/app.js'));
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
    accordion.id = 'pwa-settings-qr-accordion';

    const statusText = document.createElement('p');
    statusText.id = 'pusher-sync-status-text';

    const canvas = document.createElement('canvas');
    canvas.id = 'pusher-sync-qr-canvas';

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
    accordion.appendChild(canvas);
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
    jest.restoreAllMocks();
    closeDatabase();
});

test('renderAboutQRCodes binds toggle listener to pwa-settings-qr-accordion', async () => {
    const accordion = document.getElementById('pwa-settings-qr-accordion');
    expect(accordion.dataset.pusherListenerAdded).toBeUndefined();

    await renderAboutQRCodes();

    expect(accordion.dataset.pusherListenerAdded).toBe('true');
});

test('buildPusherErrorReport generates markdown table with step details and error stack', () => {
    const steps = [
        { name: '1. 鍵・共有ID生成', status: 'success', detail: 'OK' },
        { name: '2. QRコード描画', status: 'success', detail: 'OK' },
        { name: '3. Pusher通信送信', status: 'failed', detail: 'Failed to fetch' },
    ];
    const err = new Error('Failed to fetch');

    const report = buildPusherErrorReport(steps, err);

    expect(report).toContain('### Pusher転送処理 エラーレポート');
    expect(report).toContain('| 1. 鍵・共有ID生成 | 完了 | OK |');
    expect(report).toContain('| 3. Pusher通信送信 | 失敗 | Failed to fetch |');
    expect(report).toContain('**エラー詳細:** Failed to fetch');
});

test('accordion toggle runs startPusherTransferProcess, completes encryption step 4, and fails at step 5 when Pusher is unconfigured', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const accordion = document.getElementById('pwa-settings-qr-accordion');

    await renderAboutQRCodes();

    accordion.open = true;
    accordion.dispatchEvent(new Event('toggle'));

    // Yield to allow async startPusherTransferProcess to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    const errDetails = document.getElementById('pusher-sync-error-details');
    const reportContent = errDetails.textContent;

    expect(reportContent).toContain('| 1. 鍵・共有ID生成 | 完了 | OK |');
    expect(reportContent).toContain('| 2. QRコード描画 | 完了 | OK |');
    expect(reportContent).toContain('| 3. 設定データ取得 | 完了 | OK |');
    expect(reportContent).toContain('| 4. データ暗号化 | 完了 | OK |');
    expect(reportContent).toContain('| 5. Pusher通信送信 | 失敗 | Pusherの設定が未構成です（APIキーまたはクラスタが設定されていません）。 |');
    expect(warnSpy).toHaveBeenCalledWith('Pusher transfer warning:', expect.any(Error));
});
