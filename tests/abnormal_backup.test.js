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

describe('BackupManager Abnormal Cases', () => {
    let mockDirectoryHandle;

    beforeEach(() => {
        // Reset backupManager state
        backupManager.status = BACKUP_STATUS.DISABLED;
        backupManager.config = { lastBackupTime: null };
        backupManager.directoryHandle = null;
        backupManager.onStatusChange = null;
        backupManager.onConfirm = null;
        backupManager.lastError = null;

        mockDirectoryHandle = {
            values: jest.fn(),
            getFileHandle: jest.fn(),
            removeEntry: jest.fn(), queryPermission: jest.fn().mockResolvedValue("granted")
        };

        jest.clearAllMocks();
    });

    test('sync sets status to FAILED and records lastError when directory is not readable', async () => {
        const error = new Error('Locked');
        error.name = 'NotReadableError';

        // Mock getFileHandle to avoid restoreFromFiles failing before it gets to values()
        mockDirectoryHandle.getFileHandle.mockImplementation(() => { throw error; });

        backupManager.directoryHandle = mockDirectoryHandle;
        

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
        

        await backupManager.sync();

        expect(backupManager.status).toBe(BACKUP_STATUS.FAILED);
        expect(backupManager.lastError.key).toBe('backup-err-unknown');
        expect(backupManager.lastError.params.message).toBe('Some random error');
    });

    test('_validateCategory repairs invalid color and animation', () => {
        const invalidCat = { name: 'Test', color: 'malicious-color', animation: 123 };
        const result = backupManager._validateCategory(invalidCat);
        expect(result.name).toBe('Test');
        expect(result.color).toBe('primary'); // Default
        expect(result.animation).toBe('default'); // Default
    });

    test('_validateCategory returns null for invalid names', () => {
        expect(backupManager._validateCategory({ name: '' })).toBeNull();
        expect(backupManager._validateCategory({ name: 'A'.repeat(51) })).toBeNull();
        expect(backupManager._validateCategory({ name: '__IDLE__' })).toBeNull();
    });

    test('_validateLog repairs invalid color and ensures types', () => {
        const invalidLog = { category: 'Dev', startTime: 1000, color: 'bad' };
        const result = backupManager._validateLog(invalidLog);
        expect(result.category).toBe('Dev');
        expect(result.color).toBeNull();
        expect(result.isManualStop).toBe(false);
    });

    test('_validateSetting rejects unknown keys and invalid values', () => {
        // Unknown key
        expect(backupManager._validateSetting({ key: 'unknown', value: 'val' })).toBeNull();

        // Invalid values for known keys
        expect(backupManager._validateSetting({ key: 'theme', value: 'purple' })).toBeNull();
        expect(backupManager._validateSetting({ key: 'language', value: 'ru' })).toBeNull();
        expect(backupManager._validateSetting({ key: 'autoStop', value: 'yes' })).toBeNull();

        // Valid case
        expect(backupManager._validateSetting({ key: 'theme', value: 'dark' })).toEqual({ key: 'theme', value: 'dark' });
    });
});
