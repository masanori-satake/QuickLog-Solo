import {
    initAnimationDB,
    saveAnimationBlob,
    initAnimationDraftDB,
    saveAnimationDraftBlob,
    getAnimationDraftBlob,
    getAnimationDraftRecord,
    getAllAnimationDraftRecords,
    deleteAnimationDraftBlob,
    clearAnimationDraftDB,
    getAnimationBlob,
    deleteAnimationBlob,
    closeAnimationDB,
    closeAnimationDraftDB
} from '../shared/js/idb_storage.js';
import 'fake-indexeddb/auto';

/**
 * @jest-environment jsdom
 */

if (!Blob.prototype.text) {
    Blob.prototype.text = function() {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(this);
        });
    };
}

async function readBlobAsText(blob) {
    if (!blob) return '';
    return await blob.text();
}

describe('IDB Storage Module', () => {
    let originalStructuredClone;

    beforeAll(() => {
        originalStructuredClone = globalThis.structuredClone;
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
    });

    afterAll(() => {
        globalThis.structuredClone = originalStructuredClone;
    });

    beforeEach(async () => {
        closeAnimationDB();
        closeAnimationDraftDB();

        const req1 = indexedDB.deleteDatabase('QuickLogAnimationDB');
        await new Promise((resolve, reject) => {
            req1.onsuccess = resolve;
            req1.onerror = reject;
        });

        const req2 = indexedDB.deleteDatabase('QuickLogAnimationDraftDB');
        await new Promise((resolve, reject) => {
            req2.onsuccess = resolve;
            req2.onerror = reject;
        });
    });

    afterEach(() => {
        closeAnimationDB();
        closeAnimationDraftDB();
    });

    test('getAnimationBlob, getAnimationDraftBlob, getAnimationDraftRecord edge cases', async () => {
        // Missing valid ID (null / undefined / empty / non-string) - should assert null
        const invalidIDs = ['', null, undefined, 123, { a: 1 }];
        for (const id of invalidIDs) {
            expect(await getAnimationBlob(id)).toBeNull();
            expect(await getAnimationDraftBlob(id)).toBeNull();
            expect(await getAnimationDraftRecord(id)).toBeNull();
        }

        // Existing missing valid ID
        expect(await getAnimationBlob('non-existent-id')).toBeNull();
        expect(await getAnimationDraftBlob('non-existent-id')).toBeNull();
        expect(await getAnimationDraftRecord('non-existent-id')).toBeNull();
    });

    test('write APIs handle invalid non-Blob value cases', async () => {
        // saveAnimationBlob with non-Blob should return/do nothing
        await expect(saveAnimationBlob('anim-1', 'not-a-blob', {}, {})).resolves.toBeUndefined();
        expect(await getAnimationBlob('anim-1')).toBeNull();

        // saveAnimationDraftBlob with non-Blob should return/do nothing
        await expect(saveAnimationDraftBlob('draft-1', 'not-a-blob', {}, {})).resolves.toBeUndefined();
        expect(await getAnimationDraftBlob('draft-1')).toBeNull();
    });

    test('write/delete APIs exit without starting IndexedDB operations when ID is invalid', async () => {
        // If we call with invalid ID, it should return early without creating/opening IndexedDB
        // We can verify this by checking that the databases are NOT created in IndexedDB
        closeAnimationDB();
        closeAnimationDraftDB();

        // Ensure both databases are deleted first
        await new Promise((resolve) => {
            const req = indexedDB.deleteDatabase('QuickLogAnimationDB');
            req.onsuccess = () => resolve();
        });
        await new Promise((resolve) => {
            const req = indexedDB.deleteDatabase('QuickLogAnimationDraftDB');
            req.onsuccess = () => resolve();
        });

        // Call write/delete with invalid IDs
        await deleteAnimationBlob('');
        await deleteAnimationDraftBlob('');
        await saveAnimationBlob('', new Blob(['dummy']), {}, {});

        // Check databases were NOT opened/created
        const databases = await indexedDB.databases();
        const animDbExists = databases.some(db => db.name === 'QuickLogAnimationDB');
        const draftDbExists = databases.some(db => db.name === 'QuickLogAnimationDraftDB');
        expect(animDbExists).toBe(false);
        expect(draftDbExists).toBe(false);
    });

    test('deleteAnimationBlob does not throw error if ID does not exist', async () => {
        await expect(deleteAnimationBlob('non-existent-id')).resolves.not.toThrow();
    });

    test('clearAnimationDraftDB does not throw error on empty db', async () => {
        await expect(clearAnimationDraftDB()).resolves.not.toThrow();
    });

    test('saveAnimationBlob and getAnimationBlob roundtrip', async () => {
        const mockBlob = new Blob(['animation-data'], { type: 'image/gif' });
        const renderSpec = { fps: 30 };
        const config = { exclusionStrategy: 'freedom' };

        await saveAnimationBlob('anim-1', mockBlob, renderSpec, config);

        const fetchedBlob = await getAnimationBlob('anim-1');
        expect(fetchedBlob).toBeDefined();
        expect(fetchedBlob).toBeInstanceOf(Blob);

        const text = await readBlobAsText(fetchedBlob);
        expect(text).toBe('animation-data');
    });

    test('draft flow works correctly', async () => {
        const mockBlob = new Blob(['draft-data'], { type: 'image/gif' });
        const renderSpec = { fps: 60 };
        const config = { exclusionStrategy: 'avoid' };

        await saveAnimationDraftBlob('draft-1', mockBlob, renderSpec, config);

        const fetchedBlob = await getAnimationDraftBlob('draft-1');
        expect(fetchedBlob).toBeDefined();
        expect(fetchedBlob).toBeInstanceOf(Blob);
        expect(await readBlobAsText(fetchedBlob)).toBe('draft-data');

        const fetchedRecord = await getAnimationDraftRecord('draft-1');
        expect(fetchedRecord.renderSpec).toEqual(renderSpec);

        const allRecords = await getAllAnimationDraftRecords();
        expect(allRecords.length).toBe(1);
        expect(allRecords[0].id).toBe('draft-1');

        await deleteAnimationDraftBlob('draft-1');
        const updatedRecord = await getAnimationDraftRecord('draft-1');
        expect(updatedRecord.deleted).toBe(true);

        await clearAnimationDraftDB();
        const recordsAfterClear = await getAllAnimationDraftRecords();
        expect(recordsAfterClear.length).toBe(0);
    });

    // =============================================================================
    // Property-Based Tests (Deterministic)
    // =============================================================================

    describe('Property 16: Blob ストレージのラウンドトリップ (Deterministic)', () => {
        test('save and retrieve custom animation blob successfully', async () => {
            const testCases = [
                { id: 'anim-1', data: 'animation-data-1' },
                { id: 'anim-2', data: 'animation-data-2' },
                { id: 'anim-3', data: '' }
            ];

            for (const { id, data } of testCases) {
                const blob = new Blob([data], { type: 'application/octet-stream' });
                await saveAnimationBlob(id, blob, { type: 'test' }, {});
                const retrieved = await getAnimationBlob(id);
                expect(retrieved).toBeDefined();
                expect(retrieved).toBeInstanceOf(Blob);
                expect(await readBlobAsText(retrieved)).toBe(data);
            }
        });
    });
});
