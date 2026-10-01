import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Blob } from 'node:buffer';

const makerSource = readFileSync('projects/animation-maker/js/maker.js', 'utf8');
const appSource = readFileSync('projects/app/js/app.js', 'utf8');

// Execute the actual functions and registered callbacks without starting either application's UI.
function section(source, start, end) {
    return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

function gif(width = 1, height = 1, version = '89a') {
    const bytes = new Uint8Array(13);
    bytes.set(Buffer.from(`GIF${version}`));
    new DataView(bytes.buffer).setUint16(6, width, true);
    new DataView(bytes.buffer).setUint16(8, height, true);
    return new Blob([bytes], { type: 'image/gif' });
}

function maker() {
    const oldBitmap = { close: jest.fn() };
    const state = {
        gifBlob: gif(),
        gifFileName: 'existing.gif',
        gifWidth: 10,
        gifHeight: 20,
        gifFrames: [{ bitmap: oldBitmap, duration: 100 }],
        totalDuration: 100,
        focusX: 4,
        focusY: 5,
        targetHeight: 150,
        getMsg: () => 'Invalid GIF',
    };
    const elements = new Proxy(
        {},
        {
            get(target, key) {
                return (target[key] ||= {
                    style: {},
                    classList: { remove: jest.fn() },
                    setAttribute: jest.fn(),
                    addEventListener: jest.fn(function (event, callback) {
                        this[event] = callback;
                    }),
                });
            },
        }
    );
    const frames = [
        { codedWidth: 1, codedHeight: 1, displayWidth: 1, displayHeight: 1, duration: 100000, close: jest.fn() },
    ];
    const decoder = {
        tracks: { ready: Promise.resolve(), selectedTrack: { frameCount: 1 } },
        decode: jest.fn(async ({ frameIndex }) => ({ image: frames[frameIndex] })),
        close: jest.fn(),
    };
    const context = vm.createContext({
        state,
        elements,
        ImageDecoder: jest.fn(function () {
            return decoder;
        }),
        createImageBitmap: jest.fn(async () => ({ close: jest.fn() })),
        console: { error: jest.fn() },
        showAlert: jest.fn(),
        updateMonitor: jest.fn(),
        triggerRedraw: jest.fn(),
        resetAnimationSettings: jest.fn(() => {
            state.targetHeight = 100;
            state.focusX = state.focusY = 0;
        }),
        saveCurrentChanges: jest.fn(),
    });
    vm.runInContext(section(makerSource, 'function validateGifHeader(', '\nfunction updateMonitor('), context);
    vm.runInContext(section(makerSource, '    async function validateGifBlob(', '\n    // Data Transfer'), context);
    for (const start of [
        "    elements.gifFileInput.addEventListener('change'",
        "    elements.rawPreviewContainer.addEventListener('drop'",
    ]) {
        vm.runInContext(section(makerSource, start, '\n    });') + '\n    });', context);
    }
    return { context, state, elements, frames, decoder, oldBitmap };
}

describe('GIF decoding limits and transactional file replacement', () => {
    test.each(['parseGif', 'validateGifBlob'])(
        '%s rejects oversized headers before creating a decoder',
        async (method) => {
            const { context } = maker();
            for (const [width, height] of [
                [2049, 1],
                [1, 2049],
                [0, 1],
                [1, 0],
            ]) {
                expect(await context[method](gif(width, height))).toBe(false);
            }
            expect(context.ImageDecoder).not.toHaveBeenCalled();
        }
    );

    test.each(['parseGif', 'validateGifBlob'])('%s rejects malformed and truncated headers', async (method) => {
        const { context } = maker();
        for (const blob of [new Blob(['GIF89a']), new Blob(['not a gif image'])]) {
            expect(await context[method](blob)).toBe(false);
        }
        expect(context.ImageDecoder).not.toHaveBeenCalled();
    });

    test.each(['parseGif', 'validateGifBlob'])(
        '%s accepts 2048px GIF87a/GIF89a without track dimensions',
        async (method) => {
            for (const version of ['87a', '89a']) {
                const { context, frames, decoder } = maker();
                Object.assign(frames[0], {
                    codedWidth: 2048,
                    codedHeight: 2048,
                    displayWidth: 2048,
                    displayHeight: 2048,
                });
                expect(await context[method](gif(2048, 2048, version))).toBe(true);
                expect(frames[0].close).toHaveBeenCalledTimes(1);
                expect(decoder.close).toHaveBeenCalledTimes(1);
            }
        }
    );

    test.each(['codedWidth', 'codedHeight', 'displayWidth', 'displayHeight'])(
        'rejects oversized VideoFrame %s',
        async (dimension) => {
            for (const method of ['parseGif', 'validateGifBlob']) {
                const { context, frames, decoder } = maker();
                frames[0][dimension] = 2049;
                expect(await context[method](gif())).toBe(false);
                expect(context.createImageBitmap).not.toHaveBeenCalled();
                expect(frames[0].close).toHaveBeenCalledTimes(1);
                expect(decoder.close).toHaveBeenCalledTimes(1);
            }
        }
    );

    test('a later invalid frame discards partial work and preserves the existing state', async () => {
        const { context, state, frames, decoder, oldBitmap } = maker();
        const original = { ...state };
        decoder.tracks.selectedTrack.frameCount = 2;
        frames.push({ ...frames[0], codedWidth: 2049, close: jest.fn() });
        expect(await context.parseGif(gif())).toBe(false);
        expect(state).toEqual(original);
        expect(oldBitmap.close).not.toHaveBeenCalled();
        const bitmap = await context.createImageBitmap.mock.results[0].value;
        expect(bitmap.close).toHaveBeenCalledTimes(1);
        expect(frames[1].close).toHaveBeenCalledTimes(1);
    });

    test.each(['file', 'drop'])('%s selection only saves and resets settings after complete parsing', async (route) => {
        const { context, state, elements, decoder } = maker();
        const original = { ...state };
        const file = gif(100, 100);
        const select = () =>
            route === 'file'
                ? elements.gifFileInput.change({ target: { files: [file] } })
                : elements.rawPreviewContainer.drop({
                      preventDefault: jest.fn(),
                      dataTransfer: { types: ['Files'], files: [file] },
                  });
        // On drop the initial validation succeeds, but full parsing subsequently fails.
        if (route === 'drop')
            decoder.decode.mockResolvedValueOnce({ image: { codedWidth: 1, codedHeight: 1, close: jest.fn() } });
        decoder.decode.mockRejectedValueOnce(new Error('corrupt frame'));
        await select();
        expect(state).toEqual(original);
        expect(context.saveCurrentChanges).not.toHaveBeenCalled();
        expect(context.resetAnimationSettings).not.toHaveBeenCalled();
        await select();
        expect(state.gifBlob).toBe(file);
        expect(state.targetHeight).toBe(100);
        expect(state.focusX).toBe(0.5);
        expect(context.saveCurrentChanges).toHaveBeenCalledTimes(1);
    });

    test('unsupported decoding fails without saving a selected file', async () => {
        const { context, elements } = maker();
        context.ImageDecoder = undefined;
        await elements.gifFileInput.change({ target: { files: [gif()] } });
        expect(context.saveCurrentChanges).not.toHaveBeenCalled();
        expect(context.resetAnimationSettings).not.toHaveBeenCalled();
    });

    test.each(['parseGif', 'validateGifBlob'])('%s enforces byte and frame count limits', async (method) => {
        const { context, decoder } = maker();
        const blob = { size: 5242881, arrayBuffer: jest.fn() };
        expect(await context[method](blob)).toBe(false);
        expect(blob.arrayBuffer).not.toHaveBeenCalled();
        decoder.tracks.selectedTrack.frameCount = 501;
        expect(await context[method](gif())).toBe(false);
        expect(decoder.decode).not.toHaveBeenCalled();
    });
});

function app() {
    const context = vm.createContext({
        Blob,
        atob: jest.fn((input) => atob(input)),
        ArrayBuffer: jest.fn(function (size) {
            return new ArrayBuffer(size);
        }),
        getCustomAnimationMetadataMap: async () => ({}),
        generateUUID: () => 'test-id',
        sanitizeRenderSpec: (spec) => spec,
        saveAnimationBlob: jest.fn(),
        setCustomAnimationMetadataMap: jest.fn(),
        showToast: jest.fn(),
        t: () => '',
        renderCustomAnimationsTab: jest.fn(),
        updateAnimationSelect: jest.fn(),
        renderCategoryList: jest.fn(),
        updateUI: jest.fn(),
        broadcastSync: jest.fn(),
    });
    vm.runInContext(
        section(appSource, 'async function importCustomAnimation(', '\nwindow.importCustomAnimation'),
        context
    );
    return context;
}

function packageText(base64) {
    return JSON.stringify({
        format: 'quicklog-animation-package',
        metadata: { name: 'test' },
        payload: { imageData: `data:image/gif;base64,${base64}`, renderSpec: {} },
    });
}

describe('App Base64 import allocation limits', () => {
    const limit = 5 * 1024 * 1024;
    test.each([limit + 1, limit + 2, limit + 3])(
        'rejects %i decoded bytes before atob or buffer allocation',
        async (size) => {
            const context = app();
            await expect(
                context.importCustomAnimation(packageText(Buffer.alloc(size).toString('base64')))
            ).rejects.toThrow('5MB');
            expect(context.atob).not.toHaveBeenCalled();
            expect(context.ArrayBuffer).not.toHaveBeenCalled();
            expect(context.saveAnimationBlob).not.toHaveBeenCalled();
        }
    );

    test.each([limit - 2, limit - 1, limit])('accepts %i decoded bytes, accounting for padding', async (size) => {
        const context = app();
        await context.importCustomAnimation(packageText(Buffer.alloc(size).toString('base64')));
        expect(context.saveAnimationBlob.mock.calls[0][1].size).toBe(size);
    });

    test('accepts omitted padding and ASCII whitespace at the limit', async () => {
        const context = app();
        const base64 = Buffer.alloc(limit).toString('base64').replace(/=+$/, '');
        await context.importCustomAnimation(packageText(`\t\n${base64}\r\f `));
        expect(context.saveAnimationBlob.mock.calls[0][1].size).toBe(limit);
    });

    test('malformed Base64 fails without allocating a buffer or saving', async () => {
        const context = app();
        await expect(context.importCustomAnimation(packageText('%%%'))).rejects.toThrow();
        expect(context.ArrayBuffer).not.toHaveBeenCalled();
        expect(context.saveAnimationBlob).not.toHaveBeenCalled();
    });

    test('retains the secondary blob size check', async () => {
        const context = app();
        context.Blob = class {
            size = limit + 1;
        };
        await expect(context.importCustomAnimation(packageText('AA=='))).rejects.toThrow('5MB');
        expect(context.saveAnimationBlob).not.toHaveBeenCalled();
    });
});
