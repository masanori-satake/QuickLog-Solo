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

describe('BackupManager Abnormal Cases', () => {
    let mockDirectoryHandle;

    beforeEach(() => {
        // Reset backupManager state
        backupManager.status = BACKUP_STATUS.DISABLED;
        backupManager.config = { enabled: false, interval: '5m', lastBackupTime: null };
        backupManager.directoryHandle = null;
        backupManager.isDirty = false;
        backupManager.onStatusChange = null;
        backupManager.onConfirm = null;
        backupManager.lastError = null;

        mockDirectoryHandle = {
            values: jest.fn(),
            getFileHandle: jest.fn(),
            removeEntry: jest.fn()
        };

        jest.clearAllMocks();
    });

    test('sync sets status to FAILED and records lastError when directory is not readable', async () => {
        const error = new Error('Locked');
        error.name = 'NotReadableError';

        // Mock getFileHandle to avoid restoreFromFiles failing before it gets to values()
        mockDirectoryHandle.getFileHandle.mockImplementation(() => { throw error; });

        backupManager.directoryHandle = mockDirectoryHandle;
        backupManager.config.enabled = true;

        await backupManager.sync();

        expect(backupManager.status).toBe(BACKUP_STATUS.FAILED);
        expect(backupManager.lastError.key).toBe('backup-err-locked');
    });

    test('readNdjson throws ABORT_BY_USER when 0-byte file is found and user cancels', async () => {
        const mockFile = { size: 0 };
        const mockFileHandle = { getFile: jest.fn().mockResolvedValue(mockFile) };
        mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle);

        backupManager.directoryHandle = mockDirectoryHandle;
        backupManager.onConfirm = jest.fn().mockResolvedValue(false); // User says NO

        await expect(backupManager.readNdjson('test.ndjson')).rejects.toThrow('ABORT_BY_USER');
        expect(backupManager.onConfirm).toHaveBeenCalledWith('backup-err-0byte', { name: 'test.ndjson' });
    });

    test('readNdjson continues when 0-byte file is found and user confirms', async () => {
        const mockFile = { size: 0 };
        const mockFileHandle = { getFile: jest.fn().mockResolvedValue(mockFile) };
        mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle);

        backupManager.directoryHandle = mockDirectoryHandle;
        backupManager.onConfirm = jest.fn().mockResolvedValue(true); // User says YES

        const result = await backupManager.readNdjson('test.ndjson');
        expect(result).toEqual([]);
        expect(backupManager.onConfirm).toHaveBeenCalled();
    });

    test('sync handles general unknown errors', async () => {
        const error = new Error('Some random error');
        mockDirectoryHandle.getFileHandle.mockImplementation(() => { throw error; });

        backupManager.directoryHandle = mockDirectoryHandle;
        backupManager.config.enabled = true;

        await backupManager.sync();

        expect(backupManager.status).toBe(BACKUP_STATUS.FAILED);
        expect(backupManager.lastError.key).toBe('backup-err-unknown');
        expect(backupManager.lastError.params.message).toBe('Some random error');
    });
});
