import { openDatabase, dbAdd, dbGet, dbGetAll, dbPut, dbDelete, initDB, closeDatabase } from '../js/db.js';

describe('DB Module', () => {
    const DB_NAME = 'QuickLogSoloDB';

    afterEach(() => {
        closeDatabase();
    });

    beforeEach(async () => {
        closeDatabase();
        const req = indexedDB.deleteDatabase(DB_NAME);
        await new Promise((resolve, reject) => {
            req.onsuccess = resolve;
            req.onerror = reject;
            req.onblocked = () => resolve();
        });
    });

    test('openDatabase creates stores', async () => {
        const db = await openDatabase();
        expect(db.objectStoreNames.contains('logs')).toBe(true);
        expect(db.objectStoreNames.contains('categories')).toBe(true);
        expect(db.objectStoreNames.contains('settings')).toBe(true);
    });

    test('dbAdd and dbGet work correctly', async () => {
        await openDatabase();
        const log = { category: 'Test', startTime: Date.now() };
        const id = await dbAdd('logs', log);
        expect(id).toBe(1);

        const savedLog = await dbGet('logs', id);
        expect(savedLog.category).toBe('Test');
    });

    test('dbGetAll returns all items', async () => {
        await openDatabase();
        await dbAdd('categories', { name: 'Cat 1', color: 'blue', order: 0 });
        await dbAdd('categories', { name: 'Cat 2', color: 'green', order: 1 });

        const cats = await dbGetAll('categories');
        expect(cats.length).toBe(2);
    });

    test('dbPut updates items', async () => {
        await openDatabase();
        await dbPut('settings', { key: 'theme', value: 'dark' });
        let theme = await dbGet('settings', 'theme');
        expect(theme.value).toBe('dark');

        await dbPut('settings', { key: 'theme', value: 'light' });
        theme = await dbGet('settings', 'theme');
        expect(theme.value).toBe('light');
    });

    test('dbDelete removes items', async () => {
        await openDatabase();
        await dbAdd('logs', { id: 1, category: 'Test' });
        await dbDelete('logs', 1);
        const log = await dbGet('logs', 1);
        expect(log).toBeUndefined();
    });

    test('initDB sets up initial data', async () => {
        const settings = await initDB();
        expect(settings).toBeDefined();

        const categories = await dbGetAll('categories');
        expect(categories.length).toBeGreaterThan(0);
        expect(categories.find(c => c.name === '💻 開発')).toBeDefined();
    });
});
