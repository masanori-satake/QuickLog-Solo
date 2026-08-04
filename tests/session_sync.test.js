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
        // result will have Unknown gap between 2000 and 3000
        expect(finalLogs.length).toBe(3);

        const researchLog = finalLogs.find(l => l.category === 'Research');
        expect(researchLog).toBeDefined();
        expect(researchLog.startTime).toBe(3000);
    });

    test('mergeLogs should prefer newer updatedAt', async () => {
        const syncId = 'test-sync-id';
        // 1. Setup local log (Old)
        await dbAdd(STORE_LOGS, {
            syncId,
            category: 'Category A',
            startTime: 1000,
            endTime: 2000,
            updatedAt: 100
        });

        // 2. Define remote log (Newer)
        const remoteLogs = [
            { syncId, category: 'Category B', startTime: 1000, endTime: 2000, updatedAt: 200 }
        ];

        await sessionSync.mergeLogs(remoteLogs);

        const finalLogs = await dbGetAll(STORE_LOGS);
        const log = finalLogs.find(l => l.syncId === syncId);
        expect(log.category).toBe('Category B');
    });

    test('mergeLogs should NOT overwrite with older updatedAt', async () => {
        const syncId = 'test-sync-id';
        // 1. Setup local log (Newer)
        await dbAdd(STORE_LOGS, {
            syncId,
            category: 'Category B',
            startTime: 1000,
            endTime: 2000,
            updatedAt: 200
        });

        // 2. Define remote log (Old)
        const remoteLogs = [
            { syncId, category: 'Category A', startTime: 1000, endTime: 2000, updatedAt: 100 }
        ];

        await sessionSync.mergeLogs(remoteLogs);

        const finalLogs = await dbGetAll(STORE_LOGS);
        const log = finalLogs.find(l => l.syncId === syncId);
        expect(log.category).toBe('Category B');
    });

    test('mergeLogs should sanitize remote IDs', async () => {
        // Local has ID 1
        await dbAdd(STORE_LOGS, { category: 'Local', startTime: 1000, endTime: 2000, syncId: 'sid1' });

        // Remote also has ID 1 but different syncId
        const remoteLogs = [
            { id: 1, category: 'Remote', startTime: 3000, endTime: 4000, syncId: 'sid2' }
        ];

        await sessionSync.mergeLogs(remoteLogs);

        const logs = await dbGetAll(STORE_LOGS);
        const local = logs.find(l => l.syncId === 'sid1');
        const remote = logs.find(l => l.syncId === 'sid2');
        expect(local.id).not.toBe(remote.id);
        expect(remote.id).toBeDefined();
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

    test('syncActiveTask should handle running vs paused tasks', async () => {
        const { SYSTEM_CATEGORY_IDLE } = await import('../shared/js/utils.js');
        const db = await import('../shared/js/db.js');

        // Case 1: Running task
        const runningTask = { category: 'Work', startTime: 5000, endTime: null };
        await db.dbAdd(db.STORE_LOGS, runningTask);

        await sessionSync.syncActiveTask(runningTask);
        let pauseState = (await db.dbGet(db.STORE_SETTINGS, db.SETTING_KEY_PAUSE_STATE)).value;
        expect(pauseState.category).toBe('Work');
        expect(pauseState.isPaused).toBe(false);

        // Case 2: Paused task
        const pausedTask = { category: SYSTEM_CATEGORY_IDLE, startTime: 6000, endTime: null, resumableCategory: 'Work' };
        await db.dbAdd(db.STORE_LOGS, pausedTask);

        await sessionSync.syncActiveTask(pausedTask);
        pauseState = (await db.dbGet(db.STORE_SETTINGS, db.SETTING_KEY_PAUSE_STATE)).value;
        expect(pauseState.category).toBe(SYSTEM_CATEGORY_IDLE);
        expect(pauseState.isPaused).toBe(true);
    });

    describe('Requirement 7 Edge Cases', () => {
        test('extractLogsFromData with empty, null or valid chunks', () => {
            const extract = sessionSync.extractLogsFromData;

            // Empty data
            expect(extract({})).toEqual([]);

            // Null chunk
            expect(extract({ 'sync_logs_v2_0': null, 'sync_logs_v2_1': undefined })).toEqual([]);

            // Valid chunks
            const data = {
                'sync_logs_v2_0': [{ id: 1, category: 'A' }],
                'sync_logs_v2_1': [{ id: 2, category: 'B' }]
            };
            expect(extract(data)).toEqual([
                { id: 1, category: 'A' },
                { id: 2, category: 'B' }
            ]);
        });

        test('reconstructTimeline with empty, duplicates, and gaps', () => {
            const reconstruct = sessionSync.reconstructTimeline;

            // Empty array
            expect(reconstruct([])).toEqual([]);

            // Duplicate logs with same syncId - prefers newer updatedAt
            const dupLogs = [
                { syncId: 's1', startTime: 1000, endTime: 2000, category: 'A', updatedAt: 100 },
                { syncId: 's1', startTime: 1000, endTime: 2000, category: 'B', updatedAt: 200 }
            ];
            const resultDup = reconstruct(dupLogs);
            expect(resultDup.length).toBe(1);
            expect(resultDup[0].category).toBe('B');

            // Gaps filled with Unknown
            const gapLogs = [
                { startTime: 1000, endTime: 2000, category: 'A' },
                { startTime: 3000, endTime: 4000, category: 'B' }
            ];
            const resultGap = reconstruct(gapLogs, true); // fillGaps=true
            expect(resultGap.length).toBe(3); // A, Unknown, B
            expect(resultGap[1].category).toBe('__UNKNOWN__');
            expect(resultGap[1].startTime).toBe(2000);
            expect(resultGap[1].endTime).toBe(3000);
        });

        test('mergeLogs with empty remote logs, overwrite, and remoteDeletedIds', async () => {
            // Setup some local logs
            await dbAdd(STORE_LOGS, { id: 1, category: 'LocalA', startTime: 1000, endTime: 2000, syncId: 'l1' });
            await dbAdd(STORE_LOGS, { id: 2, category: 'LocalB', startTime: 2000, endTime: 3000, syncId: 'l2' });

            // 1. Empty remote logs - merge doesn't delete if overwrite is false
            await sessionSync.mergeLogs([], false);
            let logs = await dbGetAll(STORE_LOGS);
            expect(logs.length).toBeGreaterThanOrEqual(2);

            // 2. Overwrite = true
            const remoteLogs = [
                { category: 'Remote', startTime: 4000, endTime: 5000, syncId: 'r1' }
            ];
            await sessionSync.mergeLogs(remoteLogs, true);
            logs = await dbGetAll(STORE_LOGS);
            expect(logs.some(l => l.category === 'Remote')).toBe(true);
            expect(logs.some(l => l.category === 'LocalA')).toBe(false);

            // 3. remoteDeletedIds
            // Reset local logs
            await dbClear(STORE_LOGS);
            await dbAdd(STORE_LOGS, { id: 3, category: 'KeepMe', startTime: 1000, endTime: 2000, syncId: 'keep1' });
            await dbAdd(STORE_LOGS, { id: 4, category: 'DeleteMe', startTime: 2000, endTime: 3000, syncId: 'delete1' });

            await sessionSync.mergeLogs([], false, ['delete1']);
            logs = await dbGetAll(STORE_LOGS);
            expect(logs.some(l => l.syncId === 'keep1')).toBe(true);
            expect(logs.some(l => l.syncId === 'delete1')).toBe(false);
        });
    });

    // =============================================================================
    // Property-Based Tests (Deterministic)
    // =============================================================================

    describe('Property 17: extractLogsFromData の チャンク結合 (Deterministic)', () => {
        test('extractLogsFromData combines all 5 logs chunks correctly', () => {
            const chunks = [
                [{ category: 'A', startTime: 1000 }],
                [{ category: 'B', startTime: 2000 }, { category: 'C', startTime: 3000 }],
                [],
                [{ category: 'D', startTime: 4000 }],
                [{ category: 'E', startTime: 5000 }]
            ];
            const data = {};
            chunks.forEach((chunk, i) => {
                data[`sync_logs_v2_${i}`] = chunk;
            });
            const extracted = sessionSync.extractLogsFromData(data);
            expect(extracted.length).toBe(5);
            expect(extracted[0].category).toBe('A');
            expect(extracted[4].category).toBe('E');
        });
    });

    describe('Property 18: reconstructTimeline の順序不変量 (Deterministic)', () => {
        test('reconstructTimeline output is always sorted and non-overlapping', () => {
            const logs = [
                { category: 'B', startTime: 3000, endTime: 4000 },
                { category: 'A', startTime: 1000, endTime: 2000 },
                { category: 'C', startTime: 5000, endTime: 6000 }
            ];
            const reconstructed = sessionSync.reconstructTimeline(logs, false); // fillGaps=false
            expect(reconstructed.length).toBe(3);
            expect(reconstructed[0].category).toBe('A');
            expect(reconstructed[1].category).toBe('B');
            expect(reconstructed[2].category).toBe('C');
        });
    });
});
