import { jest } from '@jest/globals';
import { fc, test as fcTest } from '@fast-check/jest';

// Mock dependencies using the same import paths as backup.js
jest.unstable_mockModule('../shared/js/db.js', () => ({
    dbGetAll: jest.fn(),
    dbGet: jest.fn(),
    dbPut: jest.fn(),
    dbAddMultiple: jest.fn(),
    STORE_LOGS: 'logs',
    STORE_CATEGORIES: 'categories',
    STORE_SETTINGS: 'settings',
    STORE_ALARMS: 'alarms',
    SETTING_KEY_ANIMATION: 'animation',
    SETTING_KEY_BACKUP_CONFIG: 'backupConfig',
    SETTING_KEY_BACKUP_DIR_HANDLE: 'backupDirectoryHandle',
    LOG_CLEANUP_THRESHOLD_MS: 40 * 86400000,
}));

jest.unstable_mockModule('../shared/js/utils.js', () => ({
    SYSTEM_CATEGORY_PAGE_BREAK: '__PAGE_BREAK__',
    SYSTEM_CATEGORY_IDLE: '__IDLE__',
}));

jest.unstable_mockModule('../shared/js/schema.js', () => ({
    SCHEMA_VERSION_1_0: '1.0',
    SCHEMA_VERSION_2_0: '2.0',
    SCHEMA_KIND_CATEGORY: 'QuickLogSolo/Category',
    SCHEMA_KIND_HISTORY: 'QuickLogSolo/History',
    SCHEMA_KIND_SETTINGS: 'QuickLogSolo/Settings',
    SCHEMA_KIND_ALARM: 'QuickLogSolo/Alarm',
    SCHEMA_KIND_CUSTOM_ANIMATION: 'QuickLogSolo/CustomAnimation',
    SCHEMA_TYPE_CATEGORY: 'category',
    SCHEMA_TYPE_PAGE_BREAK: 'page-break',
    SCHEMA_TYPE_HISTORY_TASK: 'task',
    SCHEMA_TYPE_HISTORY_IDLE: 'idle',
    SCHEMA_TYPE_HISTORY_STOP: 'stop',
    validateCategorySchema: jest.fn(() => true),
    validateHistorySchema: jest.fn(() => true),
    validateSettingsSchema: jest.fn(() => true),
}));

jest.unstable_mockModule('../shared/js/idb_storage.js', () => ({
    getAnimationBlob: jest.fn(),
}));

jest.unstable_mockModule('../shared/js/utils/storage.js', () => ({
    getCustomAnimationMetadataMap: jest.fn(),
}));

// Import mocked modules
const { dbGetAll, dbGet, dbPut } = await import('../shared/js/db.js');
const { getAnimationBlob } = await import('../shared/js/idb_storage.js');
const { getCustomAnimationMetadataMap } = await import('../shared/js/utils/storage.js');
const { backupManager, BACKUP_STATUS } = await import('./backup.js');

// Helper: creates a mock directory handle with File System Access API
function createMockDirectoryHandle() {
    const files = {};
    const dirs = {};

    const createMockFileHandle = (fileName) => ({
        getFile: jest.fn(async () => ({
            text: async () => files[fileName] || '',
            size: (files[fileName] || '').length,
        })),
        createWritable: jest.fn(async () => ({
            write: jest.fn(async (data) => {
                files[fileName] = data;
            }),
            close: jest.fn(async () => {}),
        })),
    });

    const handle = {
        getFileHandle: jest.fn(async (name) => createMockFileHandle(name)),
        getDirectoryHandle: jest.fn(async (name) => {
            if (!dirs[name]) {
                dirs[name] = createMockDirectoryHandle();
            }
            return dirs[name];
        }),
        queryPermission: jest.fn(async () => 'granted'),
        requestPermission: jest.fn(async () => 'granted'),
        values: jest.fn(function () {
            return [][Symbol.iterator]();
        }),
        _files: files,
        _dirs: dirs,
    };

    return handle;
}

