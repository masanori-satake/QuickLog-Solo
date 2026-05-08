import { jest } from '@jest/globals';

jest.unstable_mockModule('../shared/js/db.js', () => ({
    dbAdd: jest.fn().mockResolvedValue(123),
    dbPut: jest.fn().mockResolvedValue(true),
    dbGet: jest.fn(),
    dbGetAll: jest.fn().mockResolvedValue([]),
    dbDelete: jest.fn(),
    dbClear: jest.fn(),
    initDB: jest.fn(),
    STORE_LOGS: 'logs',
    STORE_CATEGORIES: 'categories',
    STORE_SETTINGS: 'settings',
    SETTING_KEY_THEME: 'theme',
    SETTING_KEY_FONT: 'font',
    SETTING_KEY_ANIMATION: 'animation',
    SETTING_KEY_PAUSE_STATE: 'pauseState'
}));

const { deleteHistoryItem, updateHistoryStartTime } = await import('../shared/js/logic.js');
const { dbGetAll, dbPut, dbDelete, dbGet, STORE_LOGS, STORE_SETTINGS, SETTING_KEY_PAUSE_STATE } = await import('../shared/js/db.js');

describe('Revised Fix Verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('deleting a log should update subsequent log duration and sync pauseState', async () => {
        const logs = [
            { id: 1, startTime: 1000, endTime: 2000, category: 'A' },
            { id: 2, startTime: 2000, category: 'IDLE', isPaused: true }
        ];
        dbGetAll.mockResolvedValue(logs);
        dbGet.mockImplementation((store, key) => {
            if (store === STORE_SETTINGS && key === SETTING_KEY_PAUSE_STATE) {
                return Promise.resolve({ key: SETTING_KEY_PAUSE_STATE, value: logs[1] });
            }
            return Promise.resolve(null);
        });

        await deleteHistoryItem(1); // Delete A

        // Pause task (id 2) should be updated in logs
        expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({ id: 2, startTime: 1000 }));

        // AND it should be updated in settings
        expect(dbPut).toHaveBeenCalledWith(STORE_SETTINGS, expect.objectContaining({
            key: SETTING_KEY_PAUSE_STATE,
            value: expect.objectContaining({ id: 2, startTime: 1000, isPaused: true })
        }));
    });

    test('deleting the paused log itself should clear pauseState', async () => {
        const logs = [
            { id: 1, startTime: 1000, category: 'IDLE', isPaused: true }
        ];
        dbGetAll.mockResolvedValue(logs);
        dbGet.mockImplementation((store, key) => {
            if (store === STORE_SETTINGS && key === SETTING_KEY_PAUSE_STATE) {
                return Promise.resolve({ key: SETTING_KEY_PAUSE_STATE, value: logs[0] });
            }
            return Promise.resolve(null);
        });

        await deleteHistoryItem(1); // Delete the paused task

        expect(dbDelete).toHaveBeenCalledWith(STORE_LOGS, 1);
        expect(dbDelete).toHaveBeenCalledWith(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    });

    test('updateHistoryStartTime should NOT affect pauseState (as per review feedback)', async () => {
        const logs = [
            { id: 1, startTime: 1000, endTime: 2000, category: 'A' },
            { id: 2, startTime: 2000, category: 'IDLE', isPaused: true }
        ];
        dbGetAll.mockResolvedValue(logs);
        dbGet.mockImplementation((store, key) => {
            if (store === STORE_SETTINGS && key === SETTING_KEY_PAUSE_STATE) {
                return Promise.resolve({ key: SETTING_KEY_PAUSE_STATE, value: logs[1] });
            }
            return Promise.resolve(null);
        });

        // updateHistoryStartTime is used for history, but if it hits the active task...
        // Wait, updateHistoryStartTime usually targets a log with endTime.
        // If we target log 1:
        await updateHistoryStartTime(1, 1500);

        // log 1 updated
        expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({ id: 1, startTime: 1500 }));

        // Settings should NOT be called because propagation for updateHistoryStartTime is backwards
        expect(dbPut).not.toHaveBeenCalledWith(STORE_SETTINGS, expect.anything());
    });
});
