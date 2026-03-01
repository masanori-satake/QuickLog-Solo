import { jest } from '@jest/globals';
import { SYSTEM_CATEGORY_IDLE } from '../src/js/utils.js';

jest.unstable_mockModule('../src/js/db.js', () => ({
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

const { formatDuration, formatLogDuration, startTaskLogic, stopTaskLogic, pauseTaskLogic } = await import('../src/js/logic.js');
const { dbAdd, dbPut, dbDelete, STORE_LOGS, STORE_SETTINGS, SETTING_KEY_PAUSE_STATE } = await import('../src/js/db.js');

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

    describe('formatLogDuration', () => {
        test('formats seconds correctly (< 60s)', () => {
            expect(formatLogDuration(0)).toBe('0s');
            expect(formatLogDuration(30000)).toBe('30s');
            expect(formatLogDuration(59499)).toBe('59s');
            // 59.5s rounds to 60s, which is 1m
            expect(formatLogDuration(59500)).toBe('1m');
        });

        test('formats minutes correctly (1m to < 60m)', () => {
            expect(formatLogDuration(60000)).toBe('1m');
            expect(formatLogDuration(45 * 60000)).toBe('45m');
            expect(formatLogDuration(59 * 60000 + 29000)).toBe('59m');
            // 59m 30s rounds to 60m, which is 1h
            expect(formatLogDuration(59 * 60000 + 30000)).toBe('1h');
        });

        test('formats hours and minutes correctly (>= 60m)', () => {
            expect(formatLogDuration(60 * 60000)).toBe('1h');
            expect(formatLogDuration(61 * 60000)).toBe('1h 1m');
            expect(formatLogDuration(69 * 60000)).toBe('1h 9m');
            expect(formatLogDuration(70 * 60000)).toBe('1h10m');
            expect(formatLogDuration(75 * 60000)).toBe('1h15m');
            expect(formatLogDuration(120 * 60000)).toBe('2h');
            expect(formatLogDuration(125 * 60000)).toBe('2h 5m');
            expect(formatLogDuration(130 * 60000)).toBe('2h10m');
        });

        test('handles long durations', () => {
            expect(formatLogDuration(10 * 60 * 60000)).toBe('10h');
            expect(formatLogDuration(10 * 60 * 60000 + 5 * 60000)).toBe('10h 5m');
            expect(formatLogDuration(10 * 60 * 60000 + 15 * 60000)).toBe('10h15m');
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
