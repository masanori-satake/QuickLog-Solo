/**
 * session_sync.test.js
 * Unit tests for session synchronization logic.
 */

import { setDatabaseName, dbAdd, STORE_LOGS, dbGetAll, dbClear } from '../shared/js/db.js';

// Mock chrome API
let mockSyncData = {};
global.chrome = {
    storage: {
        sync: {
            get: (keys, cb) => {
                if (keys === null) cb(mockSyncData);
                else {
                    const result = {};
                    if (Array.isArray(keys)) {
                        keys.forEach(k => result[k] = mockSyncData[k]);
                    } else if (typeof keys === 'string') {
                        result[keys] = mockSyncData[keys];
                    }
                    cb(result);
                }
            },
            set: (data, cb) => {
                Object.assign(mockSyncData, data);
                cb();
            }
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
        mockSyncData = {};
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

    test('pushToCloud should split logs into chunks', async () => {
        // Setup 50 logs
        const logs = [];
        for (let i = 0; i < 50; i++) {
            logs.push({ category: 'Task', startTime: 1000 + i, endTime: 1100 + i });
        }
        await import('../shared/js/db.js').then(async (db) => {
            await db.dbAddMultiple(db.STORE_LOGS, logs);
        });

        const state = {
            categories: [],
            alarms: [],
            theme: 'light',
            font: 'Roboto',
            animation: 'none',
            language: 'en',
            reportSettings: {},
            timerHeight: 'normal',
            businessDays: [1,2,3,4,5],
            activeTask: null
        };

        // Enable sync first
        await import('../shared/js/db.js').then(async (db) => {
            await db.dbPut(db.STORE_SETTINGS, { key: db.SETTING_KEY_SESSION_SYNC, value: true });
            await db.dbPut(db.STORE_SETTINGS, { key: db.SETTING_KEY_CLIENT_ID, value: 'client1' });
        });

        await sessionSync.pushToCloud(state);

        // Verify chunks exist in mock storage
        expect(mockSyncData['sync_logs_v2_0']).toBeDefined();
        expect(mockSyncData['sync_logs_v2_4']).toBeDefined();
        expect(mockSyncData['sync_logs_v2_0'].length).toBe(10);
    });
});