describe('BackupManager - _backupAlarms()', () => {
    let mockDirHandle;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDirHandle = createMockDirectoryHandle();
        backupManager.directoryHandle = mockDirHandle;
        backupManager.status = BACKUP_STATUS.SUCCESS;
        backupManager.onStatusChange = null;
    });

    it('writes ql_alarms.json with correct format when alarms exist', async () => {
        const mockAlarms = [
            {
                enabled: true,
                time: '09:00',
                message: 'Start work',
                action: 'start',
                actionCategory: 'Dev',
                requireConfirmation: false,
                type: 'daily_business',
                daysOfWeek: [1, 2, 3, 4, 5],
                dayOfMonth: 1,
                daysBeforeEnd: 0,
                holidayAdjustment: 'none',
                order: 0,
            },
            {
                enabled: false,
                time: '18:00',
                message: 'End work',
                action: 'stop',
                actionCategory: '',
                requireConfirmation: true,
                type: 'weekly',
                daysOfWeek: [1, 2, 3, 4, 5],
                dayOfMonth: 15,
                daysBeforeEnd: 3,
                holidayAdjustment: 'skip',
                order: 1,
            },
        ];
        dbGetAll.mockResolvedValue(mockAlarms);

        await backupManager._backupAlarms();

        expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('ql_alarms.json', { create: true });

        const writtenContent = mockDirHandle._files['ql_alarms.json'];
        const parsed = JSON.parse(writtenContent);

        expect(parsed.app).toBe('QuickLog-Solo');
        expect(parsed.kind).toBe('QuickLogSolo/Alarm');
        expect(parsed.version).toBe('2.0');
        expect(parsed.entries).toHaveLength(2);
        expect(parsed.entries[0].enabled).toBe(true);
        expect(parsed.entries[0].time).toBe('09:00');
        expect(parsed.entries[0].message).toBe('Start work');
        expect(parsed.entries[1].enabled).toBe(false);
        expect(parsed.entries[1].action).toBe('stop');
    });

    it('sets status to FAILED when STORE_ALARMS read fails', async () => {
        dbGetAll.mockRejectedValue(new Error('DB read error'));
        const onStatusChange = jest.fn();
        backupManager.onStatusChange = onStatusChange;

        await expect(backupManager._backupAlarms()).rejects.toThrow('DB read error');

        expect(backupManager.status).toBe(BACKUP_STATUS.FAILED);
        expect(onStatusChange).toHaveBeenCalledWith(BACKUP_STATUS.FAILED);
    });
});

describe('BackupManager - _backupCustomAnimations()', () => {
    let mockDirHandle;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDirHandle = createMockDirectoryHandle();
        backupManager.directoryHandle = mockDirHandle;
        backupManager.status = BACKUP_STATUS.SUCCESS;
        backupManager.onStatusChange = null;
    });

    it('writes ql_custom_animations.json with empty entries when no custom animations exist', async () => {
        getCustomAnimationMetadataMap.mockResolvedValue({});

        await backupManager._backupCustomAnimations();

        expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('ql_custom_animations.json', { create: true });

        const writtenContent = mockDirHandle._files['ql_custom_animations.json'];
        const parsed = JSON.parse(writtenContent);

        expect(parsed.app).toBe('QuickLog-Solo');
        expect(parsed.kind).toBe('QuickLogSolo/CustomAnimation');
        expect(parsed.version).toBe('2.0');
        expect(parsed.entries).toEqual([]);
    });

    it('writes metadata entries when animations exist', async () => {
        const metadataMap = {
            'anim-uuid-1': {
                name: 'Wave Effect',
                description: 'Cool wave',
                config: { exclusionStrategy: 'freedom' },
                renderSpec: { type: 'gif', fps: 30 },
                createdAt: 1700000000000,
            },
        };
        getCustomAnimationMetadataMap.mockResolvedValue(metadataMap);
        getAnimationBlob.mockResolvedValue(new Blob(['fake gif data']));

        await backupManager._backupCustomAnimations();

        const writtenContent = mockDirHandle._files['ql_custom_animations.json'];
        const parsed = JSON.parse(writtenContent);

        expect(parsed.entries).toHaveLength(1);
        expect(parsed.entries[0].id).toBe('anim-uuid-1');
        expect(parsed.entries[0].name).toBe('Wave Effect');
        expect(parsed.entries[0].description).toBe('Cool wave');
    });

    it('sets status to FAILED when getAnimationBlob throws', async () => {
        const metadataMap = {
            'anim-uuid-1': { name: 'Wave', description: '', config: {}, renderSpec: {}, createdAt: null },
        };
        getCustomAnimationMetadataMap.mockResolvedValue(metadataMap);
        getAnimationBlob.mockRejectedValue(new Error('Blob read error'));

        const onStatusChange = jest.fn();
        backupManager.onStatusChange = onStatusChange;

        await expect(backupManager._backupCustomAnimations()).rejects.toThrow('Blob read error');

        expect(backupManager.status).toBe(BACKUP_STATUS.FAILED);
        expect(onStatusChange).toHaveBeenCalledWith(BACKUP_STATUS.FAILED);
    });
});

