import { dbGetAll, dbGet, dbPut, STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS } from './db.js';

export const SETTING_KEY_BACKUP_CONFIG = 'backupConfig';

const FILE_NAME_CATEGORIES = 'categories.ndjson';
const FILE_NAME_SETTINGS = 'settings.ndjson';
const LOG_CLEANUP_THRESHOLD_MS = 40 * 24 * 60 * 60 * 1000;

export const BACKUP_STATUS = {
    IDLE: 'idle',
    SYNCING: 'syncing',
    SUCCESS: 'success',
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
        this.status = BACKUP_STATUS.IDLE;
        this.onStatusChange = null;
        this.backupTimer = null;
        this.isSyncing = false;
    }

    async init() {
        const savedConfig = await dbGet(STORE_SETTINGS, SETTING_KEY_BACKUP_CONFIG);
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig.value };
        }

        if (this.config.enabled) {
            await this.tryRestoreHandle();
            if (this.directoryHandle) {
                this.scheduleBackup();
            } else {
                this.status = BACKUP_STATUS.FAILED;
            }
        }
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
        this.status = BACKUP_STATUS.IDLE;
        if (this.onStatusChange) this.onStatusChange(this.status);
    }

    async enable(enabled) {
        this.config.enabled = enabled;
        await this.saveConfig();
        if (enabled) {
            if (this.directoryHandle) {
                await this.sync();
                this.scheduleBackup();
            }
        } else {
            if (this.backupTimer) {
                clearTimeout(this.backupTimer);
                this.backupTimer = null;
            }
        }
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
            console.error('QuickLog-Solo: Backup failed', e);
            this.status = BACKUP_STATUS.FAILED;
        } finally {
            this.isSyncing = false;
            if (this.onStatusChange) this.onStatusChange(this.status);
            this.scheduleBackup();
        }
    }

    async backupToFiles() {
        // Backup Categories
        const categories = await dbGetAll(STORE_CATEGORIES);
        await this.writeNdjson(FILE_NAME_CATEGORIES, categories);

        // Backup Settings (excluding backup-specific ones to avoid loops)
        const allSettings = await dbGetAll(STORE_SETTINGS);
        const filteredSettings = allSettings.filter(s => s.key !== 'backupDirectoryHandle' && s.key !== SETTING_KEY_BACKUP_CONFIG);
        await this.writeNdjson(FILE_NAME_SETTINGS, filteredSettings);

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
        // Categories
        const fileCategories = await this.readNdjson(FILE_NAME_CATEGORIES);
        if (fileCategories.length > 0) {
            const dbCategories = await dbGetAll(STORE_CATEGORIES);
            for (const fc of fileCategories) {
                // Skip system categories and existing ones
                if (fc.name && !fc.name.startsWith('__SYSTEM_') && !dbCategories.find(dc => dc.name === fc.name)) {
                    delete fc.id;
                    await dbPut(STORE_CATEGORIES, fc);
                }
            }
        }

        // Settings
        const fileSettings = await this.readNdjson(FILE_NAME_SETTINGS);
        if (fileSettings.length > 0) {
            for (const fs of fileSettings) {
                const dbS = await dbGet(STORE_SETTINGS, fs.key);
                if (!dbS) {
                    await dbPut(STORE_SETTINGS, fs);
                }
            }
        }

        // Logs
        const threshold = Date.now() - LOG_CLEANUP_THRESHOLD_MS;
        for await (const entry of this.directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.match(/^\d{4}-\d{2}-\d{2}\.ndjson$/)) {
                const dateStr = entry.name.replace('.ndjson', '');
                if (new Date(dateStr).getTime() < threshold - 86400000) continue; // Skip very old files

                const fileLogs = await this.readNdjson(entry.name);
                const dbLogs = await dbGetAll(STORE_LOGS); // Optimization potential here
                for (const fl of fileLogs) {
                    if (!dbLogs.find(dl => dl.startTime === fl.startTime && dl.category === fl.category)) {
                        // Avoid adding very old logs that should have been cleaned up
                        if (fl.startTime >= threshold) {
                            // Remove ID to avoid collision and let IndexedDB assign a new one
                            delete fl.id;
                            await dbPut(STORE_LOGS, fl);
                        }
                    }
                }
            }
        }
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
        try {
            const fileHandle = await this.directoryHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
        } catch {
            return [];
        }
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
        if (this.config.enabled && this.config.interval === 'immediate') {
            // Debounce immediate backup
            if (this._immediateTimer) clearTimeout(this._immediateTimer);
            this._immediateTimer = setTimeout(() => this.sync(), 2000);
        }
    }
}

export const backupManager = new BackupManager();
