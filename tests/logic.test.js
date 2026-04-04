import { jest } from '@jest/globals';
import { SYSTEM_CATEGORY_IDLE } from '../shared/js/utils.js';

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

const { formatDuration, formatLogDuration, startTaskLogic, stopTaskLogic, pauseTaskLogic, stripEmojis, getVisualWidth, visualPadEnd, generateReport, calculateTagAggregation } = await import('../shared/js/logic.js');
const { dbAdd, dbPut, dbDelete, dbGetAll, STORE_LOGS, STORE_SETTINGS, SETTING_KEY_PAUSE_STATE } = await import('../shared/js/db.js');

describe('Logic Module', () => {
    describe('formatDuration', () => {
        test('formats milliseconds correctly', () => {
            const ms = (2 * 3600000) + (15 * 60000) + 30000;
            expect(formatDuration(ms)).toBe('02:15:30');
        });

        test('handles single digits with padding', () => {
            const ms = (1 * 3600000) + (5 * 60000) + 9000;
            expect(formatDuration(ms)).toBe('01:05:09');
        });

        test('handles long durations (100+ hours)', () => {
            const ms = (100 * 3600000);
            expect(formatDuration(ms)).toBe('100:00:00');
            const ms2 = (123 * 3600000) + (45 * 60000) + 6000;
            expect(formatDuration(ms2)).toBe('123:45:06');
        });

        test('handles extremely long durations (1000+ hours)', () => {
            const ms = (1024 * 3600000) + (59 * 60000) + 59000;
            expect(formatDuration(ms)).toBe('1024:59:59');
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

        test('formats hours and minutes correctly (>= 60m) with rounding and space rule', () => {
            expect(formatLogDuration(60 * 60000)).toBe('1h');
            expect(formatLogDuration(60 * 60000 + 29999)).toBe('1h');
            expect(formatLogDuration(60 * 60000 + 30000)).toBe('1h 1m'); // 60.5m -> 61m -> 1h 1m (space because < 10)
            expect(formatLogDuration(61 * 60000)).toBe('1h 1m');
            expect(formatLogDuration(69 * 60000)).toBe('1h 9m');
            expect(formatLogDuration(69 * 60000 + 29999)).toBe('1h 9m');
            expect(formatLogDuration(69 * 60000 + 30000)).toBe('1h10m'); // 69.5m -> 70m -> 1h10m (no space)
            expect(formatLogDuration(70 * 60000)).toBe('1h10m'); // No space because >= 10
            expect(formatLogDuration(75 * 60000)).toBe('1h15m');
            expect(formatLogDuration(120 * 60000)).toBe('2h');
            expect(formatLogDuration(125 * 60000)).toBe('2h 5m');
            expect(formatLogDuration(130 * 60000)).toBe('2h10m');
        });

        test('handles long durations with space rule', () => {
            expect(formatLogDuration(10 * 60 * 60000)).toBe('10h');
            expect(formatLogDuration(10 * 60 * 60000 + 5 * 60000)).toBe('10h 5m');
            expect(formatLogDuration(10 * 60 * 60000 + 15 * 60000)).toBe('10h15m');
        });
    });

    describe('Tag Aggregation Logic', () => {
        test('calculates aggregated duration per tag correctly', () => {
            const logs = [
                { startTime: 1000, endTime: 2000, category: 'Task 1', tags: 'A, B' },
                { startTime: 3000, endTime: 5000, category: 'Task 2', tags: 'B, C' },
                { startTime: 6000, endTime: 7000, category: 'Task 3', tags: '' }, // No tags
                { startTime: 8000, endTime: 9000, category: SYSTEM_CATEGORY_IDLE, tags: '' }, // Idle should be ignored
                { startTime: 9000, endTime: 10000, category: 'Task 4', isManualStop: true } // Manual stop should be ignored
            ];
            const result = calculateTagAggregation(logs, 'No Tags');
            expect(result['A']).toBe(1000);
            expect(result['B']).toBe(1000 + 2000);
            expect(result['C']).toBe(2000);
            expect(result['No Tags']).toBe(1000);
            expect(result[SYSTEM_CATEGORY_IDLE]).toBeUndefined();
        });

        test('deduplicates tags in a single log entry', () => {
            const logs = [
                { startTime: 0, endTime: 1000, category: 'Task', tags: 'A, A, B' }
            ];
            const result = calculateTagAggregation(logs, 'None');
            expect(result['A']).toBe(1000); // Not 2000
            expect(result['B']).toBe(1000);
        });

        test('handles overlapping tags with different spacing', () => {
            const logs = [
                { startTime: 0, endTime: 1000, tags: 'Tag1,Tag2' },
                { startTime: 1000, endTime: 2000, tags: ' Tag1 , Tag3 ' }
            ];
            const result = calculateTagAggregation(logs, 'None');
            expect(result['Tag1']).toBe(2000);
            expect(result['Tag2']).toBe(1000);
            expect(result['Tag3']).toBe(1000);
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

        test('stopTaskLogic supports custom end time and manual stop marker', async () => {
            const activeTask = { id: 1, category: 'Work', startTime: 1000 };
            const customEnd = 5000;
            await stopTaskLogic(activeTask, true, customEnd);

            // Task should be closed at customEnd
            expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                id: 1,
                endTime: customEnd,
                isManualStop: false
            }));
            // Stop marker should be created at customEnd
            expect(dbAdd).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                category: SYSTEM_CATEGORY_IDLE,
                startTime: customEnd,
                endTime: customEnd,
                isManualStop: true
            }));
        });

        test('stopTaskLogic handles custom end time during pause state', async () => {
            const customEnd = 5000;
            const pauseState = { id: 2, category: SYSTEM_CATEGORY_IDLE, startTime: 1000, resumableCategory: 'Work', isPaused: true };
            await stopTaskLogic(pauseState, true, customEnd);

            // The pause/idle log should be completed at customEnd
            expect(dbPut).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                id: 2,
                category: SYSTEM_CATEGORY_IDLE,
                endTime: customEnd,
                isManualStop: false
            }));
            // A separate manual stop marker should be added at customEnd
            expect(dbAdd).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                category: SYSTEM_CATEGORY_IDLE,
                startTime: customEnd,
                endTime: customEnd,
                isManualStop: true
            }));
            expect(dbDelete).toHaveBeenCalledWith(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
        });

        test('stopTaskLogic does not add duplicate stop markers', async () => {
            const customEnd = 5000;
            const existingStopMarker = {
                category: SYSTEM_CATEGORY_IDLE,
                startTime: customEnd,
                endTime: customEnd,
                isManualStop: true
            };
            dbGetAll.mockResolvedValueOnce([existingStopMarker]);

            const activeTask = { id: 1, category: 'Work', startTime: 1000 };
            await stopTaskLogic(activeTask, true, customEnd);

            // dbAdd should NOT be called for the stop marker because it's a duplicate
            // Note: dbAdd might have been called in other tests, so we check calls specifically
            const stopMarkerAdds = dbAdd.mock.calls.filter(call =>
                call[0] === STORE_LOGS && call[1].isManualStop === true
            );
            expect(stopMarkerAdds.length).toBe(0);
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

        test('stopTaskLogic handles case where idleLog has no ID (branch coverage)', async () => {
            const activeNoId = { category: SYSTEM_CATEGORY_IDLE, startTime: Date.now(), isPaused: true };
            dbAdd.mockResolvedValue(123);
            await stopTaskLogic(activeNoId);
            // Hits line 372: } else { await dbAdd(STORE_LOGS, idleLog); }
            expect(dbAdd).toHaveBeenCalledWith(STORE_LOGS, expect.objectContaining({
                category: SYSTEM_CATEGORY_IDLE
            }));
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

        test('generates csv report (default: no endTime, no duration)', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'csv' });
            expect(report).toContain('startTime,category');
            expect(report).not.toContain('endTime');
            expect(report).not.toContain('duration');
            expect(report).toMatch(/\d{1,2}:\d{2}( [AP]M)?,Task 1/);
        });

        test('generates csv report with endTime and duration', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'csv', endTime: 'show', duration: 'right' });
            expect(report).toContain('startTime,endTime,category,duration');
            expect(report).toMatch(/\d{1,2}:\d{2}( [AP]M)?,\d{1,2}:\d{2}( [AP]M)?,Task 1,30m/);
        });

        test('generates tsv report (default: no endTime, no duration)', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'tsv' });
            expect(report).toContain('startTime\tcategory');
            expect(report).not.toContain('endTime');
            expect(report).not.toContain('duration');
            expect(report).toMatch(/\d{1,2}:\d{2}( [AP]M)?\tTask 1/);
        });

        test('generates tsv report with endTime and duration', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'tsv', endTime: 'show', duration: 'right' });
            expect(report).toContain('startTime\tendTime\tcategory\tduration');
            expect(report).toMatch(/\d{1,2}:\d{2}( [AP]M)?\t\d{1,2}:\d{2}( [AP]M)?\tTask 1\t30m/);
        });

        test('tsv report handles quotes and tabs in category', () => {
            const logsWithTab = [
                { startTime: 1000, endTime: 2000, category: 'Task "A"\tB' }
            ];
            const report = generateReport(logsWithTab, { ...defaultOptions, format: 'tsv' });
            expect(report).toContain('"Task ""A""\tB"');
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

        test('handles time adjustment rounding correctly', () => {
            const logs = [
                { startTime: new Date('2026-03-03T10:00:00').getTime(), endTime: new Date('2026-03-03T10:07:00').getTime(), category: 'Task 1' },
                { startTime: new Date('2026-03-03T10:07:00').getTime(), endTime: new Date('2026-03-03T10:15:00').getTime(), category: 'Task 2' }
            ];
            // Adjust to 5m. 10:07 should round to 10:05.
            const report = generateReport(logs, { ...defaultOptions, adjust: '5', endTime: 'show' });
            expect(report).toContain('10:00');
            expect(report).toContain('10:05'); // Rounded from 10:07
            expect(report).toContain('10:15'); // Last timestamp preserved
        });

        test('preserves workday boundaries during time adjustment', () => {
            const logs = [
                { startTime: new Date('2026-03-03T09:02:00').getTime(), endTime: new Date('2026-03-03T17:58:00').getTime(), category: 'Work' }
            ];
            // Even with 10m adjustment, 09:02 and 17:58 should be preserved as they are boundaries.
            const report = generateReport(logs, { ...defaultOptions, adjust: '10', endTime: 'show' });
            // Note: Use regex or check parts to avoid AM/PM mismatch if locale differs
            expect(report).toMatch(/09:02/);
            expect(report).toMatch(/05:58/); // 17:58 -> 05:58 PM
        });

        test('generates wiki markup report', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'wiki' });
            expect(report).toMatch(/\* \d{1,2}:\d{2}( [AP]M)? \| Task 1/);
        });

        test('generates html table report', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'html' });
            expect(report).toContain('<table>');
            expect(report).toContain('<thead>');
            expect(report).toContain('<tbody>');
            expect(report).toContain('<td>Task 1</td>');
        });

        test('generates plain text report', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'text-plain' });
            expect(report).toMatch(/\d{1,2}:\d{2}( [AP]M)?\s+\| Task 1/);
        });

        test('handles duration at bottom in markdown', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, duration: 'bottom' });
            expect(report).toContain('(30m)');
            expect(report).toContain('\n  (30m)');
        });

        test('handles invalid adjust values gracefully', () => {
            const logs = [
                { startTime: 1000000, endTime: 1100000, category: 'Task' }
            ];
            // adjust: 'none' -> 0 ms interval
            const expected = generateReport(logs, { ...defaultOptions, adjust: 'none' });

            // adjust: '0' -> 0 ms interval
            expect(generateReport(logs, { ...defaultOptions, adjust: '0' })).toBe(expected);

            // adjust: invalid string -> 0 ms interval
            expect(generateReport(logs, { ...defaultOptions, adjust: 'abc' })).toBe(expected);
        });

        test('handles very large adjust values', () => {
            const logs = [
                { startTime: new Date('2026-03-03T10:00:00').getTime(), endTime: new Date('2026-03-03T11:00:00').getTime(), category: 'Task 1' },
                { startTime: new Date('2026-03-03T11:00:00').getTime(), endTime: new Date('2026-03-03T12:00:00').getTime(), category: 'Task 2' }
            ];
            // Adjust to 1440m (24h). Since first and last are preserved, boundaries should remain.
            const report = generateReport(logs, { ...defaultOptions, adjust: '1440', endTime: 'show' });
            expect(report).toContain('10:00');
            expect(report).toContain('12:00');
        });

        test('handles multiple tasks with gaps during time adjustment', () => {
            const logs = [
                { startTime: new Date('2026-03-03T10:02:00').getTime(), endTime: new Date('2026-03-03T10:08:00').getTime(), category: 'Task 1' },
                { startTime: new Date('2026-03-03T11:02:00').getTime(), endTime: new Date('2026-03-03T11:08:00').getTime(), category: 'Task 2' }
            ];
            // Adjust to 10m.
            // 10:02 (first) fixed
            // 10:08 rounded to 10:10? but must be <= next original (11:02). OK.
            // 11:02 rounded to 11:00? but must be >= previous adjusted (10:10). OK.
            // 11:08 (last) fixed
            const report = generateReport(logs, { ...defaultOptions, adjust: '10', endTime: 'show' });
            expect(report).toContain('10:02');
            expect(report).toContain('10:10');
            expect(report).toContain('11:00');
            expect(report).toContain('11:08');
        });

        test('returns empty string for unknown format', () => {
            const report = generateReport(sampleLogs, { ...defaultOptions, format: 'unknown' });
            expect(report).toBe('');
        });

        test('generateReport supports duration: bottom in various formats', () => {
            const logs = [{ startTime: new Date('2026-03-03T10:00:00').getTime(), endTime: new Date('2026-03-03T10:00:01').getTime(), category: 'Dev' }];
            const options = {
                format: 'html',
                duration: 'bottom',
                endTime: 'show',
                idleText: '(待機)',
                headerTime: 'Time',
                headerCategory: 'Category'
            };
            const html = generateReport(logs, options);
            expect(html).toContain('<br>(1s)');

            const textTable = generateReport(logs, { ...options, format: 'text-table' });
            expect(textTable).toContain('(1s)');

            const textPlain = generateReport(logs, { ...options, format: 'text-plain' });
            expect(textPlain).toContain('(1s)');
        });
    });

    describe('calculateTagAggregation Edge Cases', () => {
        test('handles empty logs', () => {
            expect(calculateTagAggregation([], 'None')).toEqual({});
        });

        test('handles logs with only ignored categories', () => {
            const logs = [
                { startTime: 0, endTime: 1000, category: SYSTEM_CATEGORY_IDLE },
                { startTime: 1000, endTime: 2000, category: 'Work', isManualStop: true }
            ];
            expect(calculateTagAggregation(logs, 'None')).toEqual({});
        });

        test('handles zero or negative duration logs', () => {
            const logs = [
                { startTime: 1000, endTime: 1000, category: 'Zero', tags: 'A' },
                { startTime: 2000, endTime: 1000, category: 'Negative', tags: 'B' }
            ];
            expect(calculateTagAggregation(logs, 'None')).toEqual({});
        });
    });
});