describe('BackupManager - sync() lastBackupTime', () => {
    let mockDirHandle;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDirHandle = createMockDirectoryHandle();
        backupManager.directoryHandle = mockDirHandle;
        backupManager.isSyncing = false;
        backupManager.config = { lastBackupTime: null };
        backupManager.onStatusChange = null;
    });

    it('updates lastBackupTime only after all writes complete successfully', async () => {
        dbGetAll.mockResolvedValue([]);
        dbGet.mockResolvedValue(null);
        dbPut.mockResolvedValue(undefined);
        getCustomAnimationMetadataMap.mockResolvedValue({});

        expect(backupManager.config.lastBackupTime).toBeNull();

        await backupManager.sync();

        expect(backupManager.config.lastBackupTime).not.toBeNull();
        expect(typeof backupManager.config.lastBackupTime).toBe('number');
        expect(backupManager.status).toBe(BACKUP_STATUS.SUCCESS);
    });

    it('does NOT update lastBackupTime when backup fails', async () => {
        dbGetAll.mockImplementation(async (store) => {
            if (store === 'alarms') throw new Error('alarms read error');
            return [];
        });
        dbGet.mockResolvedValue(null);
        getCustomAnimationMetadataMap.mockResolvedValue({});

        backupManager.config.lastBackupTime = null;

        await backupManager.sync();

        expect(backupManager.config.lastBackupTime).toBeNull();
        expect(backupManager.status).toBe(BACKUP_STATUS.FAILED);
    });
});

/**
 * Property 1: バックアップのアラームデータ整合性
 * Validates: Requirements 1.1, 2.1
 *
 * 任意のアラーム配列に対して _backupAlarms() を実行すると、
 * 生成された ql_alarms.json の entries が入力のアラーム配列と等しく、
 * version が '2.0' であり、kind が 'QuickLogSolo/Alarm' である。
 */
