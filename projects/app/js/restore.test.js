import { jest } from '@jest/globals';
import { fc, test as fcTest } from '@fast-check/jest';

// Mock dependencies using the same import paths as restore.js
jest.unstable_mockModule('../shared/js/db.js', () => ({
    dbClear: jest.fn(),
    dbAddMultiple: jest.fn(),
    dbPut: jest.fn(),
    STORE_LOGS: 'logs',
    STORE_CATEGORIES: 'categories',
    STORE_SETTINGS: 'settings',
    STORE_ALARMS: 'alarms',
    SETTING_KEY_ANIMATION: 'animation',
}));

jest.unstable_mockModule('../shared/js/schema.js', () => ({
    SCHEMA_TYPE_PAGE_BREAK: 'page-break',
    SCHEMA_TYPE_HISTORY_TASK: 'task',
    SCHEMA_TYPE_HISTORY_IDLE: 'idle',
    SCHEMA_TYPE_HISTORY_STOP: 'stop',
    validateCategorySchema: jest.fn(() => true),
    validateHistorySchema: jest.fn(() => true),
    validateSettingsSchema: jest.fn(() => true),
    validateAlarmSchema: jest.fn(() => true),
    validateCustomAnimationSchema: jest.fn(() => true),
}));

jest.unstable_mockModule('../shared/js/utils.js', () => ({
    SYSTEM_CATEGORY_PAGE_BREAK: '__PAGE_BREAK__',
    SYSTEM_CATEGORY_IDLE: '__IDLE__',
}));

jest.unstable_mockModule('../shared/js/idb_storage.js', () => ({
    initAnimationDB: jest.fn(async () => ({
        transaction: jest.fn(() => ({
            objectStore: jest.fn(() => ({
                clear: jest.fn(() => ({
                    set onsuccess(fn) {
                        fn();
                    },
                    set onerror(_fn) {},
                })),
            })),
        })),
    })),
    saveAnimationBlob: jest.fn(),
}));

jest.unstable_mockModule('../shared/js/utils/storage.js', () => ({
    setCustomAnimationMetadataMap: jest.fn(),
}));

// Import mocked modules
const { dbClear, dbAddMultiple, dbPut } = await import('../shared/js/db.js');
const {
    validateCategorySchema,
    validateHistorySchema,
    validateSettingsSchema,
    validateAlarmSchema,
    validateCustomAnimationSchema,
} = await import('../shared/js/schema.js');
// eslint-disable-next-line no-unused-vars -- import required to activate jest.unstable_mockModule
const { initAnimationDB, saveAnimationBlob } = await import('../shared/js/idb_storage.js');
const { setCustomAnimationMetadataMap } = await import('../shared/js/utils/storage.js');
const { restoreManager } = await import('./restore.js');

// Mock window.showDirectoryPicker and location.reload
// Note: jsdom's location.reload() logs a "Not implemented" console.error but does not throw.
// The restore.js code calls location.reload() after successful restore, which is fine in jsdom
// as it simply logs a warning. We suppress it here by replacing location with a plain object
// before importing restore.js would be ideal, but since the module is already loaded,
// we accept that the console.error will appear in test output (non-breaking behavior).
beforeEach(() => {
    globalThis.window.showDirectoryPicker = jest.fn();
    jest.clearAllMocks();
});

afterEach(() => {
    jest.clearAllMocks();
});

/**
 * Creates an async iterable from entries for `for await ... of` support.
 */
function createAsyncIterableDirHandle(files = {}, subdirs = {}) {
    return {
        getFileHandle: jest.fn(async (name) => {
            if (files[name] === undefined) {
                const err = new Error('NotFoundError');
                err.name = 'NotFoundError';
                throw err;
            }
            return {
                getFile: async () => ({
                    text: async () => files[name],
                    size: files[name].length,
                }),
            };
        }),
        getDirectoryHandle: jest.fn(async (name) => {
            if (!subdirs[name]) {
                const err = new Error('NotFoundError');
                err.name = 'NotFoundError';
                throw err;
            }
            return subdirs[name];
        }),
        values: jest.fn(function () {
            const entries = Object.entries(files).map(([name, content]) => ({
                kind: 'file',
                name,
                getFile: async () => ({ text: async () => content, size: content.length }),
            }));
            return {
                [Symbol.asyncIterator]() {
                    let i = 0;
                    return {
                        next() {
                            if (i < entries.length) {
                                return Promise.resolve({ value: entries[i++], done: false });
                            }
                            return Promise.resolve({ done: true });
                        },
                    };
                },
            };
        }),
    };
}

