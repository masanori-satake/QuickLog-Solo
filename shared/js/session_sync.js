import {
    dbGetAll, dbPut, dbGet, openDatabase,
    STORE_LOGS, STORE_CATEGORIES, STORE_SETTINGS, STORE_ALARMS,
    SETTING_KEY_SESSION_SYNC, SETTING_KEY_LAST_PULLED_SYNC_TIME,
    SETTING_KEY_THEME, SETTING_KEY_FONT, SETTING_KEY_ANIMATION,
    SETTING_KEY_LANGUAGE, SETTING_KEY_REPORT_SETTINGS, SETTING_KEY_BUSINESS_DAYS,
    SETTING_KEY_TIMER_HEIGHT, SETTING_KEY_PAUSE_STATE, SETTING_KEY_CLIENT_ID,
    SETTING_KEY_DELETED_SYNC_IDS
} from './db.js';
import { SYSTEM_CATEGORY_IDLE, SYSTEM_CATEGORY_UNKNOWN, generateUUID } from './utils.js';

const SYNC_KEYS = {
    CATEGORIES: 'sync_categories',
    ALARMS: 'sync_alarms',
    SETTINGS: 'sync_settings',
    LOGS_PREFIX: 'sync_logs_v2_', // Changed prefix to avoid collision with old format
    BUSINESS_DAYS: 'sync_business_days',
    LAST_SYNC: 'sync_last_time',
    CLIENT_ID: 'sync_client_id',
    PAUSE_STATE: 'sync_pause_state',
    DELETED_IDS: 'sync_deleted_ids'
};

const MAX_SYNC_LOGS = 50;
const LOG_CHUNKS = 5;
const CHUNK_SIZE = Math.ceil(MAX_SYNC_LOGS / LOG_CHUNKS);

let isInternalUpdate = false;
let activePullPromise = null;

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

    const deletedSyncIds = (await dbGet(STORE_SETTINGS, SETTING_KEY_DELETED_SYNC_IDS))?.value || [];

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
        [SYNC_KEYS.PAUSE_STATE]: state.activeTask, // Sync active task as pauseState
        [SYNC_KEYS.DELETED_IDS]: deletedSyncIds
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
 * @returns {Promise<boolean>} True if data was updated, false otherwise.
 */
/**
 * Applies settings and categories from the provided data object to the local database.
 * @param {Object} data
 */
async function applyRemoteSettings(data) {
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
}

/**
 * Applies the remote pause state to the local database.
 * @param {Object} data
 */
async function applyRemotePauseState(data) {
    if (SYNC_KEYS.PAUSE_STATE in data) {
        const remoteActiveTask = data[SYNC_KEYS.PAUSE_STATE];
        if (remoteActiveTask) {
            await syncActiveTask(remoteActiveTask);
        } else {
            await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: null });
        }
    }
}

/**
 * Extracts and combines logs from the sync data object.
 * @param {Object} data
 * @returns {Array} Combined logs
 */
function extractLogsFromData(data) {
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
    return combinedLogs;
}

/**
 * Records a syncId as deleted in the local database.
 * @param {string} syncId
 */
export async function recordDeletedSyncId(syncId) {
    if (!syncId) return;
    const rawValue = (await dbGet(STORE_SETTINGS, SETTING_KEY_DELETED_SYNC_IDS))?.value;
    const current = Array.isArray(rawValue) ? rawValue : [];
    if (!current.includes(syncId)) {
        current.push(syncId);
        // Keep only last 100 deletions
        const trimmed = current.slice(-100);
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_DELETED_SYNC_IDS, value: trimmed });
    }
}

