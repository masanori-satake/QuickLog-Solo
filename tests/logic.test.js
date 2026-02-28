import { jest } from '@jest/globals';
import { SYSTEM_CATEGORY_IDLE } from '../js/utils.js';

jest.unstable_mockModule('../js/db.js', () => ({
    dbAdd: jest.fn().mockResolvedValue(123),
    dbPut: jest.fn().mockResolvedValue(true),
    dbGet: jest.fn(),
    dbGetAll: jest.fn(),
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

const { formatDuration, getAnimationState, startTaskLogic, stopTaskLogic, pauseTaskLogic } = await import('../js/logic.js');
const { dbAdd, dbPut, dbDelete, STORE_LOGS, STORE_SETTINGS, SETTING_KEY_PAUSE_STATE } = await import('../js/db.js');

describe('Logic Module', () => {
    describe('formatDuration', () => {
        test('formats milliseconds correctly', () => {
            const ms = (2 * 3600000) + (15 * 60000) + 30000;
            const duration = formatDuration(ms);
            expect(duration.hours).toBe(2);
            expect(duration.minutes).toBe(15);
            expect(duration.seconds).toBe(30);
            expect(duration.toString()).toBe('02:15:30');
        });

        test('handles single digits with padding', () => {
            const ms = (1 * 3600000) + (5 * 60000) + 9000;
            expect(formatDuration(ms).toString()).toBe('01:05:09');
        });
    });

    describe('getAnimationState', () => {
        test('returns left-to-right state', () => {
            const startTime = 1000000;
            const now = 1000000 + 15000; // 15s elapsed (25%)
            const state = getAnimationState(startTime, 'left-to-right', now);
            expect(state.inset).toBe('inset(0 75% 0 0)');
        });

        test('returns right-to-left state', () => {
            const startTime = 1000000;
            const now = 1000000 + 15000; // 15s elapsed (25%)
            const state = getAnimationState(startTime, 'right-to-left', now);
            expect(state.inset).toBe('inset(0 0 0 75%)');
        });

        test('returns clock state', () => {
            const startTime = 1000000;
            const now = 1000000 + 15000; // 15s elapsed (25%)
            const state = getAnimationState(startTime, 'clock', now);
            expect(state.angle).toBe(90);
            expect(state.isPhase2).toBe(false);
        });

        test('returns clock state in phase 2', () => {
            const startTime = 1000000;
            const now = 1000000 + 75000; // 75s elapsed
            const state = getAnimationState(startTime, 'clock', now);
            expect(state.angle).toBe(90); // (15s % 60s) * 360 / 60
            expect(state.isPhase2).toBe(true);
        });
    });

    describe('Task Logic', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('startTaskLogic starts a new task', async () => {
            const newTask = await startTaskLogic('Work', null);
            expect(newTask.category).toBe('Work');
            expect(dbAdd).toHaveBeenCalled();
        });

        test('startTaskLogic does nothing if same category', async () => {
            const activeTask = { category: 'Work', startTime: Date.now() };
            const newTask = await startTaskLogic('Work', activeTask);
            expect(newTask).toBe(activeTask);
            expect(dbAdd).not.toHaveBeenCalled();
        });

        test('stopTaskLogic stops active task and adds stop marker if manual', async () => {
            const activeTask = { id: 1, category: 'Work', startTime: Date.now() };
            const result = await stopTaskLogic(activeTask, true);
            expect(result).toBeNull();
            // Original task should be completed with isManualStop: false
            expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                id: 1,
                category: 'Work',
                endTime: expect.any(Number),
                isManualStop: false
            }));
            // A new stop marker should be added
            expect(dbAdd).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                category: SYSTEM_CATEGORY_IDLE,
                endTime: expect.any(Number),
                isManualStop: true
            }));
        });

        test('stopTaskLogic handles pause state with id', async () => {
            const pauseState = { id: 2, category: SYSTEM_CATEGORY_IDLE, startTime: Date.now(), resumableCategory: 'Work', isPaused: true };
            const result = await stopTaskLogic(pauseState);
            expect(result).toBeNull();
            expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                id: 2,
                category: SYSTEM_CATEGORY_IDLE,
                endTime: expect.any(Number),
                isManualStop: false
            }));
            expect(dbDelete).toHaveBeenCalledWith(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
        });

        test('stopTaskLogic handles manual stop during pause state by adding separate marker', async () => {
            const pauseState = { id: 2, category: SYSTEM_CATEGORY_IDLE, startTime: Date.now(), resumableCategory: 'Work', isPaused: true };
            const result = await stopTaskLogic(pauseState, true);
            expect(result).toBeNull();
            // The idle log should be completed normally
            expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                id: 2,
                category: SYSTEM_CATEGORY_IDLE,
                endTime: expect.any(Number),
                isManualStop: false
            }));
            // A separate manual stop marker should be added
            expect(dbAdd).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                category: SYSTEM_CATEGORY_IDLE,
                isManualStop: true
            }));
            expect(dbDelete).toHaveBeenCalledWith(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
        });

        test('pauseTaskLogic transitions to pause state and adds to logs', async () => {
            const activeTask = { id: 1, category: 'Work', startTime: Date.now() };
            const newTask = await pauseTaskLogic(activeTask);
            expect(newTask.category).toBe(SYSTEM_CATEGORY_IDLE);
            expect(newTask.resumableCategory).toBe('Work');
            expect(newTask.isPaused).toBe(true);
            expect(dbAdd).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({ category: SYSTEM_CATEGORY_IDLE }));
            expect(dbPut).toHaveBeenCalledWith(STORE_SETTINGS, expect.objectContaining({ key: SETTING_KEY_PAUSE_STATE, value: expect.objectContaining({ id: 123 }) }));
            expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({ id: 1, category: 'Work', endTime: expect.any(Number) }));
        });

        test('startTaskLogic stops pause state and updates log entry before starting new task', async () => {
            const pauseState = { id: 2, category: SYSTEM_CATEGORY_IDLE, startTime: Date.now(), resumableCategory: 'Work', isPaused: true };
            const newTask = await startTaskLogic('Meeting', pauseState);
            expect(newTask.category).toBe('Meeting');
            expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({ id: 2, category: SYSTEM_CATEGORY_IDLE, endTime: expect.any(Number) }));
            expect(dbAdd).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({ category: 'Meeting' }));
            expect(dbDelete).toHaveBeenCalledWith(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
        });
    });
});
