import { openDatabase, dbAdd, dbGet, dbGetAll, dbPut, dbDelete, initDB, closeDatabase } from '../js/db.js';
import { SYSTEM_CATEGORY_IDLE } from '../js/utils.js';

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

    test('initDB handles multiple active tasks by closing orphaned ones', async () => {
        await openDatabase();
        const now = Date.now();
        // Create two tasks without endTime
        await dbAdd('logs', { category: 'Old Task', startTime: now - 10000, endTime: null });
        await dbAdd('logs', { category: 'New Task', startTime: now - 5000, endTime: null });
        closeDatabase();

        const settings = await initDB();
        expect(settings.activeTask.category).toBe('New Task');

        const allLogs = await dbGetAll('logs');
        const openTasks = allLogs.filter(l => !l.endTime);
        expect(openTasks.length).toBe(1);
        expect(openTasks[0].category).toBe('New Task');

        const closedTask = allLogs.find(l => l.category === 'Old Task');
        expect(closedTask.endTime).toBeDefined();
        expect(closedTask.endTime).toBe(closedTask.startTime + 1000);
    });

    test('initDB handles pauseState correctly', async () => {
        await openDatabase();
        const pauseState = { category: SYSTEM_CATEGORY_IDLE, startTime: Date.now(), isPaused: true };
        await dbPut('settings', { key: 'pauseState', value: pauseState });
        closeDatabase();

        const settings = await initDB();
        expect(settings.activeTask.isPaused).toBe(true);
        expect(settings.activeTask.category).toBe(SYSTEM_CATEGORY_IDLE);
    });

    test('initDB migrates open (待機) log to pauseState', async () => {
        await openDatabase();
        const startTime = Date.now();
        await dbAdd('logs', { category: SYSTEM_CATEGORY_IDLE, startTime: startTime, endTime: null });
        closeDatabase();

        const settings = await initDB();
        expect(settings.activeTask.isPaused).toBe(true);
        expect(settings.activeTask.startTime).toBe(startTime);

        const allLogs = await dbGetAll('logs');
        const openLogs = allLogs.filter(l => !l.endTime);
        expect(openLogs.length).toBe(0);

        const savedPauseState = await dbGet('settings', 'pauseState');
        expect(savedPauseState).toBeDefined();
        expect(savedPauseState.value.startTime).toBe(startTime);
    });
});
