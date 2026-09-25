import { jest } from '@jest/globals';
import { openDatabase, closeDatabase, setDatabaseName, dbPut, dbGetAll } from '../shared/js/db.js';

const sessionSync = await import('../shared/js/session_sync.js');
const broadcastSync = jest.fn();
jest.unstable_mockModule('../shared/js/session_sync.js', () => ({ ...sessionSync, broadcastSync }));
let app;
beforeAll(async () => {
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    app = await import('../projects/app/js/app.js');
});

beforeEach(async () => {
    closeDatabase();
    setDatabaseName(`qr-import-${Math.random()}`);
    await openDatabase();
    await dbPut('settings', { key: 'theme', value: 'light' });
    await dbPut('categories', { id: 99, name: 'Existing category' });
    await dbPut('alarms', { id: 99, time: '08:00' });
    document.body.innerHTML =
        '<div id="qr-scan-modal" class="hidden"></div><div id="qr-scan-status"></div><video id="qr-video"></video><button id="qr-select-image-btn"></button>';
    broadcastSync.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    app.closeQRScannerModal();
    closeDatabase();
    jest.restoreAllMocks();
    delete globalThis.BarcodeDetector;
});
const payload = () => ({ v: 1, s: { t: 'dark' }, c: [{ i: 1, n: 'New category' }], a: [{ i: 1, ti: '09:00' }] });
async function expectOriginalData() {
    expect(await dbGetAll('settings')).toEqual([{ key: 'theme', value: 'light' }]);
    expect(await dbGetAll('categories')).toEqual([{ id: 99, name: 'Existing category' }]);
    expect(await dbGetAll('alarms')).toEqual([{ id: 99, time: '08:00' }]);
    expect(broadcastSync).not.toHaveBeenCalled();
}
test('validates all records before updating settings or clearing stores', async () => {
    const data = payload();
    data.a.push({ i: 2, ti: 'bad time' });
    expect(await app.handleImportQRPayload(JSON.stringify(data))).toBe(false);
    await expectOriginalData();
});
test('rolls back clears and settings on a synchronous write failure', async () => {
    const put = globalThis.IDBObjectStore.prototype.put;
    jest.spyOn(globalThis.IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
        if (this.name === 'alarms') throw new DOMException('Write failed', 'DataCloneError');
        return put.apply(this, args);
    });
    expect(await app.handleImportQRPayload(JSON.stringify(payload()))).toBe(false);
    await expectOriginalData();
});
test('rolls back on an asynchronous IndexedDB request failure', async () => {
    const put = globalThis.IDBObjectStore.prototype.put;
    jest.spyOn(globalThis.IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
        if (this.name === 'alarms') {
            this.add(args[0]);
            return this.add(args[0]); // Duplicate primary key aborts the transaction.
        }
        return put.apply(this, args);
    });
    expect(await app.handleImportQRPayload(JSON.stringify(payload()))).toBe(false);
    await expectOriginalData();
});
test('commits all stores before broadcasting success', async () => {
    broadcastSync.mockImplementationOnce(() => {
        expect(document.getElementById('qr-scan-status').textContent).toBe('');
    });
    expect(await app.handleImportQRPayload(JSON.stringify(payload()))).toBe(true);
    expect(await dbGetAll('settings')).toEqual([{ key: 'theme', value: 'dark' }]);
    expect((await dbGetAll('categories')).map((c) => c.id)).toEqual([1]);
    expect((await dbGetAll('alarms')).map((a) => a.id)).toEqual([1]);
    expect(broadcastSync).toHaveBeenCalledTimes(1);
});

function enableCamera() {
    globalThis.BarcodeDetector = class {};
    const getUserMedia = jest.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    return getUserMedia;
}
test('stops every acquired track if the modal closes while awaiting camera permission', async () => {
    const getUserMedia = enableCamera();
    let resolveStream;
    getUserMedia.mockReturnValue(
        new Promise((resolve) => {
            resolveStream = resolve;
        })
    );
    const opening = app.openQRScannerModal();
    await Promise.resolve();
    const tracks = [{ stop: jest.fn() }, { stop: jest.fn() }];
    app.closeQRScannerModal();
    resolveStream({ getTracks: () => tracks });
    await opening;
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    expect(document.getElementById('qr-video').srcObject).toBeUndefined();
});
test('uses the camera while open and stops it on close', async () => {
    const getUserMedia = enableCamera();
    const track = { stop: jest.fn() };
    const stream = { getTracks: () => [track] };
    getUserMedia.mockResolvedValue(stream);
    const video = document.getElementById('qr-video');
    video.play = jest.fn().mockResolvedValue();
    const frame = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(123);
    const cancel = jest.spyOn(window, 'cancelAnimationFrame');
    await app.openQRScannerModal();
    expect(video.srcObject).toBe(stream);
    expect(video.play).toHaveBeenCalled();
    expect(frame).toHaveBeenCalled();
    app.closeQRScannerModal();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(123);
});
test('shows unsupported status and disables image scanning without opening the camera', async () => {
    const getUserMedia = enableCamera();
    delete globalThis.BarcodeDetector;
    await app.openQRScannerModal();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(document.getElementById('qr-select-image-btn').disabled).toBe(true);
    expect(document.getElementById('qr-scan-status').textContent).not.toBe('');
});

