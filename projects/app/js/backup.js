import {
    dbGetAll, dbGet, dbPut, dbAddMultiple, STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS,
    SETTING_KEY_BACKUP_CONFIG, SETTING_KEY_BACKUP_DIRECTORY_HANDLE
} from '../shared/js/db.js';
import { isValidColor, isValidCategoryName, SYSTEM_CATEGORY_PAGE_BREAK } from '../shared/js/utils.js';

const FILE_NAME_CATEGORIES = 'categories.ndjson';
const FILE_NAME_SETTINGS = 'settings.json';
const LOG_CLEANUP_THRESHOLD_MS = 40 * 24 * 60 * 60 * 1000;

export const BACKUP_STATUS = {
    DISABLED: 'disabled', // No directory handle
    SYNCING: 'syncing',
    SUCCESS: 'success',
    FAILED: 'failed'
};

class BackupManager {
    constructor() {
        this.directoryHandle = null;
        this.config = {
            lastBackupTime: null
        };
        this.status = BACKUP_STATUS.DISABLED;
        this.onStatusChange = null;
        this.isSyncing = false;
        this.lastError = null;
        this.onConfirm = null; // Callback for user confirmation
    }

    async init() {
        const savedConfig = await dbGet(STORE_SETTINGS, SETTING_KEY_BACKUP_CONFIG);
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig.value };
        }

        await this.tryRestoreHandle();
        this._updateStatus();
    }

    async tryRestoreHandle() {
        try {
            const handle = await dbGet(STORE_SETTINGS, SETTING_KEY_BACKUP_DIRECTORY_HANDLE);
            if (handle) {
                this.directoryHandle = handle.value;
            }
        } catch {
            // Ignore if key is not found
        }
    }

    async _updateStatus() {
        if (!this.directoryHandle) {
            this.status = BACKUP_STATUS.DISABLED;
        } else {
            try {
                const permission = await this.directoryHandle.queryPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    this.status = BACKUP_STATUS.SUCCESS;
                } else {
                    this.status = BACKUP_STATUS.FAILED; // Indicates permission needed or other issue
                }
            } catch {
                this.status = BACKUP_STATUS.FAILED;
            }
        }
        if (this.onStatusChange) this.onStatusChange(this.status);
    }

    async hasPermission() {
        if (!this.directoryHandle) return false;
        return (await this.directoryHandle.queryPermission({ mode: 'readwrite' })) === 'granted';
    }

    async requestPermission() {
        if (!this.directoryHandle) return false;
        const result = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
        await this._updateStatus();
        return result === 'granted';
    }

    async setDirectory(handle) {
        this.directoryHandle = handle;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BACKUP_DIRECTORY_HANDLE, value: handle });
        await this._updateStatus();
    }

    async saveConfig() {
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BACKUP_CONFIG, value: this.config });
    }

    async sync() {
        if (this.isSyncing || !this.directoryHandle) return;

        // Check permission before syncing
        if (!(await this.hasPermission())) {
            this.status = BACKUP_STATUS.FAILED;
            if (this.onStatusChange) this.onStatusChange(this.status);
            return;
        }

        this.isSyncing = true;
        this.status = BACKUP_STATUS.SYNCING;
        this.lastError = null;
        if (this.onStatusChange) this.onStatusChange(this.status);

        try {
            // 1. Restore from files to DB (Merge)
            await this.restoreFromFiles();

            // 2. Backup from DB to files
            await this.backupToFiles();

            // 3. Cleanup old files
            await this.cleanupOldFiles();

            this.config.lastBackupTime = Date.now();
            await this.saveConfig();
            this.status = BACKUP_STATUS.SUCCESS;
        } catch (e) {
            if (e.message === 'ABORT_BY_USER') {
                console.log('QuickLog-Solo: Backup aborted by user');
                this.status = BACKUP_STATUS.SUCCESS;
            } else {
                console.error('QuickLog-Solo: Backup failed', e);
                this.status = BACKUP_STATUS.FAILED;
                this.lastError = this._handleError(e);
            }
        } finally {
            this.isSyncing = false;
            if (this.onStatusChange) this.onStatusChange(this.status);
        }
    }

    _handleError(e) {
        const message = e.message || '';
        if (e.name === 'NotReadableError' || e.name === 'AbortError' || message.toLowerCase().includes('locked')) {
            return { key: 'backup-err-locked' };
        }
        if (e.name === 'NotFoundError') {
            return { key: 'backup-err-not-found' };
        }
        return { key: 'backup-err-unknown', params: { message: e.message } };
    }

    async backupToFiles() {
        // Backup Categories (NDJSON)
        const categories = await dbGetAll(STORE_CATEGORIES);
        await this.writeNdjson(FILE_NAME_CATEGORIES, categories);

        // Backup Settings (JSON) - excluding backup-specific ones to avoid loops
        const allSettings = await dbGetAll(STORE_SETTINGS);
        const filteredSettings = allSettings.filter(s => s.key !== SETTING_KEY_BACKUP_DIRECTORY_HANDLE && s.key !== SETTING_KEY_BACKUP_CONFIG);
        await this.writeJson(FILE_NAME_SETTINGS, filteredSettings);

        // Backup Logs
        const logs = await dbGetAll(STORE_LOGS);
        const logsByDate = {};
        logs.forEach(log => {
            const date = this.formatDate(new Date(log.startTime));
            if (!logsByDate[date]) logsByDate[date] = [];
            logsByDate[date].push(log);
        });

        for (const [date, dayLogs] of Object.entries(logsByDate)) {
            await this.writeNdjson(`${date}.ndjson`, dayLogs);
        }
    }

    async restoreFromFiles() {
        // --- Categories (NDJSON) ---
        let fileCategories;
        try {
            fileCategories = await this.readNdjson(FILE_NAME_CATEGORIES);
        } catch (e) {
            if (e.name === 'NotFoundError') fileCategories = [];
            else throw e;
        }
        if (fileCategories.length > 0) {
            const dbCategories = await dbGetAll(STORE_CATEGORIES);
            const newCategories = [];
            for (const fc of fileCategories) {
                const validated = this._validateCategory(fc);
                if (validated && !dbCategories.find(dc => dc.name === validated.name)) {
                    newCategories.push(validated);
                }
            }
            if (newCategories.length > 0) await dbAddMultiple(STORE_CATEGORIES, newCategories);
        }

        // --- Settings (JSON) ---
        let fileSettings;
        try {
            fileSettings = await this.readJson(FILE_NAME_SETTINGS);
        } catch (e) {
            if (e.name === 'NotFoundError') fileSettings = [];
            else throw e;
        }
        if (fileSettings.length > 0) {
            const dbSettings = await dbGetAll(STORE_SETTINGS);
            const newSettings = [];
            for (const fs of fileSettings) {
                const validated = this._validateSetting(fs);
                if (validated && !dbSettings.find(ds => ds.key === validated.key)) {
                    newSettings.push(validated);
                }
            }
            if (newSettings.length > 0) await dbAddMultiple(STORE_SETTINGS, newSettings);
        }

        // --- Logs ---
        const threshold = Date.now() - LOG_CLEANUP_THRESHOLD_MS;
        const dbLogs = await dbGetAll(STORE_LOGS);
        const dbLogKeys = new Set(dbLogs.map(l => `${l.startTime}|${l.category}`));
        const newLogs = [];

        for await (const entry of this.directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.match(/^\d{4}-\d{2}-\d{2}\.ndjson$/)) {
                const dateStr = entry.name.replace('.ndjson', '');
                if (new Date(dateStr).getTime() < threshold - 86400000) continue; // Skip very old files

                let fileLogs;
                try {
                    fileLogs = await this.readNdjson(entry.name);
                } catch (e) {
                    if (e.name === 'NotFoundError') fileLogs = [];
                    else throw e;
                }
                for (const fl of fileLogs) {
                    const validated = this._validateLog(fl);
                    if (!validated) continue;

                    const key = `${validated.startTime}|${validated.category}`;
                    if (!dbLogKeys.has(key)) {
                        // Avoid adding very old logs that should have been cleaned up
                        if (validated.startTime >= threshold) {
                            newLogs.push(validated);
                            dbLogKeys.add(key); // Avoid adding same log multiple times from different files if any
                        }
                    }
                }
            }
        }
        if (newLogs.length > 0) await dbAddMultiple(STORE_LOGS, newLogs);
    }

    async cleanupOldFiles() {
        const threshold = Date.now() - LOG_CLEANUP_THRESHOLD_MS;
        for await (const entry of this.directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.match(/^\d{4}-\d{2}-\d{2}\.ndjson$/)) {
                const dateStr = entry.name.replace('.ndjson', '');
                if (new Date(dateStr).getTime() < threshold - 86400000) {
                    await this.directoryHandle.removeEntry(entry.name);
                    console.log(`QuickLog-Solo: Cleaned up old backup file: ${entry.name}`);
                }
            }
        }
    }

    async writeNdjson(fileName, data) {
        const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const content = data.map(item => JSON.stringify(item)).join('\n');
        await writable.write(content);
        await writable.close();
    }

    async _readTextFileWithCheck(fileName) {
        const fileHandle = await this.directoryHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        if (file.size === 0) {
            if (this.onConfirm) {
                const proceed = await this.onConfirm('backup-err-0byte', { name: fileName });
                if (!proceed) throw new Error('ABORT_BY_USER');
            }
            return null;
        }
        return await file.text();
    }

    async readNdjson(fileName) {
        const text = await this._readTextFileWithCheck(fileName);
        if (text === null) return [];
        return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    }

    async writeJson(fileName, data) {
        const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const content = JSON.stringify(data, null, 2);
        await writable.write(content);
        await writable.close();
    }

    async readJson(fileName) {
        const text = await this._readTextFileWithCheck(fileName);
        if (text === null) return [];
        return JSON.parse(text);
    }

    _validateCategory(cat) {
        if (!cat || typeof cat !== 'object' || !cat.name) return null;

        // Handle page breaks specifically
        if (cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) {
            return {
                name: cat.name,
                order: typeof cat.order === 'number' ? cat.order : 0
            };
        }

        // Regular categories
        if (!isValidCategoryName(cat.name)) return null;

        return {
            name: cat.name.trim(),
            color: isValidColor(cat.color) ? cat.color : 'primary',
            tags: typeof cat.tags === 'string' ? cat.tags : '',
            animation: typeof cat.animation === 'string' ? cat.animation : 'default',
            order: typeof cat.order === 'number' ? cat.order : 0
        };
    }

    _validateLog(log) {
        if (!log || typeof log !== 'object' || !log.category || typeof log.startTime !== 'number') return null;

        // Basic check for category name (allow system categories here)
        if (typeof log.category !== 'string' || log.category.length > 100) return null;

        return {
            category: log.category,
            startTime: log.startTime,
            endTime: typeof log.endTime === 'number' ? log.endTime : null,
            color: isValidColor(log.color) ? log.color : null,
            isManualStop: !!log.isManualStop,
            resumableCategory: typeof log.resumableCategory === 'string' ? log.resumableCategory : null
        };
    }

    _validateSetting(setting) {
        if (!setting || typeof setting !== 'object' || !setting.key) return null;
        const key = setting.key;
        const value = setting.value;

        // Whitelist of settings we allow to restore
        const allowedKeys = [
            'theme', 'font', 'animation', 'language', 'reportSettings'
        ];
        if (!allowedKeys.includes(key)) return null;

        // Basic validation per key to prevent XSS and ensure data integrity
        switch (key) {
            case 'theme':
                if (!['system', 'light', 'dark'].includes(value)) return null;
                break;
            case 'font':
                if (typeof value !== 'string' || value.length > 200) return null;
                break;
            case 'animation':
                if (typeof value !== 'string' || value.length > 50) return null;
                break;
            case 'language':
                if (!['auto', 'ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'].includes(value)) return null;
                break;
            case 'reportSettings':
                if (typeof value !== 'object' || value === null) return null;
                break;
            default:
                return null;
        }

        return { key, value };
    }

    formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    async getFileCount() {
        if (!this.directoryHandle) return 0;
        let count = 0;
        try {
            for await (const entry of this.directoryHandle.values()) {
                if (entry.kind === 'file' && entry.name.match(/^\d{4}-\d{2}-\d{2}\.ndjson$/)) {
                    count++;
                }
            }
        } catch {
            // Might fail if permission is not granted
        }
        return count;
    }

    // Removed: requestImmediateBackup()
    // Removed: scheduleBackup()
    // Removed: _startDirtyMonitor()

    async flush() {
        // Manual backup only now
        await this.sync();
    }
}

export const backupManager = new BackupManager();