// Helpers for building valid backup files
function buildCategoriesNdjson(categories) {
    return categories.map((c) => JSON.stringify({ kind: 'QuickLogSolo/Category', version: '1.0', ...c })).join('\n');
}

function buildSettingsJson(entries) {
    return JSON.stringify({
        app: 'QuickLog-Solo',
        kind: 'QuickLogSolo/Settings',
        version: '2.0',
        entries,
    });
}

// ============================================================
// Unit Tests
// ============================================================

describe('RestoreManager - folder selection cancel', () => {
    it('returns null and does not change data when user cancels folder selection', async () => {
        const abortError = new Error('AbortError');
        abortError.name = 'AbortError';
        window.showDirectoryPicker.mockRejectedValue(abortError);

        const showConfirm = jest.fn();
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        expect(result).toBeNull();
        expect(dbClear).not.toHaveBeenCalled();
        expect(dbAddMultiple).not.toHaveBeenCalled();
        expect(dbPut).not.toHaveBeenCalled();
        expect(showConfirm).not.toHaveBeenCalled();
        expect(showToast).not.toHaveBeenCalled();
    });
});

describe('RestoreManager - required files missing', () => {
    it('shows error and returns null when both new and legacy category/settings files are missing', async () => {
        // Directory with no categories or settings files
        const dirHandle = createAsyncIterableDirHandle({});
        window.showDirectoryPicker.mockResolvedValue(dirHandle);

        const showConfirm = jest.fn();
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        expect(result).toBeNull();
        expect(showToast).toHaveBeenCalledWith('restore-error-invalid-folder', 'error');
        expect(dbClear).not.toHaveBeenCalled();
    });
});

describe('RestoreManager - ql_alarms.json missing (v1.x backup)', () => {
    it('continues without error when ql_alarms.json is absent', async () => {
        const categoriesContent = buildCategoriesNdjson([{ type: 'category', name: 'Dev', color: '#ff0000' }]);
        const settingsContent = buildSettingsJson([{ key: 'theme', value: 'dark' }]);

        const dirHandle = createAsyncIterableDirHandle({
            'ql_categories.ndjson': categoriesContent,
            'ql_settings.json': settingsContent,
        });
        window.showDirectoryPicker.mockResolvedValue(dirHandle);

        const showConfirm = jest.fn().mockResolvedValue(true);
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        // Should succeed — no error toast for missing alarms
        expect(result).toBe(dirHandle);
        expect(showToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
        // Verify alarms were not attempted to add since file is absent
        const addMultipleCalls = dbAddMultiple.mock.calls;
        const alarmsCalls = addMultipleCalls.filter(([store]) => store === 'alarms');
        expect(alarmsCalls).toHaveLength(0);
    });
});

describe('RestoreManager - legacy filename fallback', () => {
    it('reads categories.ndjson and settings.json when ql_ prefixed versions are missing', async () => {
        const categoriesContent = buildCategoriesNdjson([
            { type: 'category', name: 'Work', color: '#00ff00', tags: ['tag1'] },
        ]);
        const settingsContent = buildSettingsJson([{ key: 'theme', value: 'light' }]);

        // Using legacy names (no ql_ prefix)
        const dirHandle = createAsyncIterableDirHandle({
            'categories.ndjson': categoriesContent,
            'settings.json': settingsContent,
        });
        window.showDirectoryPicker.mockResolvedValue(dirHandle);

        const showConfirm = jest.fn().mockResolvedValue(true);
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        expect(result).toBe(dirHandle);
        // Categories should have been restored
        const categoryCalls = dbAddMultiple.mock.calls.filter(([store]) => store === 'categories');
        expect(categoryCalls.length).toBeGreaterThan(0);
        expect(categoryCalls[0][1][0].name).toBe('Work');
        expect(categoryCalls[0][1][0].color).toBe('#00ff00');
    });
});

describe('RestoreManager - invalid records skipped', () => {
    it('skips invalid records and shows skipped count in toast', async () => {
        const categoriesContent = [
            JSON.stringify({
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'category',
                name: 'Valid',
                color: '#aabbcc',
            }),
            'not valid json{{{',
            JSON.stringify({
                kind: 'QuickLogSolo/Category',
                version: '1.0',
                type: 'category',
                name: 'Also Valid',
                color: '#ddeeff',
            }),
        ].join('\n');
        const settingsContent = buildSettingsJson([{ key: 'theme', value: 'dark' }]);

        const dirHandle = createAsyncIterableDirHandle({
            'ql_categories.ndjson': categoriesContent,
            'ql_settings.json': settingsContent,
        });
        window.showDirectoryPicker.mockResolvedValue(dirHandle);

        const showConfirm = jest.fn().mockResolvedValue(true);
        const showToast = jest.fn();
        const t = jest.fn((key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key));

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        expect(result).toBe(dirHandle);
        // The toast should show skipped records (1 invalid JSON line)
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('restore-skipped-records'), 'warning');
    });
});

