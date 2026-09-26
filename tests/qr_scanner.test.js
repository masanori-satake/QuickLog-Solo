import { jest } from '@jest/globals';
import { closeDatabase, setDatabaseName, dbPut, dbGetAll, STORE_SETTINGS } from '../shared/js/db.js';

let setupQRScanner;
let openQRScannerModal;
let detect;
let images;
let closeQRScannerModal;
let getUserMedia;
let play;
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
const makeStream = () => {
    const tracks = [{ stop: jest.fn() }, { stop: jest.fn() }];
    return { getTracks: () => tracks };
};

beforeAll(async () => {
    const ready = jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    ({ setupQRScanner, openQRScannerModal, closeQRScannerModal } = await import('../projects/app/js/app.js'));
    ready.mockRestore();
});
beforeEach(async () => {
    closeDatabase();
    setDatabaseName(`QRScanner_${Math.random()}`);
    await dbPut(STORE_SETTINGS, { key: 'theme', value: 'dark' });
    document.body.innerHTML =
        '<div id="qr-scan-modal" class="hidden"></div><video id="qr-video"></video><div id="qr-scan-status"></div>' +
        '<button id="qr-select-image-btn"></button><input id="qr-image-file-input" type="file">';
    images = [];
    jest.spyOn(window, 'Image').mockImplementation(() => {
        const img = { width: 100, height: 100 };
        images.push(img);
        return img;
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    detect = jest.fn().mockResolvedValue([{ rawValue: JSON.stringify({ v: 1, s: { t: 'light' }, c: [], a: [] }) }]);
    globalThis.BarcodeDetector = class {
        detect = detect;
    };
    setupQRScanner();
    getUserMedia = jest.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: jest.fn() });
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
    closeQRScannerModal();
    jest.restoreAllMocks();
    delete navigator.mediaDevices;
    delete globalThis.BarcodeDetector;
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
    closeDatabase();
});

test.each(['close', 'hide'])('stops all late camera tracks when the modal action is %s', async (action) => {
    const camera = deferred();
    const stream = makeStream();
    getUserMedia.mockReturnValue(camera.promise);
    const pending = openQRScannerModal();
    if (action === 'close') closeQRScannerModal();
    else document.getElementById('qr-scan-modal').classList.add('hidden');
    camera.resolve(stream);
    await pending;
    for (const track of stream.getTracks()) expect(track.stop).toHaveBeenCalledTimes(1);
    expect(document.getElementById('qr-video').srcObject).toBeUndefined();
    expect(play).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
});

test('an old camera request cannot replace the stream of a reopened modal', async () => {
    const oldCamera = deferred();
    const oldStream = makeStream();
    const newStream = makeStream();
    getUserMedia.mockReturnValueOnce(oldCamera.promise).mockResolvedValueOnce(newStream);
    const pending = openQRScannerModal();
    closeQRScannerModal();
    await openQRScannerModal();
    oldCamera.resolve(oldStream);
    await pending;
    for (const track of oldStream.getTracks()) expect(track.stop).toHaveBeenCalledTimes(1);
    for (const track of newStream.getTracks()) expect(track.stop).not.toHaveBeenCalled();
    expect(document.getElementById('qr-video').srcObject).toBe(newStream);
    expect(play).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
});

test('closing while video.play is pending cannot restart scanning', async () => {
    const playback = deferred();
    const stream = makeStream();
    getUserMedia.mockResolvedValue(stream);
    play.mockReturnValue(playback.promise);
    const pending = openQRScannerModal();
    await Promise.resolve();
    expect(play).toHaveBeenCalled();
    closeQRScannerModal();
    playback.resolve();
    await pending;
    for (const track of stream.getTracks()) expect(track.stop).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
});

const selectImage = () => document.getElementById('qr-image-file-input').onchange({ target: { files: [{}] } });
const theme = async () => (await dbGetAll(STORE_SETTINGS)).find((setting) => setting.key === 'theme').value;

