import { jest } from '@jest/globals';

jest.unstable_mockModule('../js/db.js', () => ({
    dbAdd: jest.fn().mockResolvedValue(123),
    dbPut: jest.fn().mockResolvedValue(true),
    dbGet: jest.fn(),
    dbGetAll: jest.fn(),
    dbDelete: jest.fn(),
    dbClear: jest.fn(),
    initDB: jest.fn()
}));

const { formatDuration, getAnimationState, startTaskLogic, stopTaskLogic, pauseTaskLogic } = await import('../js/logic.js');
const { dbAdd, dbPut, dbDelete } = await import('../js/db.js');

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
        test('returns even minute state', () => {
            const startTime = 1000000;
            const now = 1000000 + 15000;
            const state = getAnimationState(startTime, now);
            expect(state.type).toBe('even');
            expect(state.inset).toBe('inset(0 0 0 75%)');
        });

        test('returns odd minute state', () => {
            const startTime = 1000000;
            const now = 1000000 + 75000;
            const state = getAnimationState(startTime, now);
            expect(state.type).toBe('odd');
            expect(state.inset).toBe('inset(0 25% 0 0)');
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

        test('stopTaskLogic stops active task', async () => {
            const activeTask = { category: 'Work', startTime: Date.now() };
            const result = await stopTaskLogic(activeTask);
            expect(result).toBeNull();
            expect(dbPut).toHaveBeenCalledWith('logs', expect.objectContaining({ category: 'Work', endTime: expect.any(Number) }));
        });

        test('stopTaskLogic handles pause state', async () => {
            const pauseState = { category: '(待機)', startTime: Date.now(), resumableCategory: 'Work', isPaused: true };
            const result = await stopTaskLogic(pauseState);
            expect(result).toBeNull();
            expect(dbAdd).toHaveBeenCalledWith('logs', expect.objectContaining({ category: '(待機)', endTime: expect.any(Number) }));
            expect(dbDelete).toHaveBeenCalledWith('settings', 'pauseState');
        });

        test('pauseTaskLogic transitions to pause state', async () => {
            const activeTask = { category: 'Work', startTime: Date.now() };
            const newTask = await pauseTaskLogic(activeTask);
            expect(newTask.category).toBe('(待機)');
            expect(newTask.resumableCategory).toBe('Work');
            expect(newTask.isPaused).toBe(true);
            expect(dbPut).toHaveBeenCalledWith('settings', expect.objectContaining({ key: 'pauseState', value: newTask }));
            expect(dbPut).toHaveBeenCalledWith('logs', expect.objectContaining({ category: 'Work', endTime: expect.any(Number) }));
        });

        test('startTaskLogic stops pause state before starting new task', async () => {
            const pauseState = { category: '(待機)', startTime: Date.now(), resumableCategory: 'Work', isPaused: true };
            const newTask = await startTaskLogic('Meeting', pauseState);
            expect(newTask.category).toBe('Meeting');
            expect(dbAdd).toHaveBeenCalledWith('logs', expect.objectContaining({ category: '(待機)' }));
            expect(dbAdd).toHaveBeenCalledWith('logs', expect.objectContaining({ category: 'Meeting' }));
            expect(dbDelete).toHaveBeenCalledWith('settings', 'pauseState');
        });
    });
});
