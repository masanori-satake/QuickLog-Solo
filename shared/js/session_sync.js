import {
    dbGetAll, dbPut, dbAddMultiple, dbGet, openDatabase,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS,
    SETTING_KEY_SESSION_SYNC, SETTING_KEY_LAST_PULLED_SYNC_TIME,
    SETTING_KEY_THEME, SETTING_KEY_FONT, SETTING_KEY_ANIMATION,
    SETTING_KEY_LANGUAGE, SETTING_KEY_REPORT_SETTINGS, SETTING_KEY_BUSINESS_DAYS,
    SETTING_KEY_TIMER_HEIGHT, SETTING_KEY_PAUSE_STATE, SETTING_KEY_CLIENT_ID
} from './db.js';
import { SYSTEM_CATEGORY_IDLE } from './utils.js';

const SYNC_KEYS = {
    CATEGORIES: 'sync_categories',
    ALARMS: 'sync_alarms',
    SETTINGS: 'sync_settings',
    LOGS_PREFIX: 'sync_logs_v2_', // Changed prefix to avoid collision with old format
    BUSINESS_DAYS: 'sync_business_days',
    LAST_SYNC: 'sync_last_time',
    CLIENT_ID: 'sync_client_id',
    PAUSE_STATE: 'sync_pause_state'
};

const MAX_SYNC_LOGS = 50;
const LOG_CHUNKS = 5;
const CHUNK_SIZE = Math.ceil(MAX_SYNC_LOGS / LOG_CHUNKS);

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
    const clientId = (await dbGet(STORE_SETTINGS, SETTING_KEY_CLIENT_ID))?.value;

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
        [SYNC_KEYS.LAST_SYNC]: syncTime,
        [SYNC_KEYS.CLIENT_ID]: clientId,
        [SYNC_KEYS.PAUSE_STATE]: state.activeTask // Sync active task as pauseState
    };

    // Split logs into chunks
    for (let i = 0; i < LOG_CHUNKS; i++) {
        const chunk = recentLogs.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        syncData[`${SYNC_KEYS.LOGS_PREFIX}${i}`] = chunk;
    }

    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(syncData, () => {
            if (chrome.runtime.lastError) {
                console.error('QuickLog-Solo: Sync push failed', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
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
                isInternalUpdate = false;
                reject(chrome.runtime.lastError);
                return;
            }

            try {
                const remoteSyncTime = data[SYNC_KEYS.LAST_SYNC] || 0;
                const remoteClientId = data[SYNC_KEYS.CLIENT_ID];
                const localClientId = (await dbGet(STORE_SETTINGS, SETTING_KEY_CLIENT_ID))?.value;
                const lastPulled = (await dbGet(STORE_SETTINGS, SETTING_KEY_LAST_PULLED_SYNC_TIME))?.value || 0;

                // Loop protection: skip if data was pushed by self
                if (remoteClientId === localClientId && localClientId !== undefined) {
                    resolve();
                    return;
                }

                // Clock skew protection: only pull if remote data is newer than what we last pulled
                // We add a small buffer (1s) to avoid micro-loops if clocks are jittery
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

                // 2. Categories (Overwrite)
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
                const combinedLogs = [];
                for (let i = 0; i < LOG_CHUNKS; i++) {
                    const chunk = data[`${SYNC_KEYS.LOGS_PREFIX}${i}`];
                    if (Array.isArray(chunk)) {
                        combinedLogs.push(...chunk);
                    }
                }
                // Fallback to old key if new format is not present (migration)
                if (combinedLogs.length === 0 && Array.isArray(data['sync_logs'])) {
                    combinedLogs.push(...data['sync_logs']);
                }

                if (combinedLogs.length > 0) {
                    await mergeLogs(combinedLogs);
                }

                // 5. Pause State (Active Task)
                if (SYNC_KEYS.PAUSE_STATE in data) {
                    const remoteActiveTask = data[SYNC_KEYS.PAUSE_STATE];
                    if (remoteActiveTask) {
                        await syncActiveTask(remoteActiveTask);
                    } else {
                        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: null });
                    }
                }

                await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LAST_PULLED_SYNC_TIME, value: remoteSyncTime });
                resolve();
            } catch (err) {
                console.error('QuickLog-Solo: Sync pull failed', err);
                reject(err);
            } finally {
                isInternalUpdate = false;
            }
        });
    });
}

/**
 * Merges remote logs into local database.
 * @param {Array} remoteLogs
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
            let changed = false;
            if (rl.endTime && !local.endTime) {
                local.endTime = rl.endTime;
                changed = true;
            }
            if (rl.memo !== undefined && rl.memo !== local.memo) {
                local.memo = rl.memo;
                changed = true;
            }
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

/**
 * Synchronizes the active task (pause state) from remote.
 * Finds or creates the corresponding local log entry.
 * @param {Object} remoteActiveTask
 */
async function syncActiveTask(remoteActiveTask) {
    const localLogs = await dbGetAll(STORE_LOGS);
    // Find matching log in local DB (by startTime and category)
    const matchingLog = localLogs.find(l =>
        l.startTime === remoteActiveTask.startTime &&
        l.category === remoteActiveTask.category
    );

    if (matchingLog) {
        const pauseState = {
            ...matchingLog,
            isPaused: remoteActiveTask.category === SYSTEM_CATEGORY_IDLE
        };
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: pauseState });
    } else if (!remoteActiveTask.endTime) {
        // If it's an active task and not found locally, it should have been merged already by mergeLogs.
        // If not found yet, we might need to wait or it might be a race condition.
        // For robustness, if it's truly an open task, we can just set it.
        const logCopy = { ...remoteActiveTask };
        delete logCopy.id;
        const id = await dbPut(STORE_LOGS, logCopy);
        logCopy.id = id;

        const pauseState = {
            ...logCopy,
            isPaused: remoteActiveTask.category === SYSTEM_CATEGORY_IDLE
        };
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: pauseState });
    }
}
