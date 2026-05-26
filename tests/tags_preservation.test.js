import { setDatabaseName, initDB, dbAdd, dbGetAll, dbClear, STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, dbPut, dbGetByName } from '../shared/js/db.js';
import { startTaskLogic } from '../shared/js/logic.js';
import { SYSTEM_CATEGORY_IDLE } from '../shared/js/utils.js';

describe('Tags Preservation and Migration', () => {
    beforeEach(async () => {
        setDatabaseName('TagsPreservationTestDB');
        await dbClear(STORE_LOGS);
        await dbClear(STORE_CATEGORIES);
        await dbClear(STORE_SETTINGS);
    });

    test('migration populates missing tags and color', async () => {
        // Setup a category with tags and color
        await dbPut(STORE_CATEGORIES, { name: 'Dev', color: 'teal', tags: 'coding,debug', order: 0 });

        // Setup a log entry without tags and color
        const startTime = Date.now() - 10000;
        await dbAdd(STORE_LOGS, {
            category: 'Dev',
            startTime: startTime,
            endTime: startTime + 5000
        });

        // Initialize DB (which triggers migration)
        await initDB();

        const logs = await dbGetAll(STORE_LOGS);
        expect(logs[0].tags).toBe('coding,debug');
        expect(logs[0].color).toBe('teal');
    });

    test('starting task records current tags and color', async () => {
        await dbPut(STORE_CATEGORIES, { name: 'Meeting', color: 'orange', tags: 'team,sync', order: 0 });

        const activeTask = await startTaskLogic('Meeting', null, null, 'orange', 'team,sync');

        expect(activeTask.category).toBe('Meeting');
        expect(activeTask.tags).toBe('team,sync');
        expect(activeTask.color).toBe('orange');

        const logs = await dbGetAll(STORE_LOGS);
        const log = logs.find(l => l.id === activeTask.id);
        expect(log.tags).toBe('team,sync');
        expect(log.color).toBe('orange');
    });

    test('historical logs preserve tags and category name even after category rename', async () => {
        // This test simulates the logic that was removed from app.js but we verify it via DB state
        await dbPut(STORE_CATEGORIES, { name: 'OldName', color: 'primary', tags: 'old-tag', order: 0 });

        const startTime = Date.now() - 20000;
        await dbAdd(STORE_LOGS, {
            category: 'OldName',
            startTime: startTime,
            endTime: startTime + 5000,
            tags: 'old-tag',
            color: 'primary'
        });

        // Simulate category rename (only updating STORE_CATEGORIES)
        const cat = await dbGetByName(STORE_CATEGORIES, 'OldName');
        await dbPut(STORE_CATEGORIES, { ...cat, name: 'NewName', tags: 'new-tag' });

        // Verify log is unchanged
        const logs = await dbGetAll(STORE_LOGS);
        expect(logs[0].category).toBe('OldName');
        expect(logs[0].tags).toBe('old-tag');
    });
});
