/**
 * custom_animations.test.js
 * Unit tests for custom animations storage and GenericGifAnimation module.
 */

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
});