export async function pullFromCloud() {
    if (!(await isSessionSyncEnabled())) return false;
    if (activePullPromise) return activePullPromise;

    activePullPromise = new Promise((resolve, reject) => {
        isInternalUpdate = true;
        chrome.storage.sync.get(null, async (data) => {
            if (chrome.runtime.lastError) {
                isInternalUpdate = false;
                activePullPromise = null;
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
                    resolve(false);
                    return;
                }

                // Clock skew protection: only pull if remote data timestamp is different from what we last pulled.
                // We skip only when timestamps are exactly equal, allowing synchronization even if device clocks are skewed.
                if (remoteSyncTime === lastPulled) {
                    resolve(false);
                    return;
                }

                await applyRemoteSettings(data);

                // 4. Logs (Merge)
                const combinedLogs = extractLogsFromData(data);
                const remoteDeletedIds = data[SYNC_KEYS.DELETED_IDS] || [];

                if (combinedLogs.length > 0 || remoteDeletedIds.length > 0) {
                    await mergeLogs(combinedLogs, false, remoteDeletedIds);
                }

                // 5. Pause State (Active Task)
                await applyRemotePauseState(data);

                await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LAST_PULLED_SYNC_TIME, value: remoteSyncTime });
                resolve(true);
            } catch (err) {
                console.error('QuickLog-Solo: Sync pull failed', err);
                reject(err);
            } finally {
                isInternalUpdate = false;
                activePullPromise = null;
            }
        });
    });
    return activePullPromise;
}

/**
 * Performs initial synchronization based on user-selected modes.
 * @param {string} settingsMode
 * @param {string} historyMode
 */
export async function performInitialSync(settingsMode, historyMode) {
    isInternalUpdate = true;
    try {
        const data = await new Promise((resolve, reject) => {
            chrome.storage.sync.get(null, (res) => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve(res);
            });
        });

        // 1. Settings & Categories
        if (settingsMode === 'cloud-to-local') {
            await applyRemoteSettings(data);
        }

        // 2. History
        if (historyMode === 'cloud-to-local') {
            const combinedLogs = extractLogsFromData(data);
            const remoteDeletedIds = data[SYNC_KEYS.DELETED_IDS] || [];
            await mergeLogs(combinedLogs, true, remoteDeletedIds);
        } else if (historyMode === 'merge') {
            const combinedLogs = extractLogsFromData(data);
            const remoteDeletedIds = data[SYNC_KEYS.DELETED_IDS] || [];
            if (combinedLogs.length > 0 || remoteDeletedIds.length > 0) {
                await mergeLogs(combinedLogs, false, remoteDeletedIds);
            }
        }

        // Finalize pause state from cloud if cloud-to-local was chosen for either settings or history
        if (settingsMode === 'cloud-to-local' || historyMode === 'cloud-to-local') {
            await applyRemotePauseState(data);
        }

        // 3. Establish this client as current and update last pulled time.
        const remoteSyncTime = data[SYNC_KEYS.LAST_SYNC] || 0;
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_LAST_PULLED_SYNC_TIME, value: remoteSyncTime });

        // settingsMode または historyMode が 'cloud-to-local' 以外（'local-to-cloud' や 'merge'）の場合、
        // ローカルの変更をクラウドに即座に反映させる必要があります。
        if (settingsMode !== 'cloud-to-local' || historyMode !== 'cloud-to-local') {
            isInternalUpdate = false;
            const { getCurrentAppState } = await import('./db.js');
            const updatedState = await getCurrentAppState();
            await pushToCloud(updatedState);
            isInternalUpdate = true;
        }

    } finally {
        isInternalUpdate = false;
    }
}

/**
 * Merges remote logs into local database using complex timeline logic.
 * @param {Array} remoteLogs
 * @param {boolean} overwrite If true, ignores local logs and uses remote logs as basis for timeline.
 * @param {string[]} remoteDeletedIds List of syncIds that were deleted remotely.
 */
