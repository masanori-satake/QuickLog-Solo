import {
    dbClear,
    dbAddMultiple,
    dbPut,
    STORE_LOGS,
    STORE_CATEGORIES,
    STORE_SETTINGS,
    STORE_ALARMS,
    SETTING_KEY_ANIMATION,
} from '../shared/js/db.js';
import {
    SCHEMA_TYPE_PAGE_BREAK,
    SCHEMA_TYPE_HISTORY_TASK,
    SCHEMA_TYPE_HISTORY_IDLE,
    SCHEMA_TYPE_HISTORY_STOP,
    validateCategorySchema,
    validateHistorySchema,
    validateSettingsSchema,
    validateAlarmSchema,
    validateCustomAnimationSchema,
} from '../shared/js/schema.js';
import { SYSTEM_CATEGORY_PAGE_BREAK, SYSTEM_CATEGORY_IDLE, generateUUID } from '../shared/js/utils.js';
import { initAnimationDB, saveAnimationBlob } from '../shared/js/idb_storage.js';
import { setCustomAnimationMetadataMap } from '../shared/js/utils/storage.js';

const FILE_NAME_QL_CATEGORIES = 'ql_categories.ndjson';
const FILE_NAME_CATEGORIES = 'categories.ndjson';
const FILE_NAME_QL_SETTINGS = 'ql_settings.json';
const FILE_NAME_SETTINGS = 'settings.json';
const FILE_NAME_QL_ALARMS = 'ql_alarms.json';
const FILE_NAME_QL_CUSTOM_ANIMATIONS = 'ql_custom_animations.json';
const DIR_NAME_HISTORY = 'history';
const DIR_NAME_ANIMATIONS = 'animations';

class RestoreManager {
    /**
     * Performs a full restore from a user-selected backup directory.
     * @param {Function} showConfirm - Callback to display confirmation dialog
     * @param {Function} showToast - Callback to display toast notification
     * @param {Function} t - i18n translation function
     * @param {FileSystemDirectoryHandle} [existingDirHandle] - Optional existing directory handle to restore from without showing picker
     * @returns {Promise<FileSystemDirectoryHandle|null>} The selected directory handle, or null if aborted
     */
    async restoreFromDirectory(showConfirm, showToast, t, existingDirHandle = null) {
        // Step 1: Show folder selection dialog if no existing handle is provided
        let dirHandle = existingDirHandle;
        if (!dirHandle) {
            try {
                dirHandle = await window.showDirectoryPicker({ mode: 'read' });
            } catch (e) {
                // User cancelled the dialog (AbortError) — do nothing
                if (e.name === 'AbortError') return null;
                throw e;
            }
        }

        // Step 2: Validate backup folder contains required files
        const validation = await this._readAndValidateBackupFolder(dirHandle);
        if (!validation.valid) {
            showToast(t('restore-error-invalid-folder'), 'error');
            return null;
        }

        // Step 3: Show confirmation dialog (full data wipe warning)
        const confirmed = await showConfirm(t('confirm-restore') + '\n\n' + t('confirm-restore-desc'));
        if (!confirmed) return null;

        // Step 4: Execute full restore
        let skippedCount = 0;

        try {
            // Clear all stores before writing
            await this._clearAllStores();

            // Restore in dependency order:
            // 1. Custom animations (no dependencies)
            skippedCount += await this._restoreCustomAnimations(dirHandle);

            // 2. Categories (referenced by animations)
            skippedCount += await this._restoreCategories(dirHandle);

            // 3. Settings (may reference custom animation IDs)
            skippedCount += await this._restoreSettings(dirHandle);

            // 4. Alarms (references category names)
            skippedCount += await this._restoreAlarms(dirHandle);

            // 5. Logs (references category names)
            skippedCount += await this._restoreLogs(dirHandle);
        } catch (e) {
            console.error('QuickLog-Solo: Restore failed', e);
            showToast(t('restore-error-write-failed'), 'error');
            return null;
        }

        // Step 5: Notify user of skipped records
        if (skippedCount > 0) {
            showToast(t('restore-skipped-records', { count: skippedCount }), 'warning');
        } else {
            showToast(t('restore-success'), 'success');
        }

        // Step 6: Return directory handle
        return dirHandle;
    }

