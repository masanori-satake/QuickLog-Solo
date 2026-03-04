import { SYSTEM_CATEGORY_IDLE, SYSTEM_CATEGORY_PAGE_BREAK, getAutoStopTimeIfPassed } from './utils.js';
import { t, setLanguage } from './i18n.js';

export let DB_NAME = 'QuickLogSoloDB';
export const DB_VERSION = 1;

export function setDatabaseName(name) {
    DB_NAME = name;
}

export const STORE_LOGS = 'logs';
export const STORE_CATEGORIES = 'categories';
export const STORE_SETTINGS = 'settings';

export const SETTING_KEY_THEME = 'theme';
export const SETTING_KEY_FONT = 'font';
export const SETTING_KEY_ANIMATION = 'animation';
export const SETTING_KEY_PAUSE_STATE = 'pauseState';
export const SETTING_KEY_LANGUAGE = 'language';
export const SETTING_KEY_REPORT_SETTINGS = 'reportSettings';
export const SETTING_KEY_AUTO_STOP = 'autoStop';

const LOG_CLEANUP_THRESHOLD_MS = 40 * 24 * 60 * 60 * 1000;
const ORPHANED_TASK_MIN_DURATION_MS = 1000;

let db;

export function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_LOGS)) {
                db.createObjectStore(STORE_LOGS, { keyPath: 'id', autoIncrement: true });
            }

            if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
                const catStore = db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id', autoIncrement: true });
                catStore.createIndex('name', 'name', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            db.onversionchange = () => {
                db.close();
                db = null;
                console.warn('Database version changed or deletion requested. Closing connection.');
            };
            resolve(db);
        };
        request.onerror = (event) => reject(event.target.error);
        request.onblocked = () => {
            console.warn('Database connection blocked. Please close other tabs of this app.');
            // We don't reject here because onsuccess might still fire if the user closes other tabs
        };
    });
}

export function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Imports categories in a single transaction.
 * @param {Array} items
 * @param {string} importMode - 'append' or 'overwrite'
 */
