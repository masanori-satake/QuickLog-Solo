import { dbGetAll, dbGet, dbPut, dbAddMultiple, STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS } from './db.js';

export const SETTING_KEY_BACKUP_CONFIG = 'backupConfig';

const FILE_NAME_CATEGORIES = 'categories.ndjson';
const FILE_NAME_SETTINGS = 'settings.json';
const LOG_CLEANUP_THRESHOLD_MS = 40 * 24 * 60 * 60 * 1000;

export const BACKUP_STATUS = {
    DISABLED: 'disabled',
    SYNCING: 'syncing',
    SUCCESS: 'success',
    DIRTY: 'dirty',
    FAILED: 'failed'
};

class BackupManager {
    constructor() {
        this.directoryHandle = null;
        this.config = {
            enabled: false,
            interval: '5m', // 'immediate', '5m', '1h'
            lastBackupTime: null
        };
        this.status = BACKUP_STATUS.DISABLED;
        this.onStatusChange = null;
        this.backupTimer = null;
        this.isSyncing = false;
        this.isDirty = false;
        this.dirtyStartTime = 0;
        this._dirtyCheckInterval = null;
        this.lastError = null;
        this.onConfirm = null; // Callback for user confirmation
    }

    async init() {
        const savedConfig = await dbGet(STORE_SETTINGS, SETTING_KEY_BACKUP_CONFIG);
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig.value };
        }

        if (this.config.enabled) {
            await this.tryRestoreHandle();
            if (this.directoryHandle) {
                this.status = BACKUP_STATUS.SUCCESS;
                this.scheduleBackup();
            } else {
                this.status = BACKUP_STATUS.FAILED;
            }
        } else {
            this.status = BACKUP_STATUS.DISABLED;
        }

        this._startDirtyMonitor();
    }

    _startDirtyMonitor() {
        if (this._dirtyCheckInterval) clearInterval(this._dirtyCheckInterval);
        this._dirtyCheckInterval = setInterval(() => {
            if (this.isDirty && !this.isSyncing) {
                const now = Date.now();
                // Ensure dirty state is visible for at least 2 seconds
                if (now - this.dirtyStartTime >= 2000) {
                    // Update status to dirty if it was SUCCESS
                    if (this.status === BACKUP_STATUS.SUCCESS) {
                        this.status = BACKUP_STATUS.DIRTY;
                        if (this.onStatusChange) this.onStatusChange(this.status);
                    }
                }
            }
        }, 500);
    }

    async tryRestoreHandle() {
        try {
            const handle = await dbGet(STORE_SETTINGS, 'backupDirectoryHandle');
            if (handle) {
                this.directoryHandle = handle.value;
                // Check if we still have permission
                if (await this.directoryHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
                    // We don't have permission, user needs to grant it again via UI
                    this.directoryHandle = null;
                }
            }
        } catch (e) {
            console.error('QuickLog-Solo: Failed to restore directory handle', e);
        }
    }

    async setDirectory(handle) {
        this.directoryHandle = handle;
        await dbPut(STORE_SETTINGS, { key: 'backupDirectoryHandle', value: handle });
        if (this.config.enabled) {
            this.status = BACKUP_STATUS.SUCCESS;
        } else {
            this.status = BACKUP_STATUS.DISABLED;
        }
        if (this.onStatusChange) this.onStatusChange(this.status);
    }

    async enable(enabled) {
        this.config.enabled = enabled;
        await this.saveConfig();
        if (enabled) {
            if (this.directoryHandle) {
                this.status = BACKUP_STATUS.SUCCESS;
                await this.sync();
                this.scheduleBackup();
            } else {
                this.status = BACKUP_STATUS.FAILED;
            }
        } else {
            this.status = BACKUP_STATUS.DISABLED;
            if (this.backupTimer) {
                clearTimeout(this.backupTimer);
                this.backupTimer = null;
            }
        }
        if (this.onStatusChange) this.onStatusChange(this.status);
    }

    async setInterval(interval) {
        this.config.interval = interval;
        await this.saveConfig();
        if (this.config.enabled && this.directoryHandle) {
            this.scheduleBackup();
        }
    }

    async saveConfig() {
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BACKUP_CONFIG, value: this.config });
    }

    scheduleBackup() {
        if (this.backupTimer) clearTimeout(this.backupTimer);
        if (!this.config.enabled || !this.directoryHandle || this.config.interval === 'immediate') return;

        let ms = 5 * 60 * 1000;
        if (this.config.interval === '1h') ms = 60 * 60 * 1000;

        this.backupTimer = setTimeout(() => this.sync(), ms);
    }

    async sync() {
        if (this.isSyncing || !this.directoryHandle) return;
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
            this.isDirty = false;
        } catch (e) {
            if (e.message === 'ABORT_BY_USER') {
                console.log('QuickLog-Solo: Backup aborted by user');
                this.status = BACKUP_STATUS.SUCCESS; // Or some other state? Success is safer to avoid retry loop
            } else {
                console.error('QuickLog-Solo: Backup failed', e);
                this.status = BACKUP_STATUS.FAILED;
                this.lastError = this._handleError(e);
            }
        } finally {
            this.isSyncing = false;
            if (this.onStatusChange) this.onStatusChange(this.status);
            this.scheduleBackup();
        }
    }

    _handleError(e) {
        if (e.name === 'NotReadableError' || e.name === 'AbortError' || e.message.includes('locked')) {
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
        const filteredSettings = allSettings.filter(s => s.key !== 'backupDirectoryHandle' && s.key !== SETTING_KEY_BACKUP_CONFIG);
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
        let fileCategories = [];
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
                // Skip system categories and existing ones
                if (fc.name && !fc.name.startsWith('__SYSTEM_') && !dbCategories.find(dc => dc.name === fc.name)) {
                    delete fc.id;
                    newCategories.push(fc);
                }
            }
            if (newCategories.length > 0) await dbAddMultiple(STORE_CATEGORIES, newCategories);
        }

        // --- Settings (JSON) ---
        let fileSettings = [];
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
                if (!dbSettings.find(ds => ds.key === fs.key)) {
                    newSettings.push(fs);
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

                let fileLogs = [];
                try {
                    fileLogs = await this.readNdjson(entry.name);
                } catch (e) {
                    if (e.name === 'NotFoundError') fileLogs = [];
                    else throw e;
                }
                for (const fl of fileLogs) {
                    const key = `${fl.startTime}|${fl.category}`;
                    if (!dbLogKeys.has(key)) {
                        // Avoid adding very old logs that should have been cleaned up
                        if (fl.startTime >= threshold) {
                            delete fl.id;
                            newLogs.push(fl);
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

    async readNdjson(fileName) {
        const fileHandle = await this.directoryHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        if (file.size === 0) {
            if (this.onConfirm) {
                const proceed = await this.onConfirm('backup-err-0byte', { name: fileName });
                if (!proceed) throw new Error('ABORT_BY_USER');
            }
            return [];
        }
        const text = await file.text();
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
        const fileHandle = await this.directoryHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        if (file.size === 0) {
            if (this.onConfirm) {
                const proceed = await this.onConfirm('backup-err-0byte', { name: fileName });
                if (!proceed) throw new Error('ABORT_BY_USER');
            }
            return [];
        }
        const text = await file.text();
        return JSON.parse(text);
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
        for await (const entry of this.directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.match(/^\d{4}-\d{2}-\d{2}\.ndjson$/)) {
                count++;
            }
        }
        return count;
    }

    requestImmediateBackup() {
        if (this.config.enabled) {
            if (!this.isDirty) {
                this.isDirty = true;
                this.dirtyStartTime = Date.now();
            }

            if (this.config.interval === 'immediate') {
                // Debounce immediate backup
                if (this._immediateTimer) clearTimeout(this._immediateTimer);
                this._immediateTimer = setTimeout(() => this.sync(), 2000);
            }
        }
    }

    async flush() {
        if (this.config.enabled && this.directoryHandle) {
            await this.sync();
        }
    }
}

export const backupManager = new BackupManager();
