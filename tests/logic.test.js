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

const { formatDuration, formatLogDuration, startTaskLogic, stopTaskLogic, pauseTaskLogic, stripEmojis, getVisualWidth, visualPadEnd, generateReport, aggregateTimeByCategoryAndTags } = await import('../src/js/logic.js');
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
        test('formats seconds correctly (< 60s) with rounding', () => {
            expect(formatLogDuration(0)).toBe('0s');
            expect(formatLogDuration(499)).toBe('0s');
            expect(formatLogDuration(500)).toBe('1s');
            expect(formatLogDuration(30000)).toBe('30s');
            expect(formatLogDuration(59499)).toBe('59s');
            expect(formatLogDuration(59500)).toBe('1m'); // Rounds up to 1m
        });

        test('formats minutes correctly (1m to < 60m) with rounding', () => {
            expect(formatLogDuration(60000)).toBe('1m');
            expect(formatLogDuration(60000 + 29999)).toBe('1m');
            expect(formatLogDuration(60000 + 30000)).toBe('2m'); // Rounds up to 2m
            expect(formatLogDuration(45 * 60000)).toBe('45m');
            expect(formatLogDuration(59 * 60000 + 29999)).toBe('59m');
            expect(formatLogDuration(59 * 60000 + 30000)).toBe('1h'); // Rounds up to 1h
        });

        test('formats hours and minutes correctly (>= 60m) with rounding', () => {
            expect(formatLogDuration(60 * 60000)).toBe('1h');
            expect(formatLogDuration(60 * 60000 + 29999)).toBe('1h');
            expect(formatLogDuration(60 * 60000 + 30000)).toBe('1h 1m'); // 60.5m -> 61m -> 1h 1m
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

        test('startTaskLogic includes color and tags in log entry for historical preservation', async () => {
            const color = 'secondary';
            const tags = 'Project A';
            const newTask = await startTaskLogic('Work', null, null, color, tags);
            expect(newTask.category).toBe('Work');
            expect(newTask.color).toBe(color);
            expect(newTask.tags).toBe(tags);
            expect(dbAdd).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                category: 'Work',
                color: color,
                tags: tags
            }));
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

    describe('Report Generation Logic', () => {
        const sampleLogs = [
            { startTime: new Date('2026-03-03T10:00:00').getTime(), endTime: new Date('2026-03-03T10:30:00').getTime(), category: 'Task 1' },
            { startTime: new Date('2026-03-03T10:30:00').getTime(), endTime: new Date('2026-03-03T11:00:00').getTime(), category: '💻 Task 2' },
            { startTime: new Date('2026-03-03T11:00:00').getTime(), endTime: new Date('2026-03-03T11:15:00').getTime(), category: '__IDLE__' }
        ];

        const defaultOptions = {
            format: 'markdown',
            emoji: 'keep',
            endTime: 'none',
            duration: 'none',
            idleText: '(待機)',
            headerTime: 'Time',
            headerCategory: 'Category'
        };

        test('stripEmojis removes emojis correctly', () => {
            expect(stripEmojis('💻 Work')).toBe('Work');
            expect(stripEmojis('Meeting 🤝')).toBe('Meeting');
            expect(stripEmojis('🔥 Focus 🔥')).toBe('Focus');
        });

        test('getVisualWidth calculates width correctly', () => {
            expect(getVisualWidth('abc')).toBe(3);
            expect(getVisualWidth('あいう')).toBe(6);
            expect(getVisualWidth('aいc')).toBe(4);
        });

        test('visualPadEnd pads correctly', () => {
            expect(visualPadEnd('abc', 5)).toBe('abc  ');
            expect(visualPadEnd('あいう', 10)).toBe('あいう    ');
        });

        test('generates markdown report', () => {
            const report = generateReport(sampleLogs, defaultOptions);
            expect(report).toMatch(/- \d{1,2}:\d{2}( [AP]M)? \| Task 1/);
            expect(report).toMatch(/- \d{1,2}:\d{2}( [AP]M)? \| 💻 Task 2/);
            expect(report).toMatch(/- \d{1,2}:\d{2}( [AP]M)? \| \(待機\)/);
        });

        test('generates csv report', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'csv' });
            expect(report).toContain('startTime,endTime,category,duration');
            expect(report).toMatch(/\d{1,2}:\d{2}( [AP]M)?,\d{1,2}:\d{2}( [AP]M)?,"Task 1",30m/);
        });

        test('handles emoji removal', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, emoji: 'remove' });
            expect(report).toMatch(/- \d{1,2}:\d{2}( [AP]M)? \| Task 2/);
        });

        test('shows end time', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, endTime: 'show' });
            expect(report).toMatch(/- \d{1,2}:\d{2}( [AP]M)? - \d{1,2}:\d{2}( [AP]M)? \| Task 1/);
        });

        test('shows duration on the right', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, duration: 'right' });
            expect(report).toMatch(/- \d{1,2}:\d{2}( [AP]M)? \(30m\) \| Task 1/);
        });

        test('generates text table report', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'text-table' });
            expect(report).toContain('| Time');
            expect(report).toContain('| Category');
            expect(report).toMatch(/\| \d{1,2}:\d{2}( [AP]M)?\s+\| Task 1/);
        });

        test('filters out manual stop markers', () => {
            const logsWithStop = [
                ...sampleLogs,
                { startTime: Date.now(), endTime: Date.now(), category: '__IDLE__', isManualStop: true }
            ];
            const report = generateReport(logsWithStop, defaultOptions);
            const idleCount = (report.match(/\(待機\)/g) || []).length;
            expect(idleCount).toBe(1); // Only the non-manual idle from sampleLogs
        });
    });

    describe('aggregateTimeByCategoryAndTags', () => {
        const logs = [
            { startTime: 1000, endTime: 70000, category: 'Work', tags: 'ProjectA, Urgent' }, // 1.15 min
            { startTime: 100000, endTime: 160000, category: 'Work', tags: 'ProjectB' },      // 1 min
            { startTime: 200000, endTime: 230000, category: 'Meeting', tags: 'ProjectA' },   // 0.5 min
            { startTime: 300000, endTime: 360000, category: '__IDLE__', tags: '' }           // 1 min
        ];

        test('aggregates time by category', () => {
            const result = aggregateTimeByCategoryAndTags(logs);
            expect(result).toContain('Work | 2 min');
            expect(result).toContain('Meeting | 1 min');
            expect(result).toContain('(待機) | 1 min');
        });

        test('aggregates time by tags', () => {
            const result = aggregateTimeByCategoryAndTags(logs);
            expect(result).toContain('#ProjectA | 2 min'); // 1.15 + 0.5 = 1.65 -> 2
            expect(result).toContain('#ProjectB | 1 min');
            expect(result).toContain('#Urgent | 1 min');
        });

        test('handles custom idle text', () => {
            const result = aggregateTimeByCategoryAndTags(logs, { idleText: 'Paused' });
            expect(result).toContain('Paused | 1 min');
        });

        test('handles logs without tags', () => {
            const logsNoTags = [
                { startTime: 0, endTime: 60000, category: 'Work' }
            ];
            const result = aggregateTimeByCategoryAndTags(logsNoTags);
            expect(result).toContain('Work | 1 min');
            expect(result).not.toContain('---');
        });
    });
});