export function dbImportCategories(items, importMode) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction([STORE_CATEGORIES], 'readwrite');
        const store = tx.objectStore(STORE_CATEGORIES);

        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);

        const performImport = (currentCategories) => {
            let maxOrder = currentCategories.reduce((max, c) => Math.max(max, c.order || 0), -1);
            for (const item of items) {
                if (item.type === 'page-break') {
                    store.add({
                        name: `${SYSTEM_CATEGORY_PAGE_BREAK}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        order: ++maxOrder
                    });
                } else if (item.name) {
                    if (importMode === 'append') {
                        const existing = currentCategories.find(c => c.name === item.name);
                        if (existing) continue;
                    }
                    store.add({
                        name: item.name,
                        color: item.color || 'primary',
                        order: ++maxOrder,
                        tags: item.tags || '',
                        animation: item.animation || 'default'
                    });
                }
            }
        };

        if (importMode === 'overwrite') {
            store.clear();
            performImport([]);
        } else {
            const getAllReq = store.getAll();
            getAllReq.onsuccess = () => performImport(getAllReq.result);
        }
    });
}

export function dbGetByName(storeName, name) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index('name');
        const request = index.get(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function dbPut(storeName, value) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function dbAdd(storeName, value) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

export async function initDB() {
    await openDatabase();
    const language = await dbGet(STORE_SETTINGS, SETTING_KEY_LANGUAGE);
    await setupInitialData(language ? language.value : 'auto');
    const settings = await getCurrentAppState();
    await cleanupOldLogs();
    return settings;
}

export async function getCurrentAppState() {
    const theme = await dbGet(STORE_SETTINGS, SETTING_KEY_THEME);
    const font = await dbGet(STORE_SETTINGS, SETTING_KEY_FONT);
    const animation = await dbGet(STORE_SETTINGS, SETTING_KEY_ANIMATION);
    const language = await dbGet(STORE_SETTINGS, SETTING_KEY_LANGUAGE);
    const reportSettings = await dbGet(STORE_SETTINGS, SETTING_KEY_REPORT_SETTINGS);
    const autoStop = await dbGet(STORE_SETTINGS, SETTING_KEY_AUTO_STOP);
    const categories = await dbGetAll(STORE_CATEGORIES);

    const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    let activeTask;

    if (pauseStateSetting) {
        activeTask = pauseStateSetting.value;
    } else {
        const allLogs = await dbGetAll(STORE_LOGS);
        const openTasks = allLogs.filter(log => !log.endTime).sort((a, b) => b.startTime - a.startTime);
        activeTask = openTasks[0];
    }

    return {
        theme: theme ? theme.value : null,
        font: font ? font.value : null,
        animation: animation ? animation.value : 'matrix_code',
        language: language ? language.value : 'auto',
        reportSettings: reportSettings ? reportSettings.value : null,
        autoStop: autoStop ? autoStop.value : true,
        categories: categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        activeTask
    };
}

async function setupInitialData(languageSetting) {
    setLanguage(languageSetting);

    const autoStopSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_AUTO_STOP);
    if (autoStopSetting === undefined) {
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_AUTO_STOP, value: true });
    }

    const initialCategories = [
        { name: t('init-cat-dev'), color: 'primary', animation: 'none', tags: '' },
        { name: t('init-cat-meeting'), color: 'secondary', animation: 'default', tags: '' },
        { name: t('init-cat-research'), color: 'tertiary', animation: 'matrix_code', tags: '' },
        { name: t('init-cat-admin'), color: 'neutral', animation: 'migrating_birds', tags: '' },
        { name: t('init-cat-focus'), color: 'error', animation: 'ripple', tags: '' },
        { name: t('init-cat-skill'), color: 'tertiary', animation: 'dot_typing', tags: '' },
        { name: t('init-cat-idea'), color: 'secondary', animation: 'spectrum', tags: '' },
        { name: t('init-cat-break'), color: 'outline', animation: 'coffee_drip', tags: '' },
        { name: t('init-cat-client'), color: 'primary', animation: 'car_drive', tags: '' },
        { name: t('init-cat-doc'), color: 'secondary', animation: 'left_to_right', tags: '' },
        { name: t('init-cat-design'), color: 'tertiary', animation: 'contour_lines', tags: '' },
        { name: t('init-cat-bug'), color: 'error', animation: 'tetris_building', tags: '' },
        { name: t('init-cat-release'), color: 'teal', animation: 'night_sky', tags: '' },
        { name: t('init-cat-tool'), color: 'green', animation: 'open_reel', tags: '' },
        { name: t('init-cat-schedule'), color: 'yellow', animation: 'sand_clock', tags: '' },
        { name: t('init-cat-chat'), color: 'orange', animation: 'clock', tags: '' },
        { name: t('init-cat-wiki'), color: 'pink', animation: 'cats', tags: '' },
        { name: t('init-cat-qa'), color: 'indigo', animation: 'hero_pot', tags: '' },
        { name: t('init-cat-sales'), color: 'brown', animation: 'right_to_left', tags: '' },
        { name: t('init-cat-arch'), color: 'cyan', animation: 'smoke', tags: '' },
        { name: t('init-cat-sec'), color: 'error', animation: 'heart_beat', tags: '' },
        { name: t('init-cat-data'), color: 'teal', animation: 'newtons_cradle', tags: '' },
        { name: t('init-cat-wfh'), color: 'neutral', animation: 'matrix_code', tags: '' },
        { name: t('init-cat-move'), color: 'outline', animation: 'migrating_birds', tags: '' }
    ];

    let existingCategories = await dbGetAll(STORE_CATEGORIES);
    if (existingCategories.length === 0) {
        for (let i = 0; i < initialCategories.length; i++) {
            const cat = initialCategories[i];
            cat.order = i;
            await dbPut(STORE_CATEGORIES, cat);
        }
    }

    const allLogs = await dbGetAll(STORE_LOGS);

    const autoStopStatus = await dbGet(STORE_SETTINGS, SETTING_KEY_AUTO_STOP);
    const isAutoStopEnabled = autoStopStatus ? autoStopStatus.value : true;

    let openTasks = allLogs.filter(log => !log.endTime).sort((a, b) => b.startTime - a.startTime);

    // Auto-stop repair
    if (isAutoStopEnabled) {
        for (const task of openTasks) {
            const stopTime = getAutoStopTimeIfPassed(task.startTime);
            if (stopTime) {
                task.endTime = stopTime;
                await dbPut(STORE_LOGS, task);
            }
        }
        // Refresh openTasks after auto-stop
        openTasks = (await dbGetAll(STORE_LOGS)).filter(log => !log.endTime).sort((a, b) => b.startTime - a.startTime);
    }

    const activeTaskFromLogs = openTasks[0];

    // Auto-repair for idle tasks in logs (sync pauseState with logs)
    if (activeTaskFromLogs && activeTaskFromLogs.category === SYSTEM_CATEGORY_IDLE) {
        const pauseState = {
            id: activeTaskFromLogs.id,
            category: SYSTEM_CATEGORY_IDLE,
            startTime: activeTaskFromLogs.startTime,
            resumableCategory: activeTaskFromLogs.resumableCategory,
            isPaused: true
        };
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: pauseState });
    }

    const finalPauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    const activeTask = finalPauseStateSetting ? finalPauseStateSetting.value : activeTaskFromLogs;

    // Ensure only one active task remains
    const hasPauseState = activeTask && activeTask.isPaused;
    const startIndex = hasPauseState ? 0 : 1;
    if (openTasks.length > startIndex) {
        for (let i = startIndex; i < openTasks.length; i++) {
            const orphaned = openTasks[i];
            if (hasPauseState && orphaned.category === SYSTEM_CATEGORY_IDLE && orphaned.startTime === activeTask.startTime) continue;

            orphaned.endTime = orphaned.startTime + ORPHANED_TASK_MIN_DURATION_MS;
            await dbPut(STORE_LOGS, orphaned);
        }
    }

    // Generate dummy history if no logs exist
    if ((await dbGetAll(STORE_LOGS)).length === 0) {
        await generateDummyHistory();
    }
}

async function generateDummyHistory() {
    console.log('QuickLog-Solo: Generating dummy history...');

    const CONFIG = {
        DAYS_OFFSET: [1, 3, 5], // Non-consecutive days (e.g., Mon, Wed, Fri)
        WORK_START_H: 8,
        WORK_START_M: 30,
        WORK_END_H: 17,
        WORK_END_M: 30,
        LUNCH_START_H: 12,
        LUNCH_START_M: 30,
        LUNCH_DURATION_MINS: 60,
        TIME_JITTER_MIN: 3,
        TIME_JITTER_MAX: 7,
        LUNCH_JITTER_MIN: 2,
        LUNCH_JITTER_MAX: 5,
        TASKS_PER_DAY_MIN: 5,
        TASKS_PER_DAY_MAX: 7,
        MORNING_TASK_COUNT: 2,
        TASK_TIME_VARIATION: 0.2, // e.g., 0.2 means +/- 20%
    };

    const categories = await dbGetAll(STORE_CATEGORIES);
    const workCategories = categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE);

    if (workCategories.length === 0) return;

    const createJitter = (min, max) => (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * (max - min + 1)) + min);

    for (const offset of CONFIG.DAYS_OFFSET) {
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - offset);
        baseDate.setHours(0, 0, 0, 0);

        const baseTime = baseDate.getTime();
        const toMillis = (h, m) => (h * 60 + m) * 60 * 1000;

        const startJitter = createJitter(CONFIG.TIME_JITTER_MIN, CONFIG.TIME_JITTER_MAX);
        const startTime = baseTime + toMillis(CONFIG.WORK_START_H, CONFIG.WORK_START_M) + startJitter * 60 * 1000;

        const endJitter = createJitter(CONFIG.TIME_JITTER_MIN, CONFIG.TIME_JITTER_MAX);
        const endTime = baseTime + toMillis(CONFIG.WORK_END_H, CONFIG.WORK_END_M) + endJitter * 60 * 1000;

        const lunchJitter = createJitter(CONFIG.LUNCH_JITTER_MIN, CONFIG.LUNCH_JITTER_MAX);
        const lunchStart = baseTime + toMillis(CONFIG.LUNCH_START_H, CONFIG.LUNCH_START_M) + lunchJitter * 60 * 1000;
        const lunchEnd = lunchStart + CONFIG.LUNCH_DURATION_MINS * 60 * 1000;

        const numTasks = Math.floor(Math.random() * (CONFIG.TASKS_PER_DAY_MAX - CONFIG.TASKS_PER_DAY_MIN + 1)) + CONFIG.TASKS_PER_DAY_MIN;
        const morningCount = CONFIG.MORNING_TASK_COUNT;
        const afternoonCount = numTasks - morningCount;

        let lastCategoryName = null;

        const generateTasks = async (start, end, count, isMorning) => {
            let current = start;
            for (let i = 0; i < count; i++) {
                const remainingTasks = count - i;
                const timePerTask = (end - current) / remainingTasks;
                const variation = 1 - CONFIG.TASK_TIME_VARIATION + Math.random() * 2 * CONFIG.TASK_TIME_VARIATION;
                const taskEnd = i === count - 1 ? end : current + timePerTask * variation;

                const isFirstOfDay = isMorning && i === 0;
                let cat;
                if (isFirstOfDay) {
                    cat = { name: t('demo-warning'), color: 'error' };
                } else {
                    // Avoid consecutive identical categories
                    const candidates = workCategories.filter(c => c.name !== lastCategoryName);
                    cat = candidates[Math.floor(Math.random() * candidates.length)];
                }
                lastCategoryName = cat.name;

                await dbAdd(STORE_LOGS, {
                    category: cat.name,
                    startTime: Math.floor(current),
                    endTime: Math.floor(taskEnd),
                    color: cat.color || 'primary'
                });
                current = taskEnd;
            }
        };

        // Morning Tasks
        await generateTasks(startTime, lunchStart, morningCount, true);

        // Lunch Break
        await dbAdd(STORE_LOGS, {
            category: SYSTEM_CATEGORY_IDLE,
            startTime: Math.floor(lunchStart),
            endTime: Math.floor(lunchEnd)
        });
        // We do NOT reset lastCategoryName to SYSTEM_CATEGORY_IDLE here,
        // so that the first afternoon task avoids the last morning task's category.

        // Afternoon Tasks
        await generateTasks(lunchEnd, endTime, afternoonCount, false);

        // Final Stop Marker
        // Use SYSTEM_CATEGORY_IDLE for consistency with logic.js and ensuring visibility in UI
        await dbAdd(STORE_LOGS, {
            category: SYSTEM_CATEGORY_IDLE,
            startTime: Math.floor(endTime),
            endTime: Math.floor(endTime),
            isManualStop: true
        });
    }
}

async function cleanupOldLogs() {
    const cleanupThresholdTime = Date.now() - LOG_CLEANUP_THRESHOLD_MS;
    const logs = await dbGetAll(STORE_LOGS);
    for (const log of logs) {
        if (log.startTime < cleanupThresholdTime) {
            await dbDelete(STORE_LOGS, log.id);
        }
    }
}