export async function mergeLogs(remoteLogs, overwrite = false, remoteDeletedIds = []) {
    const localLogs = await dbGetAll(STORE_LOGS);

    // Remove remote local IDs to prevent collision
    const sanitizedRemoteLogs = remoteLogs.map(l => {
        const copy = { ...l };
        delete copy.id;
        return copy;
    });

    let combined;
    if (overwrite) {
        combined = sanitizedRemoteLogs;
    } else {
        const localDeletedIds = (await dbGet(STORE_SETTINGS, SETTING_KEY_DELETED_SYNC_IDS))?.value;
        const safeLocalDeleted = Array.isArray(localDeletedIds) ? localDeletedIds : [];
        const safeRemoteDeleted = Array.isArray(remoteDeletedIds) ? remoteDeletedIds : [];
        const allDeletedIds = new Set([...safeLocalDeleted, ...safeRemoteDeleted]);

        const filteredRemote = sanitizedRemoteLogs.filter(l => !allDeletedIds.has(l.syncId));
        const filteredLocal = localLogs.filter(l => !allDeletedIds.has(l.syncId));
        combined = [...filteredLocal, ...filteredRemote];
    }
    // Fill gaps only when merging, not when overwriting from cloud
    const reconstructed = reconstructTimeline(combined, !overwrite);

    const db = await openDatabase();
    await new Promise((res, rej) => {
        const t = db.transaction(STORE_LOGS, 'readwrite');
        const s = t.objectStore(STORE_LOGS);

        const reconstructedIds = new Set();
        const usedIdsInThisTransaction = new Set();

        reconstructed.forEach(l => {
            const copy = { ...l };
            if (copy.id && !usedIdsInThisTransaction.has(copy.id)) {
                usedIdsInThisTransaction.add(copy.id);
                reconstructedIds.add(copy.id);
                s.put(copy);
            } else {
                // If id is missing or already used (due to splits), let IndexedDB generate a new one
                delete copy.id;
                const req = s.add(copy);
                req.onsuccess = (e) => {
                    // Update the set so we don't accidentally delete this new log
                    reconstructedIds.add(e.target.result);
                };
            }
        });

        // Delete logs that are no longer in the reconstructed timeline
        localLogs.forEach(local => {
            if (local.id && !reconstructedIds.has(local.id)) {
                s.delete(local.id);
            }
        });

        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
    });
}

/**
 * Reconstructs the timeline by filling gaps with Unknown and resolving overlaps.
 * @param {Array} allLogs
 * @param {boolean} fillGaps If true, gaps between logs are filled with "Unknown" tasks.
 * @returns {Array} New list of logs
 * Exported for testing purposes only.
 */
