/**
 * custom_animations.test.js
 * Unit tests for custom animations storage and GenericGifAnimation module.
 */

import { jest } from '@jest/globals';
import { saveAnimationBlob, getAnimationBlob, deleteAnimationBlob, initAnimationDB } from '../shared/js/idb_storage.js';
import GenericGifAnimation from '../shared/js/animation/generic_gif_animation.js';

describe('Custom Animations Storage & Rendering fallback', () => {
    beforeAll(async () => {
        // Setup simple IndexedDB globals in Jest jsdom if needed
        await initAnimationDB();
    });

    test('should save, retrieve and delete custom animation blobs', async () => {
        const id = 'test-anim-id-123';
        const blob = new Blob(['dummy-gif-bytes'], { type: 'image/gif' });
        const renderSpec = {
            focusX: 10,
            focusY: 10,
            targetHeight: 120,
            maxWidth: 240,
            scaleWithHeight: true,
            overflowBehavior: 'repeat'
        };

        // Save
        await saveAnimationBlob(id, blob, renderSpec);

        // Retrieve directly from DB
        const dbName = 'QuickLogAnimationDB';
        const storeName = 'blobs';
        const record = await new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const getReq = store.get(id);
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => reject(getReq.error);
            };
            req.onerror = () => reject(req.error);
        });

        expect(record).toBeDefined();
        expect(record.id).toBe(id);
        expect(record.blob).toBeDefined();
        expect(record.renderSpec).toBeDefined();
        expect(record.renderSpec.maxWidth).toBe(240);
        expect(record.renderSpec.overflowBehavior).toBe('repeat');

        // Get blob using utility
        const retrievedBlob = await getAnimationBlob(id);
        expect(retrievedBlob).toBeDefined();

        // Delete
        await deleteAnimationBlob(id);
        const deletedBlob = await getAnimationBlob(id);
        expect(deletedBlob).toBeNull();
    });

    test('GenericGifAnimation gracefully falls back if ImageDecoder is not available', async () => {
        const anim = new GenericGifAnimation();
        expect(anim.frames).toEqual([]);
        expect(anim.totalDuration).toBe(0);

        // Call loadCustomGif on non-existent ID - should not crash
        await anim.loadCustomGif('non-existent-id');
        expect(anim.frames).toEqual([]);
    });

    test('GenericGifAnimation uses ImageDecoder API to decode custom GIF correctly when available', async () => {
        const id = 'test-anim-image-decoder-mock';
        const blob = new Blob(['mock-gif-bytes'], { type: 'image/gif' });
        const renderSpec = {
            focusX: 10,
            focusY: 10,
            targetHeight: 120,
            maxWidth: 240,
            scaleWithHeight: true,
            overflowBehavior: 'repeat'
        };

        // Ensure Blob.prototype.arrayBuffer exists in this JSDOM/Node environment
        const originalArrayBuffer = global.Blob.prototype.arrayBuffer;
        global.Blob.prototype.arrayBuffer = async function() {
            return new ArrayBuffer(8);
        };

        // Override structuredClone to bypass Blob serialization issues with fake-indexeddb
        const originalStructuredClone = globalThis.structuredClone;
        globalThis.structuredClone = (val) => {
            if (val instanceof Blob) return val;
            if (val && typeof val === 'object' && val.blob instanceof Blob) {
                return {
                    ...val,
                    blob: val.blob
                };
            }
            return originalStructuredClone ? originalStructuredClone(val) : JSON.parse(JSON.stringify(val));
        };

        await saveAnimationBlob(id, blob, renderSpec);

        // Mock ImageDecoder and createImageBitmap
        const originalImageDecoder = global.ImageDecoder;
        const originalCreateImageBitmap = global.createImageBitmap;

        const mockClose = jest.fn();
        class MockImageTrack {
            constructor() {
                this.frameCount = 2;
            }
        }
        class MockImageTrackList {
            constructor() {
                this.selectedTrack = new MockImageTrack();
                this.ready = Promise.resolve();
            }
        }

        global.ImageDecoder = class MockImageDecoder {
            constructor() {
                this.tracks = new MockImageTrackList();
            }
            async decode() {
                return {
                    image: {
                        duration: 150000, // 150ms in microseconds
                        close: mockClose
                    }
                };
            }
        };

        global.createImageBitmap = jest.fn().mockImplementation(async () => {
            return { width: 100, height: 100, close: jest.fn() };
        });

        try {
            const anim = new GenericGifAnimation();
            await anim.loadCustomGif(id);

            expect(global.createImageBitmap).toHaveBeenCalledTimes(2);
            expect(mockClose).toHaveBeenCalledTimes(2);
            expect(anim.frames.length).toBe(2);
            expect(anim.frames[0].duration).toBe(150); // 150000 microseconds / 1000
            expect(anim.totalDuration).toBe(300);
            expect(anim.renderSpec.overflowBehavior).toBe('repeat');
        } finally {
            // Restore originals
            global.ImageDecoder = originalImageDecoder;
            global.createImageBitmap = originalCreateImageBitmap;
            globalThis.structuredClone = originalStructuredClone;
            if (originalArrayBuffer) {
                global.Blob.prototype.arrayBuffer = originalArrayBuffer;
            } else {
                delete global.Blob.prototype.arrayBuffer;
            }
            await deleteAnimationBlob(id);
        }
    });

    test('GenericGifAnimation handles missing tracks or missing selectedTrack gracefully', async () => {
        const id = 'test-anim-missing-track';
        const blob = new Blob(['mock-gif-bytes'], { type: 'image/gif' });

        // Ensure Blob.prototype.arrayBuffer exists in this JSDOM/Node environment
        const originalArrayBuffer = global.Blob.prototype.arrayBuffer;
        global.Blob.prototype.arrayBuffer = async function() {
            return new ArrayBuffer(8);
        };

        // Override structuredClone to bypass Blob serialization issues with fake-indexeddb
        const originalStructuredClone = globalThis.structuredClone;
        globalThis.structuredClone = (val) => {
            if (val instanceof Blob) return val;
            if (val && typeof val === 'object' && val.blob instanceof Blob) {
                return {
                    ...val,
                    blob: val.blob
                };
            }
            return originalStructuredClone ? originalStructuredClone(val) : JSON.parse(JSON.stringify(val));
        };

        await saveAnimationBlob(id, blob, {});

        const originalImageDecoder = global.ImageDecoder;
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Scenario A: decoder.tracks is undefined
        global.ImageDecoder = class MockImageDecoderNoTracks {
            constructor() {}
        };

        try {
            const anim = new GenericGifAnimation();
            await anim.loadCustomGif(id);
            expect(anim.frames).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'GenericGifAnimation: Failed to decode custom GIF:',
                expect.any(Error)
            );
        } finally {
            global.ImageDecoder = originalImageDecoder;
            globalThis.structuredClone = originalStructuredClone;
            if (originalArrayBuffer) {
                global.Blob.prototype.arrayBuffer = originalArrayBuffer;
            } else {
                delete global.Blob.prototype.arrayBuffer;
            }
            consoleErrorSpy.mockRestore();
            await deleteAnimationBlob(id);
        }
    });
});
