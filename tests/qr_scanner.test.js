import { jest } from '@jest/globals';

let openQRScannerModal;
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
    ({ openQRScannerModal, closeQRScannerModal } = await import('../projects/app/js/app.js'));
    ready.mockRestore();
});
beforeEach(() => {
    document.body.innerHTML =
        '<div id="qr-scan-modal" class="hidden"></div><video id="qr-video"></video><div id="qr-scan-status"></div>';
    getUserMedia = jest.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
    closeQRScannerModal();
    jest.restoreAllMocks();
    delete navigator.mediaDevices;
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
