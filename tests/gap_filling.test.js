
import { setDatabaseName, dbAdd, STORE_LOGS, dbGetAll, dbClear } from '../shared/js/db.js';
import { SYSTEM_CATEGORY_UNKNOWN, SYSTEM_CATEGORY_IDLE } from '../shared/js/utils.js';

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

describe('reconstructTimeline Gap Filling', () => {
    let sessionSync;

    beforeAll(async () => {
        setDatabaseName('QuickLogSoloDB_Test_GapFilling');
        sessionSync = await import('../shared/js/session_sync.js');
    });

    test('should NOT fill gaps when fillGaps is false', () => {
        const logs = [
            { syncId: '1', category: 'Task A', startTime: 1000, endTime: 2000 },
            { syncId: '2', category: 'Task B', startTime: 3000, endTime: 4000 }
        ];
        const result = sessionSync.reconstructTimeline(logs, false);
        const unknowns = result.filter(l => l.category === SYSTEM_CATEGORY_UNKNOWN);
        expect(unknowns.length).toBe(0);
        expect(result.length).toBe(2);
    });

    test('should fill gaps when fillGaps is true and NO manual stop exists', () => {
        const logs = [
            { syncId: '1', category: 'Task A', startTime: 1000, endTime: 2000 },
            { syncId: '2', category: 'Task B', startTime: 3000, endTime: 4000 }
        ];
        const result = sessionSync.reconstructTimeline(logs, true);
        const unknowns = result.filter(l => l.category === SYSTEM_CATEGORY_UNKNOWN);
        expect(unknowns.length).toBe(1);
        expect(unknowns[0].startTime).toBe(2000);
        expect(unknowns[0].endTime).toBe(3000);
    });

    test('should NOT fill gaps after a manual stop even if fillGaps is true', () => {
        const logs = [
            { syncId: '1', category: 'Task A', startTime: 1000, endTime: 2000 },
            { syncId: 'stop', category: SYSTEM_CATEGORY_IDLE, startTime: 2000, endTime: 2000, isManualStop: true },
            { syncId: '2', category: 'Task B', startTime: 3000, endTime: 4000 }
        ];
        const result = sessionSync.reconstructTimeline(logs, true);
        const unknowns = result.filter(l => l.category === SYSTEM_CATEGORY_UNKNOWN);
        expect(unknowns.length).toBe(0);
        // Result should have Task A, Stop, Task B
        expect(result.length).toBe(3);
    });

    test('should still fill gaps between tasks if manual stop is NOT at the gap start', () => {
        const logs = [
            { syncId: '1', category: 'Task A', startTime: 1000, endTime: 2000 },
            // Gap 2000-2500
            { syncId: '2', category: 'Task B', startTime: 2500, endTime: 3000 },
            { syncId: 'stop', category: SYSTEM_CATEGORY_IDLE, startTime: 3000, endTime: 3000, isManualStop: true },
            // Gap 3000-4000 (should be skipped)
            { syncId: '3', category: 'Task C', startTime: 4000, endTime: 5000 }
        ];
        const result = sessionSync.reconstructTimeline(logs, true);
        const unknowns = result.filter(l => l.category === SYSTEM_CATEGORY_UNKNOWN);
        expect(unknowns.length).toBe(1);
        expect(unknowns[0].startTime).toBe(2000);
        expect(unknowns[0].endTime).toBe(2500);
    });

    test('should NOT insert Unknown on ambiguous overlaps if fillGaps is false', () => {
        const logs = [
            { syncId: '1', category: 'Task A', startTime: 1000, endTime: 3000 },
            { syncId: '2', category: 'Task B', startTime: 2000, endTime: 4000 }
        ];
        // 1000-2000: Task A
        // 2000-3000: Conflict (A and B)
        // 3000-4000: Task B
        const result = sessionSync.reconstructTimeline(logs, false);
        const unknowns = result.filter(l => l.category === SYSTEM_CATEGORY_UNKNOWN);
        expect(unknowns.length).toBe(0);
        // Segment 2000-3000 should just be skipped if fillGaps is false
        expect(result.length).toBe(2); // Only solid segments 1000-2000 and 3000-4000
    });
});
