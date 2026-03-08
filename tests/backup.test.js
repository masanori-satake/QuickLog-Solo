import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/js/db.js', () => ({
    dbGet: jest.fn(),
    dbPut: jest.fn(),
    dbGetAll: jest.fn(),
    dbAddMultiple: jest.fn(),
    STORE_LOGS: 'logs',
    STORE_SETTINGS: 'settings',
    STORE_CATEGORIES: 'categories'
}));

const { backupManager, BACKUP_STATUS } = await import('../src/js/backup.js');
const db = await import('../src/js/db.js');

describe('BackupManager', () => {
    beforeEach(() => {
        // Reset backupManager state
        backupManager.status = BACKUP_STATUS.DISABLED;
        backupManager.config = { enabled: false, interval: '5m', lastBackupTime: null };
        backupManager.directoryHandle = null;
        backupManager.isDirty = false;
        backupManager.onStatusChange = null;
        if (backupManager._dirtyCheckInterval) {
            clearInterval(backupManager._dirtyCheckInterval);
            backupManager._dirtyCheckInterval = null;
        }

        jest.clearAllMocks();
    });

    test('init sets status correctly when disabled', async () => {
        db.dbGet.mockResolvedValue({ value: { enabled: false } });
        await backupManager.init();
        expect(backupManager.status).toBe(BACKUP_STATUS.DISABLED);
    });

    test('init sets status to SUCCESS when enabled and handle is restored', async () => {
        db.dbGet.mockImplementation((store, key) => {
            if (key === 'backupConfig') return Promise.resolve({ value: { enabled: true } });
            if (key === 'backupDirectoryHandle') return Promise.resolve({ value: { queryPermission: jest.fn().mockResolvedValue('granted') } });
            return Promise.resolve(null);
        });
        await backupManager.init();
        expect(backupManager.status).toBe(BACKUP_STATUS.SUCCESS);
    });

    test('requestImmediateBackup sets dirty state', () => {
        backupManager.config.enabled = true;
        backupManager.requestImmediateBackup();
        expect(backupManager.isDirty).toBe(true);
    });

    test('dirty state transitions to DIRTY status after 2 seconds', (done) => {
        backupManager.status = BACKUP_STATUS.SUCCESS;
        backupManager.config.enabled = true;
        backupManager.isDirty = true;
        backupManager.dirtyStartTime = Date.now() - 2100;

        backupManager.onStatusChange = (status) => {
            if (status === BACKUP_STATUS.DIRTY) {
                expect(backupManager.status).toBe(BACKUP_STATUS.DIRTY);
                done();
            }
        };

        backupManager._startDirtyMonitor();
    }, 10000);

    test('sync clears dirty state', async () => {
        const mockFileHandle = {
            getFile: jest.fn().mockImplementation(() => {
                const error = new Error('File not found');
                error.name = 'NotFoundError';
                return Promise.reject(error);
            }),
            createWritable: jest.fn().mockResolvedValue({
                write: jest.fn(),
                close: jest.fn()
            })
        };
        backupManager.directoryHandle = {
            values: async function* () { yield* []; },
            getFileHandle: jest.fn().mockResolvedValue(mockFileHandle)
        };
        db.dbGetAll.mockResolvedValue([]);
        backupManager.config.enabled = true;
        backupManager.isDirty = true;
        await backupManager.sync();
        expect(backupManager.isDirty).toBe(false);
        expect(backupManager.status).toBe(BACKUP_STATUS.SUCCESS);
    });
});