describe('Property 1: バックアップのアラームデータ整合性', () => {
    const alarmArb = fc.record({
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

    fcTest.prop([fc.array(alarmArb, { minLength: 0, maxLength: 10 })])(
        'ql_alarms.json entries match input alarms with correct kind and version',
        async (alarms) => {
            jest.clearAllMocks();
            const mockDirHandle = createMockDirectoryHandle();
            backupManager.directoryHandle = mockDirHandle;
            backupManager.status = BACKUP_STATUS.SUCCESS;
            backupManager.onStatusChange = null;

            dbGetAll.mockResolvedValue(alarms);

            await backupManager._backupAlarms();

            const writtenContent = mockDirHandle._files['ql_alarms.json'];
            const parsed = JSON.parse(writtenContent);

            expect(parsed.kind).toBe('QuickLogSolo/Alarm');
            expect(parsed.version).toBe('2.0');
            expect(parsed.app).toBe('QuickLog-Solo');
            expect(parsed.entries).toHaveLength(alarms.length);

            for (let i = 0; i < alarms.length; i++) {
                expect(parsed.entries[i].enabled).toBe(alarms[i].enabled);
                expect(parsed.entries[i].time).toBe(alarms[i].time);
                expect(parsed.entries[i].message).toBe(alarms[i].message);
                expect(parsed.entries[i].action).toBe(alarms[i].action);
                expect(parsed.entries[i].actionCategory).toBe(alarms[i].actionCategory);
                expect(parsed.entries[i].requireConfirmation).toBe(alarms[i].requireConfirmation);
                expect(parsed.entries[i].type).toBe(alarms[i].type);
                expect(parsed.entries[i].daysOfWeek).toEqual(alarms[i].daysOfWeek);
                expect(parsed.entries[i].dayOfMonth).toBe(alarms[i].dayOfMonth);
                expect(parsed.entries[i].daysBeforeEnd).toBe(alarms[i].daysBeforeEnd);
                expect(parsed.entries[i].holidayAdjustment).toBe(alarms[i].holidayAdjustment);
                expect(parsed.entries[i].order).toBe(alarms[i].order);
            }
        }
    );
});

/**
 * Property 2: バックアップのカスタムアニメーションメタデータ整合性
 * Validates: Requirements 1.2, 2.1
 *
 * 任意のカスタムアニメーションメタデータマップに対して _backupCustomAnimations() を実行すると、
 * 生成された ql_custom_animations.json の entries がメタデータマップの全エントリーを含み、
 * version が '2.0' であり、kind が 'QuickLogSolo/CustomAnimation' である。
 */
describe('Property 2: バックアップのカスタムアニメーションメタデータ整合性', () => {
    const metadataEntryArb = fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        description: fc.string({ minLength: 0, maxLength: 100 }),
        config: fc.constant({}),
        renderSpec: fc.constant({}),
        createdAt: fc.oneof(fc.constant(null), fc.integer({ min: 1000000000000, max: 2000000000000 })),
    });

    const metadataMapArb = fc
        .array(fc.tuple(fc.uuid(), metadataEntryArb), { minLength: 0, maxLength: 5 })
        .map((pairs) => Object.fromEntries(pairs));

    fcTest.prop([metadataMapArb])(
        'ql_custom_animations.json entries match metadata map with correct kind and version',
        async (metadataMap) => {
            jest.clearAllMocks();
            const mockDirHandle = createMockDirectoryHandle();
            backupManager.directoryHandle = mockDirHandle;
            backupManager.status = BACKUP_STATUS.SUCCESS;
            backupManager.onStatusChange = null;

            getCustomAnimationMetadataMap.mockResolvedValue(metadataMap);
            getAnimationBlob.mockResolvedValue(null);

            await backupManager._backupCustomAnimations();

            const writtenContent = mockDirHandle._files['ql_custom_animations.json'];
            const parsed = JSON.parse(writtenContent);

            expect(parsed.kind).toBe('QuickLogSolo/CustomAnimation');
            expect(parsed.version).toBe('2.0');
            expect(parsed.app).toBe('QuickLog-Solo');

            const expectedEntries = Object.entries(metadataMap);
            expect(parsed.entries).toHaveLength(expectedEntries.length);

            for (const [id, meta] of expectedEntries) {
                const entry = parsed.entries.find((e) => e.id === id);
                expect(entry).toBeDefined();
                expect(entry.name).toBe(meta.name);
                expect(entry.description).toBe(meta.description || '');
                expect(entry.config).toEqual(meta.config || {});
                expect(entry.renderSpec).toEqual(meta.renderSpec || {});
                expect(entry.createdAt).toBe(meta.createdAt || null);
            }
        }
    );
});

/**
 * Property 3: バックアップの冪等性
 * Validates: Requirements 1.5
 *
 * 任意の有効なデータセットに対して、バックアップを1回実行した後のファイル内容と
 * 2回実行した後のファイル内容が等しい。
 */
describe('Property 3: バックアップの冪等性', () => {
    const alarmArb = fc.record({
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

    fcTest.prop([fc.array(alarmArb, { minLength: 0, maxLength: 5 })])(
        'running _backupAlarms twice produces identical file content',
        async (alarms) => {
            jest.clearAllMocks();

            // First run
            const dirHandle1 = createMockDirectoryHandle();
            backupManager.directoryHandle = dirHandle1;
            backupManager.status = BACKUP_STATUS.SUCCESS;
            backupManager.onStatusChange = null;
            dbGetAll.mockResolvedValue(alarms);

            await backupManager._backupAlarms();
            const content1 = dirHandle1._files['ql_alarms.json'];

            // Second run (same data)
            const dirHandle2 = createMockDirectoryHandle();
            backupManager.directoryHandle = dirHandle2;
            dbGetAll.mockResolvedValue(alarms);

            await backupManager._backupAlarms();
            const content2 = dirHandle2._files['ql_alarms.json'];

            expect(content1).toBe(content2);
        }
    );
});
