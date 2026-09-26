import { jest } from '@jest/globals';
import {
    closeDatabase,
    setDatabaseName,
    dbPut,
    dbGetAll,
    dbImportQRSettings,
    STORE_SETTINGS,
    STORE_CATEGORIES,
    STORE_ALARMS,
} from '../shared/js/db.js';
import { serializeSettingsPayload, deserializeSettingsPayload } from '../shared/js/qr_code.js';

const stores = [STORE_SETTINGS, STORE_CATEGORIES, STORE_ALARMS];
const originals = [
    [{ key: 'theme', value: 'dark' }],
    [{ id: 1, name: 'Original category' }],
    [{ id: 1, name: 'Original alarm' }],
];
const payload = { v: 1, s: { t: 'light' }, c: [{ i: 2, n: 'New category' }], a: [{ i: 2, n: 'New alarm' }] };
const snapshot = () => Promise.all(stores.map((store) => dbGetAll(store)));
const apply = (data) => dbImportQRSettings(deserializeSettingsPayload(JSON.stringify(data)));

beforeEach(async () => {
    closeDatabase();
    setDatabaseName(`QRImport_${Math.random()}`);
    for (let i = 0; i < stores.length; i++) await dbPut(stores[i], originals[i][0]);
});
afterEach(() => {
    jest.restoreAllMocks();
    closeDatabase();
});

test('replaces categories and alarms and merges settings after the transaction commits', async () => {
    await dbPut(STORE_SETTINGS, { key: 'unrelated', value: true });
    await apply(payload);
    const [settings, categories, alarms] = await snapshot();
    expect(settings).toEqual([
        { key: 'theme', value: 'light' },
        { key: 'unrelated', value: true },
    ]);
    expect(categories).toEqual([
        expect.objectContaining({ id: 2, name: 'New category' }),
    ]);
    expect(alarms).toEqual([
        expect.objectContaining({ id: 2, name: 'New alarm' }),
    ]);
});

test('rejects malformed alarms before modifying settings or categories', async () => {
    expect(() => apply({ ...payload, a: [{ n: 'Missing ID' }] })).toThrow();
    expect(await snapshot()).toEqual(originals);
});

test.each([
    [{}],
    [{ categories: [] }],
    [{ alarms: [] }],
    [{ categories: [], alarms: [] }],
    [{ categories: [{ id: 2, name: 'IDLE' }, { id: 3, name: '__PAGE_BREAK__1' }] }],
])('preserves existing stores during QR payload imports without clearing: %j', async (groups) => {
    const serialized = serializeSettingsPayload({ settings: { theme: 'light' }, ...groups });
    const restored = deserializeSettingsPayload(serialized);
    await dbImportQRSettings(restored);
    const [settings, categories, alarms] = await snapshot();
    expect(settings).toEqual([{ key: 'theme', value: 'light' }]);
    expect(categories).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
    expect(alarms).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
});

test('rolls back an explicit empty group when a later write fails', async () => {
    jest.spyOn(globalThis.IDBObjectStore.prototype, 'put').mockImplementation(function () {
        throw new DOMException('Write failed', 'DataCloneError');
    });
    await expect(apply({ v: 1, c: [], a: payload.a })).rejects.toThrow();
    expect(await snapshot()).toEqual(originals);
});

test('supports split QR imports in any order without overwriting unrelated stores', async () => {
    const group1Payload = { v: 1, s: { t: 'dark' }, a: [{ i: 10, n: 'Imported Alarm' }] };
    const group2Payload = { v: 1, c: [{ i: 20, n: 'Imported Category' }] };

    // Order 1: Group 1 then Group 2
    await apply(group1Payload);
    let [settings, categories, alarms] = await snapshot();
    expect(settings).toEqual([{ key: 'theme', value: 'dark' }]);
    expect(alarms).toEqual(expect.arrayContaining([expect.objectContaining({ id: 10, name: 'Imported Alarm' })]));
    expect(categories).toEqual(originals[1]); // Original category preserved

    await apply(group2Payload);
    [settings, categories, alarms] = await snapshot();
    expect(settings).toEqual([{ key: 'theme', value: 'dark' }]); // Preserved from Group 1
    expect(alarms).toEqual(expect.arrayContaining([expect.objectContaining({ id: 10, name: 'Imported Alarm' })])); // Preserved from Group 1
    expect(categories).toEqual(expect.arrayContaining([expect.objectContaining({ id: 20, name: 'Imported Category' })]));

    // Reset DB and test Order 2: Group 2 then Group 1
    closeDatabase();
    setDatabaseName(`QRImport_Reverse_${Math.random()}`);
    for (let i = 0; i < stores.length; i++) await dbPut(stores[i], originals[i][0]);

    await apply(group2Payload);
    [settings, categories, alarms] = await snapshot();
    expect(categories).toEqual(expect.arrayContaining([expect.objectContaining({ id: 20, name: 'Imported Category' })]));
    expect(settings).toEqual(originals[0]); // Original settings preserved
    expect(alarms).toEqual(originals[2]); // Original alarms preserved

    await apply(group1Payload);
    [settings, categories, alarms] = await snapshot();
    expect(settings).toEqual([{ key: 'theme', value: 'dark' }]);
    expect(alarms).toEqual(expect.arrayContaining([expect.objectContaining({ id: 10, name: 'Imported Alarm' })]));
    expect(categories).toEqual(expect.arrayContaining([expect.objectContaining({ id: 20, name: 'Imported Category' })])); // Preserved from Group 2
});

test.each(['synchronous', 'request'])('rolls back every store after a %s write failure', async (failure) => {
    const originalPut = globalThis.IDBObjectStore.prototype.put;
    jest.spyOn(globalThis.IDBObjectStore.prototype, 'put').mockImplementation(function (record) {
        if (this.name === STORE_ALARMS) {
            if (failure === 'synchronous') throw new DOMException('Write failed', 'DataCloneError');
            // Queue a duplicate add so the transaction aborts asynchronously with ConstraintError.
            this.add(record);
            return this.add(record);
        }
        return originalPut.call(this, record);
    });
    await expect(apply(payload)).rejects.toThrow();
    expect(await snapshot()).toEqual(originals);
});

test('cancels while awaiting the database without queuing any writes', async () => {
    closeDatabase();
    const controller = new AbortController();
    const put = jest.spyOn(globalThis.IDBObjectStore.prototype, 'put');
    const pending = dbImportQRSettings(deserializeSettingsPayload(JSON.stringify(payload)), {
        signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(put).not.toHaveBeenCalled();
    expect(await snapshot()).toEqual(originals);
});

test('cancellation after a write succeeds rolls back all stores before commit', async () => {
    const controller = new AbortController();
    const originalPut = globalThis.IDBObjectStore.prototype.put;
    jest.spyOn(globalThis.IDBObjectStore.prototype, 'put').mockImplementation(function (record) {
        const request = originalPut.call(this, record);
        if (this.name === STORE_ALARMS) {
            request.addEventListener('success', () => controller.abort());
        }
        return request;
    });
    await expect(
        dbImportQRSettings(deserializeSettingsPayload(JSON.stringify(payload)), { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(await snapshot()).toEqual(originals);
});
