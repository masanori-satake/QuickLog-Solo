import { jest } from '@jest/globals';

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
    generateUUID: () => 'mocked-uuid',
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

describe('Property 5: バックアップ・リストア round-trip (Deterministic)', () => {
    test('restore produces DB content equivalent to backup data', async () => {
        const testCases = [
            {
                categories: [
                    { type: 'category', name: 'Work', color: '#ff0000', tags: ['work', 'dev'], animation: 'wave' },
                    { type: 'category', name: 'Meeting', color: '#00ff00', tags: [], animation: 'pulse' },
                ],
                settingsEntries: [
                    { key: 'theme', value: 'dark' },
                    { key: 'language', value: 'ja' },
                ],
                alarmEntries: [
                    {
                        enabled: true,
                        time: '10:00',
                        message: 'Sync meeting',
                        action: 'start',
                        actionCategory: 'Meeting',
                        requireConfirmation: true,
                        type: 'weekly',
                        daysOfWeek: [1],
                        dayOfMonth: 1,
                        daysBeforeEnd: 0,
                        holidayAdjustment: 'skip',
                        order: 5,
                    },
                ],
            },
            {
                categories: [
                    { type: 'category', name: 'Break', color: '#0000ff', tags: ['break'], animation: 'default' },
                ],
                settingsEntries: [{ key: 'fontSize', value: 14 }],
                alarmEntries: [],
            },
        ];

        for (const { categories, settingsEntries, alarmEntries } of testCases) {
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
        }
    });
});

describe('RestoreManager - custom animations and configured directory handles', () => {
    it('correctly restores custom animations with nested payload.renderSpec metadata', async () => {
        const categoriesContent = buildCategoriesNdjson([]);
        const settingsContent = buildSettingsJson([]);
        const customAnimationsJson = JSON.stringify({
            app: 'QuickLog-Solo',
            kind: 'QuickLogSolo/CustomAnimation',
            version: '2.0',
            entries: [
                {
                    id: '3e5812cb-282c-473d-8d4b-e7b8f9e2b10a',
                    name: 'Test Anim',
                    description: 'Test description',
                    config: { exclusionStrategy: 'freedom' },
                    renderSpec: { scaleWithHeight: true, targetHeight: 50 },
                    createdAt: 1700000000000,
                },
            ],
        });

        const mockAnimFile = {
            getFile: async () => new Blob(['fake gif content']),
        };
        const mockAnimDir = {
            getFileHandle: jest.fn().mockResolvedValue(mockAnimFile),
        };

        const dirHandle = createAsyncIterableDirHandle(
            {
                'ql_categories.ndjson': categoriesContent,
                'ql_settings.json': settingsContent,
                'ql_custom_animations.json': customAnimationsJson,
            },
            {
                animations: mockAnimDir,
            }
        );

        window.showDirectoryPicker.mockResolvedValue(dirHandle);

        const showConfirm = jest.fn().mockResolvedValue(true);
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t);

        expect(result).toBe(dirHandle);

        // Verify saveAnimationBlob was called with correct renderSpec
        expect(saveAnimationBlob).toHaveBeenCalledWith(
            '3e5812cb-282c-473d-8d4b-e7b8f9e2b10a',
            expect.any(Blob),
            { scaleWithHeight: true, targetHeight: 50 },
            { exclusionStrategy: 'freedom' }
        );

        // Verify setCustomAnimationMetadataMap was called with nested payload structure
        expect(setCustomAnimationMetadataMap).toHaveBeenCalledWith({
            '3e5812cb-282c-473d-8d4b-e7b8f9e2b10a': {
                name: 'Test Anim',
                description: 'Test description',
                config: { exclusionStrategy: 'freedom' },
                renderSpec: { scaleWithHeight: true, targetHeight: 50 },
                payload: {
                    renderSpec: { scaleWithHeight: true, targetHeight: 50 },
                },
                createdAt: 1700000000000,
            },
        });
    });

    it('bypasses window.showDirectoryPicker if existingDirHandle is passed', async () => {
        const categoriesContent = buildCategoriesNdjson([]);
        const settingsContent = buildSettingsJson([]);

        const dirHandle = createAsyncIterableDirHandle({
            'ql_categories.ndjson': categoriesContent,
            'ql_settings.json': settingsContent,
        });

        const showConfirm = jest.fn().mockResolvedValue(true);
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t, dirHandle);

        // Check picker was NOT called
        expect(window.showDirectoryPicker).not.toHaveBeenCalled();
        expect(result).toBe(dirHandle);
    });

    it('generates missing syncId and updatedAt properties for restored logs', async () => {
        const categoriesContent = buildCategoriesNdjson([]);
        const settingsContent = buildSettingsJson([]);
        // Ndjson with a history task log missing syncId and updatedAt
        const logContent = JSON.stringify({
            kind: 'QuickLogSolo/History',
            version: '1.0',
            type: 'task',
            startTime: 1700000000000,
            endTime: 1700000060000,
            category: 'Dev',
            color: 'primary',
            tags: ['tag1'],
            memo: 'some memo'
        });

        const dirHandle = createAsyncIterableDirHandle({
            'ql_categories.ndjson': categoriesContent,
            'ql_settings.json': settingsContent,
            '2023-11-14.ndjson': logContent
        });

        const showConfirm = jest.fn().mockResolvedValue(true);
        const showToast = jest.fn();
        const t = jest.fn((key) => key);

        const result = await restoreManager.restoreFromDirectory(showConfirm, showToast, t, dirHandle);

        expect(result).toBe(dirHandle);

        const logCalls = dbAddMultiple.mock.calls.filter(([store]) => store === 'logs');
        expect(logCalls.length).toBeGreaterThan(0);
        const restoredLogs = logCalls[0][1];
        expect(restoredLogs).toHaveLength(1);
        expect(restoredLogs[0].syncId).toBeDefined();
        expect(typeof restoredLogs[0].syncId).toBe('string');
        expect(restoredLogs[0].updatedAt).toBeDefined();
        expect(typeof restoredLogs[0].updatedAt).toBe('number');
        expect(restoredLogs[0].category).toBe('Dev');
    });
});