describe('RestoreManager - IndexedDB write failure', () => {
    it('shows error and returns null when dbClear or dbAddMultiple throws', async () => {
        const categoriesContent = buildCategoriesNdjson([{ type: 'category', name: 'Dev', color: '#ff0000' }]);
        const settingsContent = buildSettingsJson([{ key: 'theme', value: 'dark' }]);

        const dirHandle = createAsyncIterableDirHandle({
            'ql_categories.ndjson': categoriesContent,
            'ql_settings.json': settingsContent,
        });
        window.showDirectoryPicker.mockResolvedValue(dirHandle);

        // Simulate IndexedDB write failure
        dbClear.mockRejectedValue(new Error('IndexedDB write error'));

        const showConfirm = jest.fn().mockResolvedValue(true);
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        expect(result).toBeNull();
        expect(showToast).toHaveBeenCalledWith('restore-error-write-failed', 'error');
    });
});

describe('RestoreManager - confirmation dialog cancel', () => {
    it('returns null and does not change data when user cancels confirmation', async () => {
        const categoriesContent = buildCategoriesNdjson([{ type: 'category', name: 'Dev', color: '#ff0000' }]);
        const settingsContent = buildSettingsJson([{ key: 'theme', value: 'dark' }]);

        const dirHandle = createAsyncIterableDirHandle({
            'ql_categories.ndjson': categoriesContent,
            'ql_settings.json': settingsContent,
        });
        window.showDirectoryPicker.mockResolvedValue(dirHandle);

        const showConfirm = jest.fn().mockResolvedValue(false);
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        expect(result).toBeNull();
        expect(dbClear).not.toHaveBeenCalled();
        expect(dbAddMultiple).not.toHaveBeenCalled();
    });
});

// ============================================================
// Property 5: バックアップ・リストア round-trip
// Validates: Requirements 3.2, 3.4, 3.9, 3.10, 3.11, 2.5, 7.3, 7.4
//
// For any valid dataset, backup then restore produces equivalent DB content.
// We simulate the backup output format and verify that restoreManager
// writes back equivalent records to IndexedDB.
// ============================================================

