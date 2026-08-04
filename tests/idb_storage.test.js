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
import { fc, test as fcTest } from '@fast-check/jest';

/**
 * @jest-environment jsdom
 */

function readBlobAsText(blob) {
    if (!blob) return '';
    const symbols = Object.getOwnPropertySymbols(blob);
    const implSymbol = symbols.find(s => s.toString() === 'Symbol(impl)');
    if (implSymbol) {
        const impl = blob[implSymbol];
        if (impl && impl._buffer) {
            return impl._buffer.toString('utf-8');
        }
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(blob)) {
        return blob.toString('utf-8');
    }
    return '';
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

    test('getAnimationBlob returns null if ID is not found', async () => {
        const blob = await getAnimationBlob('non-existent-id');
        expect(blob).toBeNull();
    });

    test('getAnimationDraftBlob returns null if ID is not found', async () => {
        const blob = await getAnimationDraftBlob('non-existent-id');
        expect(blob).toBeNull();
    });

    test('getAnimationDraftRecord returns null if ID is not found', async () => {
        const record = await getAnimationDraftRecord('non-existent-id');
        expect(record).toBeNull();
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

        const text = readBlobAsText(fetchedBlob);
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
        expect(readBlobAsText(fetchedBlob)).toBe('draft-data');

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
    // Property-Based Tests (fast-check)
    // =============================================================================

    describe('Property 16: Blob ストレージのラウンドトリップ', () => {
        fcTest.prop([
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ maxLength: 50 })
        ], { numRuns: 10 })('save and retrieve custom animation blob successfully', async (id, data) => {
            const blob = new Blob([data], { type: 'application/octet-stream' });
            await saveAnimationBlob(id, blob, { type: 'test' }, {});
            const retrieved = await getAnimationBlob(id);
            expect(retrieved).toBeDefined();
            expect(retrieved).toBeInstanceOf(Blob);
            expect(readBlobAsText(retrieved)).toBe(data);
        });
    });
});
