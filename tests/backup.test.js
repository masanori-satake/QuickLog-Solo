import { jest } from '@jest/globals';

jest.unstable_mockModule('../shared/js/db.js', () => ({
    dbGet: jest.fn(),
    dbPut: jest.fn(),
    dbGetAll: jest.fn(),
    dbAddMultiple: jest.fn(),
    STORE_LOGS: 'logs',
    STORE_SETTINGS: 'settings',
    STORE_CATEGORIES: 'categories',
    SETTING_KEY_ANIMATION: 'animation',
    SETTING_KEY_BACKUP_CONFIG: 'backupConfig',
    SETTING_KEY_BACKUP_DIR_HANDLE: 'backupDirectoryHandle'
}));

const { backupManager, BACKUP_STATUS } = await import('../projects/app/js/backup.js');
const db = await import('../shared/js/db.js');

describe('BackupManager', () => {
    beforeEach(() => {
        // Reset backupManager state
        backupManager.status = BACKUP_STATUS.DISABLED;
        backupManager.config = { lastBackupTime: null };
        backupManager.directoryHandle = null;
        backupManager.onStatusChange = null;

        jest.clearAllMocks();
    });

    test('init restores handle and checks permission', async () => {
        const mockHandle = { queryPermission: jest.fn().mockResolvedValue('prompt') };
        db.dbGet.mockImplementation((store, key) => {
            if (key === db.SETTING_KEY_BACKUP_CONFIG) return Promise.resolve({ value: { lastBackupTime: '2025-01-01' } });
            if (key === db.SETTING_KEY_BACKUP_DIR_HANDLE) return Promise.resolve({ value: mockHandle });
            return Promise.resolve(null);
        });

        await backupManager.init();

        expect(backupManager.directoryHandle).toBe(mockHandle);
        expect(backupManager.status).toBe(BACKUP_STATUS.FAILED);
    });

    test('hasPermission returns true only when granted', async () => {
        backupManager.directoryHandle = null;
        expect(await backupManager.hasPermission()).toBe(false);

        backupManager.directoryHandle = { queryPermission: jest.fn().mockResolvedValue('prompt') };
        expect(await backupManager.hasPermission()).toBe(false);

        backupManager.directoryHandle = { queryPermission: jest.fn().mockResolvedValue('granted') };
        expect(await backupManager.hasPermission()).toBe(true);
    });

    test('sync performs backup and updates lastBackupTime', async () => {
        const mockFile = { size: 100, text: jest.fn().mockResolvedValue('[]') };
        const mockWritable = {
            write: jest.fn(),
            close: jest.fn()
        };
        const mockFileHandle = {
            getFile: jest.fn().mockResolvedValue(mockFile),
            createWritable: jest.fn().mockResolvedValue(mockWritable)
        };
        backupManager.directoryHandle = {
            values: async function* () { yield* []; },
            getFileHandle: jest.fn().mockResolvedValue(mockFileHandle),
            queryPermission: jest.fn().mockResolvedValue('granted')
        };
        db.dbGetAll.mockResolvedValue([]);
        db.dbPut.mockResolvedValue(true);

        await backupManager.sync();

        expect(backupManager.status).toBe(BACKUP_STATUS.SUCCESS);
        expect(backupManager.config.lastBackupTime).toBeDefined();
        expect(db.dbPut).toHaveBeenCalledWith(db.STORE_SETTINGS, expect.objectContaining({ key: db.SETTING_KEY_BACKUP_CONFIG }));
    });

    test('sync handles missing permission', async () => {
        backupManager.directoryHandle = {
            queryPermission: jest.fn().mockResolvedValue('prompt')
        };

        await backupManager.sync();

        expect(backupManager.status).toBe(BACKUP_STATUS.FAILED);
    });
});