    /**
     * Validates that the backup folder contains required files.
     * Checks for new filenames first, then falls back to legacy names.
     * @param {FileSystemDirectoryHandle} dirHandle
     * @returns {Promise<{valid: boolean}>}
     */
    async _readAndValidateBackupFolder(dirHandle) {
        const categoriesFile = await this._resolveFileWithFallback(
            dirHandle,
            FILE_NAME_QL_CATEGORIES,
            FILE_NAME_CATEGORIES
        );
        const settingsFile = await this._resolveFileWithFallback(dirHandle, FILE_NAME_QL_SETTINGS, FILE_NAME_SETTINGS);

        // Both must exist for a valid backup
        if (!categoriesFile || !settingsFile) {
            return { valid: false };
        }

        return { valid: true };
    }

    /**
     * Resolves a file handle with fallback to legacy name.
     * @param {FileSystemDirectoryHandle} dirHandle
     * @param {string} newName - Preferred filename
     * @param {string} legacyName - Fallback filename
     * @returns {Promise<FileSystemFileHandle|null>}
     */
    async _resolveFileWithFallback(dirHandle, newName, legacyName) {
        try {
            return await dirHandle.getFileHandle(newName);
        } catch (e) {
            if (e.name === 'NotFoundError') {
                try {
                    return await dirHandle.getFileHandle(legacyName);
                } catch (e2) {
                    if (e2.name === 'NotFoundError') return null;
                    throw e2;
                }
            }
            throw e;
        }
    }

