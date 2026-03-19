import {
    dbGetAll, dbGet, dbPut, dbAddMultiple,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS,
    SETTING_KEY_ANIMATION, SETTING_KEY_BACKUP_CONFIG, SETTING_KEY_BACKUP_DIR_HANDLE
} from '../shared/js/db.js';
import { SYSTEM_CATEGORY_PAGE_BREAK, SYSTEM_CATEGORY_IDLE } from '../shared/js/utils.js';
import {
    SCHEMA_VERSION_1_0,
    SCHEMA_KIND_CATEGORY, SCHEMA_KIND_HISTORY, SCHEMA_KIND_SETTINGS,
    SCHEMA_TYPE_CATEGORY, SCHEMA_TYPE_PAGE_BREAK,
    SCHEMA_TYPE_HISTORY_TASK, SCHEMA_TYPE_HISTORY_IDLE, SCHEMA_TYPE_HISTORY_STOP,
    validateCategorySchema, validateHistorySchema, validateSettingsSchema
} from '../shared/js/schema.js';

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
            const handle = await dbGet(STORE_SETTINGS, SETTING_KEY_BACKUP_DIR_HANDLE);
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
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BACKUP_DIR_HANDLE, value: handle });
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
        // Sort by display order before exporting to NDJSON
        categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const categoryData = categories.map(cat => {
            const isPageBreak = cat.name && cat.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
            const entry = {
                kind: SCHEMA_KIND_CATEGORY,
                version: SCHEMA_VERSION_1_0,
                type: isPageBreak ? SCHEMA_TYPE_PAGE_BREAK : SCHEMA_TYPE_CATEGORY
            };
            if (!isPageBreak) {
                entry.name = cat.name;
                entry.color = cat.color;
                entry.tags = cat.tags ? cat.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                entry.animation = cat.animation || 'default';
            }
            return entry;
        });
        await this.writeNdjson(FILE_NAME_CATEGORIES, categoryData);

        // Backup Settings (JSON) - excluding backup-specific ones to avoid loops
        const allSettings = await dbGetAll(STORE_SETTINGS);
        const filteredSettings = allSettings.filter(s => s.key !== SETTING_KEY_BACKUP_DIR_HANDLE && s.key !== SETTING_KEY_BACKUP_CONFIG);
        const settingsData = {
            app: 'QuickLog-Solo',
            kind: SCHEMA_KIND_SETTINGS,
            version: SCHEMA_VERSION_1_0,
            entries: filteredSettings.map(s => {
                // Map application keys to schema keys
                let key = s.key;
                if (key === SETTING_KEY_ANIMATION) key = 'defaultAnimation';
                return { key, value: s.value };
            })
        };
        await this.writeJson(FILE_NAME_SETTINGS, settingsData);

        // Backup Logs
        const logs = await dbGetAll(STORE_LOGS);
        const logsByDate = {};
        logs.forEach(log => {
            const date = this.formatDate(new Date(log.startTime));
            if (!logsByDate[date]) logsByDate[date] = [];

            const type = log.isManualStop ? SCHEMA_TYPE_HISTORY_STOP :
                         (log.category === SYSTEM_CATEGORY_IDLE ? SCHEMA_TYPE_HISTORY_IDLE : SCHEMA_TYPE_HISTORY_TASK);

            const entry = {
                kind: SCHEMA_KIND_HISTORY,
                version: SCHEMA_VERSION_1_0,
                type: type,
                startTime: log.startTime,
                endTime: log.endTime || null
            };

            if (type === SCHEMA_TYPE_HISTORY_TASK) {
                entry.category = log.category;
                if (log.color) entry.color = log.color; // Omit if null/undefined for schema compliance
                entry.tags = log.tags ? log.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                if (log.memo) entry.memo = log.memo;
            } else if (type === SCHEMA_TYPE_HISTORY_IDLE) {
                if (log.resumableCategory) entry.resumableCategory = log.resumableCategory;
            } else if (type === SCHEMA_TYPE_HISTORY_STOP) {
                entry.isManualStop = true;
            }

            logsByDate[date].push(entry);
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
            let maxOrder = dbCategories.reduce((max, c) => Math.max(max, c.order || 0), -1);

            for (const fc of fileCategories) {
                const validated = this._validateCategory(fc);
                if (validated) {
                    // Page breaks need unique names for current DB keyPath
                    const isPageBreak = validated.name.startsWith(SYSTEM_CATEGORY_PAGE_BREAK);
                    if (isPageBreak || !dbCategories.find(dc => dc.name === validated.name)) {
                        validated.order = ++maxOrder;
                        newCategories.push(validated);
                    }
                }
            }
            if (newCategories.length > 0) await dbAddMultiple(STORE_CATEGORIES, newCategories);
        }

        // --- Settings (JSON) ---
        let fileSettingsData;
        try {
            fileSettingsData = await this.readJson(FILE_NAME_SETTINGS);
        } catch (e) {
            if (e.name === 'NotFoundError') fileSettingsData = null;
            else throw e;
        }
        if (fileSettingsData && validateSettingsSchema(fileSettingsData)) {
            const dbSettings = await dbGetAll(STORE_SETTINGS);
            const newSettings = [];
            for (const fs of fileSettingsData.entries) {
                // Map schema keys back to application keys
                let key = fs.key;
                if (key === 'defaultAnimation') key = SETTING_KEY_ANIMATION;

                if (!dbSettings.find(ds => ds.key === key)) {
                    newSettings.push({ key, value: fs.value });
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
        if (!validateCategorySchema(cat)) return null;

        if (cat.type === SCHEMA_TYPE_PAGE_BREAK) {
            return {
                name: `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                order: 0 // Placeholder, will be set during import loop
            };
        }

        return {
            name: cat.name.trim(),
            color: cat.color,
            tags: Array.isArray(cat.tags) ? cat.tags.join(',') : '',
            animation: cat.animation || 'default',
            order: 0 // Placeholder, will be set during import loop
        };
    }

    _validateLog(log) {
        if (!validateHistorySchema(log)) return null;

        const type = log.type;
        const base = {
            startTime: log.startTime,
            endTime: log.endTime || null
        };

        if (type === SCHEMA_TYPE_HISTORY_TASK) {
            return {
                ...base,
                category: log.category,
                color: log.color || null,
                tags: Array.isArray(log.tags) ? log.tags.join(',') : '',
                memo: log.memo || ''
            };
        } else if (type === SCHEMA_TYPE_HISTORY_IDLE) {
            return {
                ...base,
                category: SYSTEM_CATEGORY_IDLE,
                resumableCategory: log.resumableCategory || null
            };
        } else if (type === SCHEMA_TYPE_HISTORY_STOP) {
            return {
                ...base,
                category: SYSTEM_CATEGORY_IDLE, // Historically IDLE is used for stops too
                isManualStop: true
            };
        }
        return null;
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
}

export const backupManager = new BackupManager();
