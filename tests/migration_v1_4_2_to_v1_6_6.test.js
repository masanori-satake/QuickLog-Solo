import {
    initDB, dbGetAll, dbAdd, dbPut, dbDelete, closeDatabase, setDatabaseName, DB_NAME,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS,
    SETTING_KEY_PAUSE_STATE, SETTING_KEY_LANGUAGE, openDatabase
} from '../shared/js/db.js';
import { SYSTEM_CATEGORY_IDLE } from '../shared/js/utils.js';

describe('Migration Verification: v1.4.2 to v1.6.6', () => {
    const TEST_DB_NAME = 'MigrationTestDB';

    beforeEach(async () => {
        closeDatabase();
        setDatabaseName(TEST_DB_NAME);
        await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(TEST_DB_NAME);
            req.onsuccess = resolve;
            req.onerror = reject;
        });
    });

    afterAll(() => {
        closeDatabase();
    });

    async function setupV142State(dbName = TEST_DB_NAME) {
        const db = await openDatabase();
        const tx = db.transaction([STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS], 'readwrite');

        const catStore = tx.objectStore(STORE_CATEGORIES);
        catStore.add({ name: 'Work', color: 'primary', tags: 'tag1,tag2', order: 0 });

        const now = Date.now();
        const logStore = tx.objectStore(STORE_LOGS);
        logStore.add({ category: 'Work', startTime: now - 3000, endTime: now - 2000 });
        logStore.add({ category: SYSTEM_CATEGORY_IDLE, startTime: now - 2000, endTime: now - 2000, isManualStop: true });
        logStore.add({ category: 'Work', startTime: now - 1000, endTime: null });

        const settingStore = tx.objectStore(STORE_SETTINGS);
        settingStore.add({ key: SETTING_KEY_LANGUAGE, value: 'en' });

        const alarmStore = tx.objectStore(STORE_ALARMS);
        alarmStore.add({
            enabled: true,
            time: "09:00",
            message: "Morning Alarm",
            action: "none"
        });

        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
        closeDatabase();
    }

    test('successfully migrates data from v1.4.2 to v1.6.6', async () => {
        await setupV142State();

        // Run current initDB() which should perform migrations
        await initDB();

        // Verify Logs
        const logs = await dbGetAll(STORE_LOGS);
        expect(logs.length).toBe(3);

        for (const log of logs) {
            expect(log.syncId).toBeDefined();
            expect(log.updatedAt).toBeDefined();

            if (log.category === 'Work') {
                expect(log.color).toBe('primary');
                expect(log.tags).toBe('tag1,tag2');
            }
        }

        const alarms = await dbGetAll(STORE_ALARMS);
        const morningAlarm = alarms.find(a => a.message === "Morning Alarm");
        expect(morningAlarm).toBeDefined();
        expect(morningAlarm.type).toBe('daily_business');

        const state = await initDB();
        const pauseStateSetting = state.activeTask;
        expect(pauseStateSetting).toBeDefined();
        expect(pauseStateSetting.category).toBe('Work');
        expect(pauseStateSetting.endTime).toBeNull();
    });

    test('migrates multiple active tasks correctly', async () => {
        const dbName = TEST_DB_NAME + '_2';
        closeDatabase();
        setDatabaseName(dbName);
        await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = resolve;
            req.onerror = reject;
        });

        const db = await openDatabase();
        const tx = db.transaction([STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS], 'readwrite');
        const store = tx.objectStore(STORE_LOGS);
        const now = Date.now();
        store.add({ category: 'Task 1', startTime: now - 2000, endTime: null });
        store.add({ category: 'Task 2', startTime: now - 1000, endTime: null });
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
        closeDatabase();

        await initDB();

        const logs = await dbGetAll(STORE_LOGS);
        const openTasks = logs.filter(l => !l.endTime);
        expect(openTasks.length).toBe(1);
        expect(openTasks[0].category).toBe('Task 2');

        const closedTask = logs.find(l => l.category === 'Task 1');
        expect(closedTask.endTime).toBe(closedTask.startTime + 1000);
    });
});