describe('image QR scanner sessions', () => {
    let img;
    let detect;
    let detectionStarted;
    let resolveDetection;

    beforeEach(async () => {
        document.getElementById('qr-video').remove();
        const input = document.createElement('input');
        input.id = 'qr-image-file-input';
        input.type = 'file';
        document.body.append(input);
        img = document.createElement('img');
        jest.spyOn(globalThis, 'Image').mockImplementation(() => img);
        URL.createObjectURL = jest.fn().mockReturnValue('blob:qr-test');
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: jest.fn() });
        detectionStarted = new Promise((started) => {
            detect = jest.fn(() => {
                started();
                return new Promise((resolve) => {
                    resolveDetection = resolve;
                });
            });
        });
        globalThis.BarcodeDetector = class {
            detect = detect;
        };
        app.setupQRScanner();
        await app.openQRScannerModal();
        await input.onchange({ target: { files: [new File(['qr'], 'qr.png')] } });
    });

    afterEach(() => {
        delete URL.createObjectURL;
    });

    test.each([false, true])('ignores an image loaded after closing (reopen: %s)', async (reopen) => {
        app.closeQRScannerModal();
        if (reopen) await app.openQRScannerModal();
        const status = document.getElementById('qr-scan-status');
        status.textContent = 'Current status';
        await img.onload();
        expect(detect).not.toHaveBeenCalled();
        expect(status.textContent).toBe('Current status');
        await expectOriginalData();
    });

    test.each([
        [false, false],
        [false, true],
        [true, false],
        [true, true],
    ])('ignores decoding after closing (reopen: %s, found: %s)', async (reopen, found) => {
        const loading = img.onload();
        await detectionStarted;
        app.closeQRScannerModal();
        if (reopen) await app.openQRScannerModal();
        const status = document.getElementById('qr-scan-status');
        status.textContent = 'Current status';
        resolveDetection(found ? [{ rawValue: JSON.stringify(payload()) }] : []);
        await loading;
        expect(status.textContent).toBe('Current status');
        await expectOriginalData();
    });

    test.each([false, true])('handles decoding in the current session (found: %s)', async (found) => {
        const loading = img.onload();
        await detectionStarted;
        const status = document.getElementById('qr-scan-status');
        status.textContent = '';
        const data = payload();
        data.c[0].tg = 'dev,開発';
        resolveDetection(found ? [{ rawValue: JSON.stringify(data) }] : []);
        await loading;
        if (found) {
            expect(await dbGetAll('categories')).toEqual([expect.objectContaining({ id: 1, tags: 'dev,開発' })]);
            expect(broadcastSync).toHaveBeenCalledTimes(1);
        } else {
            expect(status.textContent).not.toBe('');
            await expectOriginalData();
        }
    });

    test('ignores an earlier image that loads after another image is selected', async () => {
        const nextImg = document.createElement('img');
        globalThis.Image.mockImplementationOnce(() => nextImg);
        const input = document.getElementById('qr-image-file-input');
        await input.onchange({ target: { files: [new File(['next'], 'next.png')] } });

        detect.mockResolvedValueOnce([{ rawValue: JSON.stringify(payload()) }]);
        await img.onload();
        expect(detect).not.toHaveBeenCalled();
        await expectOriginalData();
    });

    test.each([false, true])('ignores an earlier decode after another image is selected (found: %s)', async (found) => {
        const firstLoading = img.onload();
        await detectionStarted;
        const nextImg = document.createElement('img');
        globalThis.Image.mockImplementationOnce(() => nextImg);
        const input = document.getElementById('qr-image-file-input');
        await input.onchange({ target: { files: [new File(['next'], 'next.png')] } });

        const status = document.getElementById('qr-scan-status');
        status.textContent = 'New selection';
        resolveDetection(found ? [{ rawValue: JSON.stringify(payload()) }] : []);
        await firstLoading;
        expect(status.textContent).toBe('New selection');
        await expectOriginalData();

        const nextPayload = payload();
        nextPayload.c[0].i = 2;
        nextPayload.a[0].i = 2;
        detect.mockResolvedValueOnce([{ rawValue: JSON.stringify(nextPayload) }]);
        const loading = nextImg.onload();
        await loading;
        expect(await dbGetAll('settings')).toEqual([{ key: 'theme', value: 'dark' }]);
        expect((await dbGetAll('categories')).map((category) => category.id)).toEqual([2]);
        expect((await dbGetAll('alarms')).map((alarm) => alarm.id)).toEqual([2]);
    });
});
