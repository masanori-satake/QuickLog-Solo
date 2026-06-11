import {
    dbGetAll, dbPut, dbAddMultiple, dbGet, openDatabase,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS,
    SETTING_KEY_SESSION_SYNC, SETTING_KEY_LAST_PULLED_SYNC_TIME,
    SETTING_KEY_THEME, SETTING_KEY_FONT, SETTING_KEY_ANIMATION,
    SETTING_KEY_LANGUAGE, SETTING_KEY_REPORT_SETTINGS, SETTING_KEY_BUSINESS_DAYS,
    SETTING_KEY_TIMER_HEIGHT
} from './db.js';

const SYNC_KEYS = {
    CATEGORIES: 'sync_categories',
    ALARMS: 'sync_alarms',
    SETTINGS: 'sync_settings',
    LOGS: 'sync_logs',
    BUSINESS_DAYS: 'sync_business_days',
    LAST_SYNC: 'sync_last_time'
};

const MAX_SYNC_LOGS = 50;
let isInternalUpdate = false;

export async function isSessionSyncEnabled() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return false;
    const setting = await dbGet(STORE_SETTINGS, SETTING_KEY_SESSION_SYNC);
    return !!(setting && setting.value);
}

/**
 * Pushes local data to chrome.storage.sync.
 * @param {Object} state Current application state
 */
export async function pushToCloud(state) {
    if (isInternalUpdate) return;
    if (!(await isSessionSyncEnabled())) return;

    const categories = state.categories || await dbGetAll(STORE_CATEGORIES);
    const alarms = state.alarms || await dbGetAll(STORE_ALARMS);
    const allLogs = await dbGetAll(STORE_LOGS);
    const recentLogs = allLogs.sort((a, b) => b.startTime - a.startTime).slice(0, MAX_SYNC_LOGS);

    const syncTime = Date.now();
    const syncData = {
        [SYNC_KEYS.CATEGORIES]: categories,
        [SYNC_KEYS.ALARMS]: alarms,
        [SYNC_KEYS.SETTINGS]: {
            theme: state.theme,
            font: state.font,
            animation: state.animation,
            language: state.language,
            reportSettings: state.reportSettings,
            timerHeight: state.timerHeight
        },
        [SYNC_KEYS.BUSINESS_DAYS]: state.businessDays,
        [SYNC_KEYS.LOGS]: recentLogs,
        [SYNC_KEYS.LAST_SYNC]: syncTime
    };

    // Update local last pulled time to prevent redundant pull from onChanged
    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LAST_PULLED_SYNC_TIME, value: syncTime });

    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(syncData, () => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
        });
    });
}

/**
 * Pulls data from chrome.storage.sync and updates local database.
 */
export async function pullFromCloud() {
    if (!(await isSessionSyncEnabled())) return;
    if (isInternalUpdate) return;

    isInternalUpdate = true;
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(null, async (data) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }

            try {
                // loop protection: check if remote data is actually newer than what we last pulled
                const remoteSyncTime = data[SYNC_KEYS.LAST_SYNC] || 0;
                const lastPulled = (await dbGet(STORE_SETTINGS, SETTING_KEY_LAST_PULLED_SYNC_TIME))?.value || 0;

                if (remoteSyncTime <= lastPulled) {
                    resolve();
                    return;
                }

                // 1. Settings
                if (data[SYNC_KEYS.SETTINGS]) {
                    const settings = data[SYNC_KEYS.SETTINGS];
                    const keysMap = {
                        theme: SETTING_KEY_THEME,
                        font: SETTING_KEY_FONT,
                        animation: SETTING_KEY_ANIMATION,
                        language: SETTING_KEY_LANGUAGE,
                        reportSettings: SETTING_KEY_REPORT_SETTINGS,
                        timerHeight: SETTING_KEY_TIMER_HEIGHT
                    };
                    for (const [sKey, dbKey] of Object.entries(keysMap)) {
                        if (settings[sKey] !== undefined) {
                            await dbPut(STORE_SETTINGS, { key: dbKey, value: settings[sKey] });
                        }
                    }
                }

                if (data[SYNC_KEYS.BUSINESS_DAYS]) {
                    await dbPut(STORE_SETTINGS, { key: SETTING_KEY_BUSINESS_DAYS, value: data[SYNC_KEYS.BUSINESS_DAYS] });
                }

                const db = await openDatabase();

                // 2. Categories (Overwrite to maintain order and exact set)
                if (data[SYNC_KEYS.CATEGORIES]) {
                    const remoteCats = data[SYNC_KEYS.CATEGORIES];
                    if (Array.isArray(remoteCats)) {
                        await new Promise((res, rej) => {
                            const t = db.transaction(STORE_CATEGORIES, 'readwrite');
                            const s = t.objectStore(STORE_CATEGORIES);
                            s.clear();
                            remoteCats.forEach(c => {
                                const copy = { ...c };
                                delete copy.id;
                                s.add(copy);
                            });
                            t.oncomplete = () => res();
                            t.onerror = () => rej(t.error);
                        });
                    }
                }

                // 3. Alarms (Overwrite)
                if (data[SYNC_KEYS.ALARMS]) {
                    const remoteAlarms = data[SYNC_KEYS.ALARMS];
                    if (Array.isArray(remoteAlarms)) {
                        await new Promise((res, rej) => {
                            const t = db.transaction(STORE_ALARMS, 'readwrite');
                            const s = t.objectStore(STORE_ALARMS);
                            s.clear();
                            remoteAlarms.forEach(a => s.add(a));
                            t.oncomplete = () => res();
                            t.onerror = () => rej(t.error);
                        });
                    }
                }

                // 4. Logs (Merge)
                if (data[SYNC_KEYS.LOGS]) {
                    await mergeLogs(data[SYNC_KEYS.LOGS]);
                }

                await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LAST_PULLED_SYNC_TIME, value: remoteSyncTime });
                resolve();
            } catch (err) {
                reject(err);
            } finally {
                isInternalUpdate = false;
            }
        });
    });
}

/**
 * Merges remote logs into local database.
 * Updates local entries if remote has more data (e.g. endTime).
 * @param {Array} remoteLogs
 * Exported for testing purposes only.
 */
export async function mergeLogs(remoteLogs) {
    const localLogs = await dbGetAll(STORE_LOGS);
    const localMap = new Map(localLogs.map(l => [`${l.startTime}|${l.category}`, l]));

    const newLogs = [];
    const logsToUpdate = [];

    for (const rl of remoteLogs) {
        const key = `${rl.startTime}|${rl.category}`;
        const local = localMap.get(key);

        if (!local) {
            const logCopy = { ...rl };
            delete logCopy.id;
            newLogs.push(logCopy);
        } else {
            // Update if remote has endTime and local doesn't, or other significant changes
            let changed = false;
            if (rl.endTime && !local.endTime) {
                local.endTime = rl.endTime;
                changed = true;
            }
            if (rl.memo !== undefined && rl.memo !== local.memo) {
                local.memo = rl.memo;
                changed = true;
            }
            // Add other fields if necessary
            if (changed) {
                logsToUpdate.push(local);
            }
        }
    }

    if (newLogs.length > 0) {
        await dbAddMultiple(STORE_LOGS, newLogs);
    }

    if (logsToUpdate.length > 0) {
        const db = await openDatabase();
        await new Promise((res, rej) => {
            const t = db.transaction(STORE_LOGS, 'readwrite');
            const s = t.objectStore(STORE_LOGS);
            logsToUpdate.forEach(l => s.put(l));
            t.oncomplete = () => res();
            t.onerror = () => rej(t.error);
        });
    }
}