describe('Property 5: バックアップ・リストア round-trip', () => {
    // Arbitrary generators for valid backup data
    const categoryArb = fc.record({
        type: fc.constant('category'),
        name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0 && !s.includes('\n')),
        color: fc
            .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
            .map(
                ([r, g, b]) =>
                    `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
            ),
        tags: fc.array(
            fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes('\n')),
            { minLength: 0, maxLength: 3 }
        ),
        animation: fc.constantFrom('default', 'wave', 'pulse'),
    });

    const settingsEntryArb = fc.record({
        key: fc.constantFrom('theme', 'language', 'animation', 'fontSize'),
        value: fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.integer({ min: 1, max: 100 })),
    });

    const alarmEntryArb = fc.record({
        enabled: fc.boolean(),
        time: fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 })).map(([h, m]) => {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }),
        message: fc.string({ minLength: 0, maxLength: 50 }),
        action: fc.constantFrom('none', 'stop', 'pause', 'start'),
        actionCategory: fc.string({ minLength: 0, maxLength: 30 }),
        requireConfirmation: fc.boolean(),
        type: fc.constantFrom('daily_business', 'weekly', 'monthly_date', 'monthly_end_relative'),
        daysOfWeek: fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 0, maxLength: 7 }),
        dayOfMonth: fc.integer({ min: 1, max: 31 }),
        daysBeforeEnd: fc.integer({ min: 0, max: 31 }),
        holidayAdjustment: fc.constantFrom('none', 'prev_business_day', 'next_business_day', 'skip'),
        order: fc.integer({ min: 0, max: 100 }),
    });

    fcTest.prop([
        fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
        fc.array(settingsEntryArb, { minLength: 1, maxLength: 3 }),
        fc.array(alarmEntryArb, { minLength: 0, maxLength: 3 }),
    ])('restore produces DB content equivalent to backup data', async (categories, settingsEntries, alarmEntries) => {
        jest.clearAllMocks();

        // Reset mocks to allow successful operations
        dbClear.mockResolvedValue(undefined);
        dbAddMultiple.mockResolvedValue(undefined);
        dbPut.mockResolvedValue(undefined);
        validateCategorySchema.mockReturnValue(true);
        validateSettingsSchema.mockReturnValue(true);
        validateAlarmSchema.mockReturnValue(true);
        validateHistorySchema.mockReturnValue(true);
        validateCustomAnimationSchema.mockReturnValue(true);
        setCustomAnimationMetadataMap.mockResolvedValue(undefined);

        // Build backup files from the generated data
        const categoriesNdjson = categories
            .map((c) => JSON.stringify({ kind: 'QuickLogSolo/Category', version: '1.0', ...c }))
            .join('\n');

        const settingsJson = JSON.stringify({
            app: 'QuickLog-Solo',
            kind: 'QuickLogSolo/Settings',
            version: '2.0',
            entries: settingsEntries,
        });

        const alarmsJson = JSON.stringify({
            app: 'QuickLog-Solo',
            kind: 'QuickLogSolo/Alarm',
            version: '2.0',
            entries: alarmEntries,
        });

        const dirFiles = {
            'ql_categories.ndjson': categoriesNdjson,
            'ql_settings.json': settingsJson,
            'ql_alarms.json': alarmsJson,
        };

        const dirHandle = createAsyncIterableDirHandle(dirFiles);
        window.showDirectoryPicker.mockResolvedValue(dirHandle);

        const showConfirm = jest.fn().mockResolvedValue(true);
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        expect(result).toBe(dirHandle);

        // Verify categories were restored
        const categoryCalls = dbAddMultiple.mock.calls.filter(([store]) => store === 'categories');
        if (categories.length > 0) {
            expect(categoryCalls.length).toBeGreaterThan(0);
            const restoredCategories = categoryCalls[0][1];
            expect(restoredCategories).toHaveLength(categories.length);
            for (let i = 0; i < categories.length; i++) {
                expect(restoredCategories[i].name).toBe(categories[i].name.trim());
                expect(restoredCategories[i].color).toBe(categories[i].color);
            }
        }

        // Verify settings were restored
        const settingsCalls = dbPut.mock.calls.filter(([store]) => store === 'settings');
        expect(settingsCalls).toHaveLength(settingsEntries.length);

        // Verify alarms were restored (if any)
        if (alarmEntries.length > 0) {
            const alarmCalls = dbAddMultiple.mock.calls.filter(([store]) => store === 'alarms');
            expect(alarmCalls.length).toBeGreaterThan(0);
            const restoredAlarms = alarmCalls[0][1];
            expect(restoredAlarms).toHaveLength(alarmEntries.length);
            for (let i = 0; i < alarmEntries.length; i++) {
                expect(restoredAlarms[i].enabled).toBe(alarmEntries[i].enabled);
                expect(restoredAlarms[i].time).toBe(alarmEntries[i].time);
                expect(restoredAlarms[i].action).toBe(alarmEntries[i].action);
            }
        }
    });
});