    /**
     * Clears all IndexedDB stores and custom animation metadata.
     */
    async _clearAllStores() {
        // Clear QuickLogSoloDB stores
        await dbClear(STORE_LOGS);
        await dbClear(STORE_CATEGORIES);
        await dbClear(STORE_SETTINGS);
        await dbClear(STORE_ALARMS);

        // Clear QuickLogAnimationDB blobs store
        const animDb = await initAnimationDB();
        await new Promise((resolve, reject) => {
            const tx = animDb.transaction('blobs', 'readwrite');
            const store = tx.objectStore('blobs');
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        // Clear custom animation metadata from chrome.storage.local
        await setCustomAnimationMetadataMap({});
    }

    /**
     * Restores categories from backup.
     * @param {FileSystemDirectoryHandle} dirHandle
     * @returns {Promise<number>} Number of skipped records
     */
    async _restoreCategories(dirHandle) {
        const fileHandle = await this._resolveFileWithFallback(
            dirHandle,
            FILE_NAME_QL_CATEGORIES,
            FILE_NAME_CATEGORIES
        );
        if (!fileHandle) return 0;

        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!text.trim()) return 0;

        const lines = text.split('\n').filter((line) => line.trim());
        const validCategories = [];
        let skipped = 0;

        for (let i = 0; i < lines.length; i++) {
            let record;
            try {
                record = JSON.parse(lines[i]);
            } catch {
                skipped++;
                continue;
            }

            if (!validateCategorySchema(record)) {
                skipped++;
                continue;
            }

            if (record.type === SCHEMA_TYPE_PAGE_BREAK) {
                validCategories.push({
                    name: `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    order: i,
                });
            } else {
                validCategories.push({
                    name: record.name.trim(),
                    color: record.color,
                    tags: Array.isArray(record.tags) ? record.tags.join(',') : '',
                    animation: record.animation || 'default',
                    order: i,
                });
            }
        }

        if (validCategories.length > 0) {
            await dbAddMultiple(STORE_CATEGORIES, validCategories);
        }

        return skipped;
    }

    /**
     * Restores settings from backup.
     * @param {FileSystemDirectoryHandle} dirHandle
     * @returns {Promise<number>} Number of skipped records
     */
    async _restoreSettings(dirHandle) {
        const fileHandle = await this._resolveFileWithFallback(dirHandle, FILE_NAME_QL_SETTINGS, FILE_NAME_SETTINGS);
        if (!fileHandle) return 0;

        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!text.trim()) return 0;

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return 1;
        }

        if (!validateSettingsSchema(data)) {
            return 1;
        }

        for (const entry of data.entries) {
            // Map schema keys back to application keys
            let key = entry.key;
            if (key === 'defaultAnimation') key = SETTING_KEY_ANIMATION;

            await dbPut(STORE_SETTINGS, { key, value: entry.value });
        }

        return 0;
    }

    /**
     * Restores work logs from backup.
     * Searches history/ subdirectory first; only falls back to root directory if history/ was not found.
     * @param {FileSystemDirectoryHandle} dirHandle
     * @returns {Promise<number>} Number of skipped records
     */
    async _restoreLogs(dirHandle) {
        const datePattern = /^\d{4}-\d{2}-\d{2}\.ndjson$/;
        const allLogs = [];
        let skipped = 0;
        let historyFound = false;

        // Search history/ subdirectory first
        try {
            const historyDir = await dirHandle.getDirectoryHandle(DIR_NAME_HISTORY);
            historyFound = true;
            for await (const entry of historyDir.values()) {
                if (entry.kind === 'file' && datePattern.test(entry.name)) {
                    const result = await this._readAndValidateLogFile(entry);
                    allLogs.push(...result.logs);
                    skipped += result.skipped;
                }
            }
        } catch (e) {
            if (e.name !== 'NotFoundError') throw e;
        }

        // Only search root directory if history/ was not found (v1.x compatibility)
        if (!historyFound) {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && datePattern.test(entry.name)) {
                    const result = await this._readAndValidateLogFile(entry);
                    allLogs.push(...result.logs);
                    skipped += result.skipped;
                }
            }
        }

        if (allLogs.length > 0) {
            await dbAddMultiple(STORE_LOGS, allLogs);
        }

        return skipped;
    }

    /**
     * Reads and validates a single log NDJSON file.
     * @param {FileSystemFileHandle} fileHandle
     * @returns {Promise<{logs: Array, skipped: number}>}
     */
    async _readAndValidateLogFile(fileHandle) {
        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!text.trim()) return { logs: [], skipped: 0 };

        const lines = text.split('\n').filter((line) => line.trim());
        const logs = [];
        let skipped = 0;

        for (const line of lines) {
            let record;
            try {
                record = JSON.parse(line);
            } catch {
                skipped++;
                continue;
            }

            if (!validateHistorySchema(record)) {
                skipped++;
                continue;
            }

            const validated = this._convertLogRecord(record);
            if (validated) {
                logs.push(validated);
            } else {
                skipped++;
            }
        }

        return { logs, skipped };
    }

    /**
     * Converts a validated schema log record to DB format.
     * @param {Object} record
     * @returns {Object|null}
     */
    _convertLogRecord(record) {
        const type = record.type;
        const base = {
            startTime: record.startTime,
            endTime: record.endTime || null,
            syncId: record.syncId || generateUUID(),
            updatedAt: record.updatedAt || record.endTime || record.startTime || Date.now(),
        };

        if (type === SCHEMA_TYPE_HISTORY_TASK) {
            return {
                ...base,
                category: record.category,
                color: record.color || null,
                tags: Array.isArray(record.tags) ? record.tags.join(',') : '',
                memo: record.memo || '',
            };
        } else if (type === SCHEMA_TYPE_HISTORY_IDLE) {
            return {
                ...base,
                category: SYSTEM_CATEGORY_IDLE,
                resumableCategory: record.resumableCategory || null,
            };
        } else if (type === SCHEMA_TYPE_HISTORY_STOP) {
            return {
                ...base,
                category: SYSTEM_CATEGORY_IDLE,
                isManualStop: true,
            };
        }
        return null;
    }

    /**
     * Restores alarms from backup.
     * If ql_alarms.json doesn't exist, treats as empty array (no error).
     * @param {FileSystemDirectoryHandle} dirHandle
     * @returns {Promise<number>} Number of skipped records
     */
    async _restoreAlarms(dirHandle) {
        let fileHandle;
        try {
            fileHandle = await dirHandle.getFileHandle(FILE_NAME_QL_ALARMS);
        } catch (e) {
            if (e.name === 'NotFoundError') return 0; // v1.x backup — no alarms file
            throw e;
        }

        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!text.trim()) return 0;

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return 1;
        }

        if (!validateAlarmSchema(data)) {
            return 1;
        }

        const alarms = data.entries.map((entry, index) => ({
            enabled: entry.enabled,
            time: entry.time,
            message: entry.message,
            action: entry.action,
            actionCategory: entry.actionCategory,
            requireConfirmation: entry.requireConfirmation,
            type: entry.type,
            daysOfWeek: entry.daysOfWeek,
            dayOfMonth: entry.dayOfMonth,
            daysBeforeEnd: entry.daysBeforeEnd,
            holidayAdjustment: entry.holidayAdjustment,
            order: entry.order !== undefined ? entry.order : index,
        }));

        if (alarms.length > 0) {
            await dbAddMultiple(STORE_ALARMS, alarms);
        }

        return 0;
    }

    /**
     * Restores custom animations from backup.
     * Reads ql_custom_animations.json and animations/{id}.gif files.
     * @param {FileSystemDirectoryHandle} dirHandle
     * @returns {Promise<number>} Number of skipped records
     */
    async _restoreCustomAnimations(dirHandle) {
        let fileHandle;
        try {
            fileHandle = await dirHandle.getFileHandle(FILE_NAME_QL_CUSTOM_ANIMATIONS);
        } catch (e) {
            if (e.name === 'NotFoundError') return 0; // No custom animations
            throw e;
        }

        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!text.trim()) return 0;

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return 1;
        }

        if (!validateCustomAnimationSchema(data)) {
            return 1;
        }

        // Try to get animations/ subdirectory
        let animDir;
        try {
            animDir = await dirHandle.getDirectoryHandle(DIR_NAME_ANIMATIONS);
        } catch (e) {
            if (e.name === 'NotFoundError') {
                animDir = null;
            } else {
                throw e;
            }
        }

        const metadataMap = {};
        let skipped = 0;

        for (const entry of data.entries) {
            if (!animDir) {
                // No animations directory — skip
                skipped++;
                continue;
            }

            // Read the animation Blob
            let blob;
            try {
                const blobFileHandle = await animDir.getFileHandle(`${entry.id}.gif`);
                blob = await blobFileHandle.getFile();
            } catch (e) {
                if (e.name === 'NotFoundError') {
                    // GIF file missing — skip this animation
                    skipped++;
                    continue;
                }
                throw e;
            }

            // Write Blob to QuickLogAnimationDB
            await saveAnimationBlob(entry.id, blob, entry.renderSpec || {}, entry.config || {});

            // Build metadata entry
            metadataMap[entry.id] = {
                name: entry.name,
                description: entry.description || '',
                config: entry.config || {},
                renderSpec: entry.renderSpec || {},
                payload: {
                    renderSpec: entry.renderSpec || {},
                },
                createdAt: entry.createdAt || null,
            };
        }

        // Write metadata to chrome.storage.local
        if (Object.keys(metadataMap).length > 0) {
            await setCustomAnimationMetadataMap(metadataMap);
        }

        return skipped;
    }
}

export const restoreManager = new RestoreManager();
