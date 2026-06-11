/**
 * session_sync.test.js
 * Unit tests for session synchronization logic.
 */

import { setDatabaseName, dbAdd, STORE_LOGS, dbGetAll, dbClear } from '../shared/js/db.js';

// Mock chrome API
global.chrome = {
    storage: {
        sync: {
            get: (keys, cb) => cb({}),
            set: (data, cb) => cb()
        }
    },
    runtime: {
        lastError: null
    }
};

describe('Session Sync Logic', () => {
    let sessionSync;

    beforeAll(async () => {
        setDatabaseName('QuickLogSoloDB_Test_Sync');
        // Dynamic import to ensure it uses the test DB name set above
        sessionSync = await import('../shared/js/session_sync.js');
    });

    beforeEach(async () => {
        await dbClear(STORE_LOGS);
    });

    test('mergeLogs should add only new logs', async () => {
        // 1. Setup local logs
        const localLog = {
            category: 'Work',
            startTime: 1000,
            endTime: 2000,
            tags: 'tag1',
            color: 'primary'
        };
        await dbAdd(STORE_LOGS, localLog);

        // 2. Define remote logs (one existing, one new)
        const remoteLogs = [
            { category: 'Work', startTime: 1000, endTime: 2000, tags: 'tag1', color: 'primary' },
            { category: 'Research', startTime: 3000, endTime: 4000, tags: 'tag2', color: 'secondary' }
        ];

        // 3. Trigger merge
        await sessionSync.mergeLogs(remoteLogs);

        // 4. Verify results
        const finalLogs = await dbGetAll(STORE_LOGS);
        expect(finalLogs.length).toBe(2);

        const researchLog = finalLogs.find(l => l.category === 'Research');
        expect(researchLog).toBeDefined();
        expect(researchLog.startTime).toBe(3000);
    });

    test('mergeLogs should update existing logs with endTime', async () => {
        // 1. Setup local log without endTime
        const localLog = {
            category: 'Work',
            startTime: 1000,
            endTime: null,
            tags: 'tag1',
            color: 'primary'
        };
        await dbAdd(STORE_LOGS, localLog);

        // 2. Define remote log with endTime
        const remoteLogs = [
            { category: 'Work', startTime: 1000, endTime: 2000, tags: 'tag1', color: 'primary' }
        ];

        // 3. Trigger merge
        await sessionSync.mergeLogs(remoteLogs);

        // 4. Verify results
        const finalLogs = await dbGetAll(STORE_LOGS);
        expect(finalLogs.length).toBe(1);
        expect(finalLogs[0].endTime).toBe(2000);
    });
});