export function reconstructTimeline(allLogs, fillGaps = true) {
    if (allLogs.length === 0) return [];

    // 1. Resolve conflicts and deduplicate
    // Use syncId if available, otherwise fallback to legacy key (startTime + category)
    const byId = new Map();
    allLogs.forEach(l => {
        const id = l.syncId || `legacy-${l.startTime}-${l.category}`;
        const existing = byId.get(id);
        // Prefer logs with endTime.
        // If both have/don't have endTime, prefer the one with the latest updatedAt timestamp.
        const lHasEndTime = !!l.endTime;
        const eHasEndTime = existing ? !!existing.endTime : false;

        if (!existing || (lHasEndTime && !eHasEndTime)) {
            byId.set(id, l);
        } else if (lHasEndTime === eHasEndTime) {
            const lUpdated = l.updatedAt || 0;
            const eUpdated = existing.updatedAt || 0;
            if (lUpdated >= eUpdated) {
                byId.set(id, l);
            }
        }
    });

    // Ensure every log has a syncId for the rest of the process
    const uniqueLogs = Array.from(byId.values()).map(l => {
        const copy = { ...l };
        if (!copy.syncId) copy.syncId = generateUUID();
        return copy;
    });

    // 2. Separate log types
    // Solid logs: have duration and are not markers.
    const solidLogs = uniqueLogs.filter(l => l.endTime && l.endTime > l.startTime && !l.isManualStop);
    // Markers: manual stop or zero-duration logs.
    const markers = uniqueLogs.filter(l => l.isManualStop || (l.endTime && l.endTime === l.startTime));
    // Open tasks: no endTime.
    const openTasks = uniqueLogs.filter(l => !l.endTime);

    if (solidLogs.length === 0) {
        return [...markers, ...openTasks].sort((a, b) => a.startTime - b.startTime);
    }

    // 3. Collect and sort all relevant timestamps for segmenting
    const tsSet = new Set();
    solidLogs.forEach(l => {
        tsSet.add(l.startTime);
        tsSet.add(l.endTime);
    });
    // Markers also act as split points
    markers.forEach(m => tsSet.add(m.startTime));
    const sortedTs = Array.from(tsSet).sort((a, b) => a - b);

    // 4. Create segments between consecutive timestamps
    const segments = [];
    for (let i = 0; i < sortedTs.length - 1; i++) {
        const start = sortedTs[i];
        const end = sortedTs[i + 1];
        if (start === end) continue;

        const covering = solidLogs.filter(l => l.startTime <= start && l.endTime >= end);

        if (covering.length === 0) {
            // Gap detected
            if (fillGaps) {
                // Point 2: Do not insert Unknown if the gap starts after a manual stop marker.
                // We check if a manual stop exists at or before the current gap start,
                // and ensure no solid (actual work) logs exist between that manual stop and the current gap.
                const isAfterManualStop = markers.some(m =>
                    m.isManualStop &&
                    m.startTime <= start &&
                    !solidLogs.some(l => l.startTime >= m.startTime && l.endTime <= start)
                );
                if (!isAfterManualStop) {
                    segments.push({
                        category: SYSTEM_CATEGORY_UNKNOWN,
                        startTime: start,
                        endTime: end,
                        syncId: `unknown-${start}-${end}`
                    });
                }
            }
        } else if (covering.length === 1) {
            segments.push({ ...covering[0], startTime: start, endTime: end });
        } else {
            // Overlap detected. Prioritize contained side.
            let best = null;
            let conflict = false;

            for (const l of covering) {
                let isContainedByAllOthers = true;
                for (const other of covering) {
                    if (l === other) continue;
                    // Does other contain l?
                    const otherContainsL = (other.startTime <= l.startTime && other.endTime >= l.endTime);
                    if (!otherContainsL) {
                        isContainedByAllOthers = false;
                        break;
                    }
                }
                if (isContainedByAllOthers) {
                    if (best) {
                        // If multiple logs claim containment, pick the smallest range
                        if (best.startTime === l.startTime && best.endTime === l.endTime) {
                            if (best.category !== l.category) conflict = true;
                        } else if ((l.endTime - l.startTime) < (best.endTime - best.startTime)) {
                            best = l;
                        }
                    } else {
                        best = l;
                    }
                }
            }

            if (best && !conflict) {
                segments.push({ ...best, startTime: start, endTime: end });
            } else if (fillGaps) {
                // Partial overlap or ambiguous containment -> Unknown
                segments.push({
                    category: SYSTEM_CATEGORY_UNKNOWN,
                    startTime: start,
                    endTime: end,
                    syncId: `unknown-${start}-${end}`
                });
            }
        }
    }

    // 5. Merge adjacent segments with identical metadata
    const merged = [];
    for (const seg of segments) {
        const last = merged[merged.length - 1];
        // Split at markers
        const hasMarkerAtBoundary = markers.some(m => m.startTime === seg.startTime);

        if (last && !hasMarkerAtBoundary &&
            last.category === seg.category &&
            last.memo === seg.memo &&
            last.tags === seg.tags &&
            last.color === seg.color &&
            last.resumableCategory === seg.resumableCategory) {
            last.endTime = seg.endTime;
            // Stable ID for merged Unknown logs
            if (last.category === SYSTEM_CATEGORY_UNKNOWN) {
                last.syncId = `unknown-${last.startTime}-${last.endTime}`;
            }
        } else {
            merged.push({ ...seg });
        }
    }

    // Ensure syncId uniqueness if a log was split
    const syncIdCounts = new Map();
    merged.forEach(l => {
        const count = (syncIdCounts.get(l.syncId) || 0) + 1;
        syncIdCounts.set(l.syncId, count);
        if (count > 1) {
            l.syncId = `${l.syncId}-${count}`;
        }
    });

    return [...merged, ...markers, ...openTasks].sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime - b.startTime;
        // At same timestamp, put markers after logs that end there, and before logs that start there.
        // For merged segments: log1 ends at 2000, marker at 2000, log2 starts at 2000.
        // We want log1, marker, log2.
        if (a.isManualStop && b.endTime === a.startTime) return 1; // a (marker) after b
        if (b.isManualStop && a.endTime === b.startTime) return -1; // a before b (marker)
        if (a.endTime === b.startTime) return -1; // a before b
        if (a.startTime === b.endTime) return 1; // a after b
        return 0;
    });
}

/**
 * Synchronizes the active task (pause state) from remote.
 * Finds or creates the corresponding local log entry.
 * @param {Object} remoteActiveTask
 * Exported for testing purposes only.
 */
export async function syncActiveTask(remoteActiveTask) {
    const localLogs = await dbGetAll(STORE_LOGS);
    // Find matching log in local DB (by syncId, or legacy startTime/category)
    const matchingLog = localLogs.find(l => {
        if (remoteActiveTask.syncId && l.syncId === remoteActiveTask.syncId) return true;
        return l.startTime === remoteActiveTask.startTime && l.category === remoteActiveTask.category;
    });

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
