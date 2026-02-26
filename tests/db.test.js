import {
    openDatabase, dbAdd, dbGet, dbGetAll, dbPut, dbDelete, initDB, closeDatabase,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, SETTING_KEY_THEME, SETTING_KEY_PAUSE_STATE
} from '../js/db.js';
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
        expect(db.objectStoreNames.contains(STORE_LOGS)).toBe(true);
        expect(db.objectStoreNames.contains(STORE_CATEGORIES)).toBe(true);
        expect(db.objectStoreNames.contains(STORE_SETTINGS)).toBe(true);
    });

    test('dbAdd and dbGet work correctly', async () => {
        await openDatabase();
        const log = { category: 'Test', startTime: Date.now() };
        const id = await dbAdd(STORE_LOGS, log);
        expect(id).toBe(1);

        const savedLog = await dbGet(STORE_LOGS, id);
        expect(savedLog.category).toBe('Test');
    });

    test('dbGetAll returns all items', async () => {
        await openDatabase();
        await dbAdd(STORE_CATEGORIES, { name: 'Cat 1', color: 'blue', order: 0 });
        await dbAdd(STORE_CATEGORIES, { name: 'Cat 2', color: 'green', order: 1 });

        const cats = await dbGetAll(STORE_CATEGORIES);
        expect(cats.length).toBe(2);
    });

    test('dbPut updates items', async () => {
        await openDatabase();
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_THEME, value: 'dark' });
        let theme = await dbGet(STORE_SETTINGS, SETTING_KEY_THEME);
        expect(theme.value).toBe('dark');

        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_THEME, value: 'light' });
        theme = await dbGet(STORE_SETTINGS, SETTING_KEY_THEME);
        expect(theme.value).toBe('light');
    });

    test('dbDelete removes items', async () => {
        await openDatabase();
        await dbAdd(STORE_LOGS, { id: 1, category: 'Test' });
        await dbDelete(STORE_LOGS, 1);
        const log = await dbGet(STORE_LOGS, 1);
        expect(log).toBeUndefined();
    });

    test('initDB sets up initial data', async () => {
        const settings = await initDB();
        expect(settings).toBeDefined();

        const categories = await dbGetAll(STORE_CATEGORIES);
        expect(categories.length).toBeGreaterThan(0);
        expect(categories.find(c => c.name === '開発')).toBeDefined();
    });

    test('initDB handles multiple active tasks by closing orphaned ones', async () => {
        await openDatabase();
        const now = Date.now();
        // Create two tasks without endTime
        await dbAdd(STORE_LOGS, { category: 'Old Task', startTime: now - 10000, endTime: null });
        await dbAdd(STORE_LOGS, { category: 'New Task', startTime: now - 5000, endTime: null });
        closeDatabase();

        const settings = await initDB();
        expect(settings.activeTask.category).toBe('New Task');

        const allLogs = await dbGetAll(STORE_LOGS);
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
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: pauseState });
        closeDatabase();

        const settings = await initDB();
        expect(settings.activeTask.isPaused).toBe(true);
        expect(settings.activeTask.category).toBe(SYSTEM_CATEGORY_IDLE);
    });

    test('initDB migrates open (待機) log to pauseState', async () => {
        await openDatabase();
        const startTime = Date.now();
        await dbAdd(STORE_LOGS, { category: SYSTEM_CATEGORY_IDLE, startTime: startTime, endTime: null });
        closeDatabase();

        const settings = await initDB();
        expect(settings.activeTask.isPaused).toBe(true);
        expect(settings.activeTask.startTime).toBe(startTime);

        const allLogs = await dbGetAll(STORE_LOGS);
        const openLogs = allLogs.filter(l => !l.endTime);
        expect(openLogs.length).toBe(1);
        expect(openLogs[0].category).toBe(SYSTEM_CATEGORY_IDLE);

        const savedPauseState = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
        expect(savedPauseState).toBeDefined();
        expect(savedPauseState.value.startTime).toBe(startTime);
    });
});
