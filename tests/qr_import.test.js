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
import { deserializeSettingsPayload } from '../shared/js/qr_code.js';

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
    expect(categories).toEqual([expect.objectContaining({ id: 2, name: 'New category' })]);
    expect(alarms).toEqual([expect.objectContaining({ id: 2, name: 'New alarm' })]);
});

test('rejects malformed alarms before modifying settings or categories', async () => {
    expect(() => apply({ ...payload, a: [{ n: 'Missing ID' }] })).toThrow();
    expect(await snapshot()).toEqual(originals);
});

test('retains existing categories and alarms for empty arrays', async () => {
    await apply({ ...payload, c: [], a: [] });
    expect((await snapshot()).slice(1)).toEqual(originals.slice(1));
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