test.each(['loading', 'decoding'])('camera startup preserves an image that is still %s', async (stage) => {
    const camera = deferred();
    const decoding = deferred();
    getUserMedia.mockReturnValue(camera.promise);
    const opening = openQRScannerModal();
    await selectImage();
    let loading;
    if (stage === 'decoding') {
        detect.mockReturnValueOnce(decoding.promise);
        loading = images[0].onload();
    }
    camera.resolve(makeStream());
    await opening;
    expect(requestAnimationFrame).toHaveBeenCalled();
    if (stage === 'loading') loading = images[0].onload();
    else decoding.resolve([{ rawValue: JSON.stringify({ v: 1, s: { t: 'light' }, c: [], a: [] }) }]);
    await loading;
    expect(await theme()).toBe('light');
    expect(document.getElementById('qr-scan-modal').classList.contains('hidden')).toBe(true);
});

test.each(['loading', 'decoding'])('reselecting an image ignores the old image while %s', async (stage) => {
    const decoding = deferred();
    await selectImage();
    let loading;
    if (stage === 'decoding') {
        detect.mockReturnValueOnce(decoding.promise);
        loading = images[0].onload();
    }
    await selectImage();
    if (stage === 'loading') loading = images[0].onload();
    else decoding.resolve([{ rawValue: JSON.stringify({ v: 1, s: { t: 'light' }, c: [], a: [] }) }]);
    await loading;
    expect(await theme()).toBe('dark');
    await images[1].onload();
    expect(await theme()).toBe('light');
});

test.each([
    ['image', 'reselect'],
    ['image', 'close'],
    ['image', 'reopen'],
    ['camera', 'reselect'],
    ['camera', 'close'],
    ['camera', 'reopen'],
])('%s import rolls back when %s occurs before commit', async (source, action) => {
    getUserMedia.mockResolvedValue(makeStream());
    await openQRScannerModal();
    const originalPut = globalThis.IDBObjectStore.prototype.put;
    jest.spyOn(globalThis.IDBObjectStore.prototype, 'put').mockImplementation(function (record) {
        const request = originalPut.call(this, record);
        request.addEventListener(
            'success',
            () => {
                if (action === 'reselect') selectImage();
                else if (action === 'close') closeQRScannerModal();
                else openQRScannerModal();
            },
            { once: true }
        );
        return request;
    });
    if (source === 'image') {
        await selectImage();
        await images[0].onload();
    } else {
        const video = document.getElementById('qr-video');
        Object.defineProperty(video, 'paused', { value: false });
        Object.defineProperty(video, 'readyState', { value: video.HAVE_ENOUGH_DATA });
        await requestAnimationFrame.mock.calls[0][0]();
    }
    expect(await theme()).toBe('dark');
    expect(document.getElementById('qr-scan-modal').classList.contains('hidden')).toBe(action === 'close');
    expect(document.getElementById('qr-scan-status').textContent).not.toContain('無効');
});

test('decodes generated QR code matrix using pure JS fallback when BarcodeDetector is unavailable', async () => {
    delete globalThis.BarcodeDetector;
    const { serializeSettingsPayload, renderQRCodeToCanvas, decodeQRCodeFromCanvas } = await import('../shared/js/qr_code.js');

    const expectedPayload = serializeSettingsPayload({
        settings: { theme: 'light', language: 'ja' },
        categories: [{ id: 'cat_test', name: 'テスト業務', color: 'primary' }],
        alarms: [],
    });

    const canvasWidth = 360;
    const canvasPixels = new Uint8ClampedArray(canvasWidth * canvasWidth * 4);

    const mockCtx = {
        fillStyle: '#ffffff',
        fillRect: jest.fn((x, y, w, h) => {
            const isBlack = mockCtx.fillStyle === '#000000';
            for (let py = y; py < y + h; py++) {
                for (let px = x; px < x + w; px++) {
                    if (px >= 0 && px < canvasWidth && py >= 0 && py < canvasWidth) {
                        const idx = (py * canvasWidth + px) * 4;
                        const val = isBlack ? 0 : 255;
                        canvasPixels[idx] = val;
                        canvasPixels[idx + 1] = val;
                        canvasPixels[idx + 2] = val;
                        canvasPixels[idx + 3] = 255;
                    }
                }
            }
        }),
    };

    const canvas = {
        width: canvasWidth,
        height: canvasWidth,
        getContext: (type) => (type === '2d' ? mockCtx : null),
    };

    renderQRCodeToCanvas(expectedPayload, canvas, { width: canvasWidth, margin: 4 });

    const decodedResult = await decodeQRCodeFromCanvas({
        width: canvasWidth,
        height: canvasWidth,
        data: canvasPixels,
    });

    expect(decodedResult).toBe(expectedPayload);
});
