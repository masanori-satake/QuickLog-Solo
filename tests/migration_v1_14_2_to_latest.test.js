import {
    initDB, dbGetAll, closeDatabase, setDatabaseName,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS,
    openDatabase
} from '../shared/js/db.js';
import { SYSTEM_CATEGORY_IDLE } from '../shared/js/utils.js';

describe('Migration Verification: Legacy v1.14.2 to Latest', () => {
    const TEST_DB_NAME = 'Migrationv1_14_2TestDB';

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

    async function setupV1142State() {
        // Create the database with legacy version 1 schema to exercise the upgrade path
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(TEST_DB_NAME, 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_LOGS)) {
                    db.createObjectStore(STORE_LOGS, { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
                    const catStore = db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id', autoIncrement: true });
                    catStore.createIndex('name', 'name', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                    db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains(STORE_ALARMS)) {
                    db.createObjectStore(STORE_ALARMS, { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const tx = db.transaction([STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS], 'readwrite');

        const catStore = tx.objectStore(STORE_CATEGORIES);
        // v1.14.2 categories might have name, color, tags, but no order
        catStore.add({ name: 'Work', color: 'primary', tags: 'tag1,tag2' });
        catStore.add({ name: 'Meeting', color: 'secondary', tags: 'tag3' });

        const now = Date.now();
        const logStore = tx.objectStore(STORE_LOGS);
        // logs with no syncId, no updatedAt, no color, no tags
        logStore.add({ category: 'Work', startTime: now - 5000, endTime: now - 3000 });
        logStore.add({ category: SYSTEM_CATEGORY_IDLE, startTime: now - 3000, endTime: now - 2000, isManualStop: true });
        logStore.add({ category: 'Meeting', startTime: now - 2000, endTime: null });

        const alarmStore = tx.objectStore(STORE_ALARMS);
        // legacy alarm without advanced schedule fields (type, daysOfWeek, etc.)
        alarmStore.add({
            id: 1,
            enabled: true,
            time: "10:30",
            message: "Drink water",
            action: "none"
        });

        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });

        // Close the legacy DB so initDB() can open at the new version and exercise upgrade
        db.close();
    }

    test('successfully migrates legacy v1.14.2 data to latest format', async () => {
        await setupV1142State();

        // Initialize DB which executes all migrations (missing syncId, missing updatedAt, missing tags/colors, missing alarm scheduling fields)
        const state = await initDB();

        // 1. Verify categories (order field populated if missing)
        const categories = await dbGetAll(STORE_CATEGORIES);
        expect(categories.length).toBeGreaterThanOrEqual(2);
        const workCat = categories.find(c => c.name === 'Work');
        expect(workCat).toBeDefined();
        expect(workCat.order).toBeDefined();
        expect(typeof workCat.order).toBe('number');

        // 2. Verify logs (migrated with syncId, updatedAt, matching tags, and colors)
        const logs = await dbGetAll(STORE_LOGS);
        expect(logs.length).toBe(3);

        const workLog = logs.find(l => l.category === 'Work');
        expect(workLog).toBeDefined();
        expect(workLog.syncId).toBeDefined();
        expect(typeof workLog.syncId).toBe('string');
        expect(workLog.updatedAt).toBe(workLog.endTime); // should fallback to endTime
        expect(workLog.color).toBe('primary');
        expect(workLog.tags).toBe('tag1,tag2');

        const activeLog = logs.find(l => !l.endTime);
        expect(activeLog).toBeDefined();
        expect(activeLog.category).toBe('Meeting');
        expect(activeLog.syncId).toBeDefined();
        expect(activeLog.updatedAt).toBe(activeLog.startTime); // should fallback to startTime
        expect(activeLog.color).toBe('secondary');
        expect(activeLog.tags).toBe('tag3');

        // 3. Verify alarms (migrated with default schedule fields)
        const alarms = await dbGetAll(STORE_ALARMS);
        const alarm = alarms.find(a => a.id === 1);
        expect(alarm).toBeDefined();
        expect(alarm.type).toBe('daily_business');
        expect(alarm.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
        expect(alarm.dayOfMonth).toBe(1);
        expect(alarm.daysBeforeEnd).toBe(0);
        expect(alarm.holidayAdjustment).toBe('none');

        // 4. Verify state fields
        expect(state.activeTask).toBeDefined();
        expect(state.activeTask.category).toBe('Meeting');
    });
});
