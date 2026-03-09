import {
    openDatabase, dbAdd, dbGet, dbGetAll, dbCount, dbPut, dbDelete, initDB, closeDatabase, dbImportCategories,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, SETTING_KEY_THEME, SETTING_KEY_PAUSE_STATE, SETTING_KEY_AUTO_STOP
} from '../src/js/db.js';
import { SYSTEM_CATEGORY_IDLE } from '../src/js/utils.js';

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

    test('dbCount returns correct count', async () => {
        await openDatabase();
        await dbAdd(STORE_LOGS, { category: 'Test 1', startTime: 100 });
        await dbAdd(STORE_LOGS, { category: 'Test 2', startTime: 200 });
        const count = await dbCount(STORE_LOGS);
        expect(count).toBe(2);
    });

    test('initDB sets up initial data', async () => {
        const settings = await initDB();
        expect(settings).toBeDefined();

        const categories = await dbGetAll(STORE_CATEGORIES);
        expect(categories.length).toBeGreaterThan(0);
        // Expect either Japanese or English name depending on environment
        const nameJA = '💻 開発・プログラミング';
        const nameEN = '💻 Development/Coding';
        expect(categories.find(c => c.name === nameJA || c.name === nameEN)).toBeDefined();
    });

    test('initDB handles multiple active tasks by closing orphaned ones', async () => {
        await openDatabase();
        // Disable auto-stop to prevent tasks from being closed if test runs around midnight
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_AUTO_STOP, value: false });

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
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_AUTO_STOP, value: false });
        const pauseState = { category: SYSTEM_CATEGORY_IDLE, startTime: Date.now(), isPaused: true };
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: pauseState });
        closeDatabase();

        const settings = await initDB();
        expect(settings.activeTask.isPaused).toBe(true);
        expect(settings.activeTask.category).toBe(SYSTEM_CATEGORY_IDLE);
    });

    test('initDB migrates open idle log to pauseState', async () => {
        await openDatabase();
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_AUTO_STOP, value: false });
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

    test('initDB performs auto-stop repair and adds stop marker', async () => {
        await openDatabase();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(10, 0, 0, 0);
        const startTime = yesterday.getTime();

        // Create an open task from yesterday
        await dbAdd(STORE_LOGS, { category: 'Yesterday Task', startTime: startTime, endTime: null });
        closeDatabase();

        // initDB should trigger repair
        await initDB();

        const allLogs = await dbGetAll(STORE_LOGS);
        const yesterdayTask = allLogs.find(l => l.category === 'Yesterday Task');
        expect(yesterdayTask.endTime).toBeDefined();

        const stopTime = new Date(startTime).setHours(23, 59, 59, 999);
        expect(yesterdayTask.endTime).toBe(stopTime);

        // Check for stop marker
        const stopMarker = allLogs.find(l => l.isManualStop && l.startTime === stopTime);
        expect(stopMarker).toBeDefined();
        expect(stopMarker.category).toBe(SYSTEM_CATEGORY_IDLE);
    });

    describe('dbImportCategories', () => {
        test('imports categories in append mode', async () => {
            await openDatabase();
            await dbAdd(STORE_CATEGORIES, { name: 'Existing', color: 'primary', order: 0 });

            const items = [
                { name: 'Existing', color: 'secondary' }, // Should be skipped
                { name: 'New', color: 'teal' },
                { type: 'page-break' }
            ];

            await dbImportCategories(items, 'append');
            const result = await dbGetAll(STORE_CATEGORIES);

            expect(result.length).toBe(3);
            expect(result.find(c => c.name === 'Existing').color).toBe('primary');
            expect(result.find(c => c.name === 'New').color).toBe('teal');
            expect(result.some(c => c.name.startsWith('__PAGE_BREAK__'))).toBe(true);
            // Verify order
            expect(result.find(c => c.name === 'New').order).toBeGreaterThan(0);
        });

        test('dbImportCategories handles invalid colors by falling back to primary', async () => {
            await openDatabase();
            const items = [
                { name: 'Invalid Color', color: 'super-red' }
            ];
            await dbImportCategories(items, 'append');
            const result = await dbGetAll(STORE_CATEGORIES);
            expect(result.find(c => c.name === 'Invalid Color').color).toBe('primary');
        });

        test('imports categories in overwrite mode', async () => {
            await openDatabase();
            await dbAdd(STORE_CATEGORIES, { name: 'Old', color: 'primary', order: 0 });

            const items = [
                { name: 'New', color: 'green' }
            ];

            await dbImportCategories(items, 'overwrite');
            const result = await dbGetAll(STORE_CATEGORIES);

            expect(result.length).toBe(1);
            expect(result[0].name).toBe('New');
            expect(result[0].order).toBe(0);
        });
    });

});
