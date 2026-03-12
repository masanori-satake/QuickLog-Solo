import { SYSTEM_CATEGORY_IDLE, SYSTEM_CATEGORY_PAGE_BREAK, getAutoStopTimeIfPassed, isValidColor } from './utils.js';
import { t, setLanguage } from './i18n.js';

export let DB_NAME = 'QuickLogSoloDB';
export const DB_VERSION = 2;

export function setDatabaseName(name) {
    DB_NAME = name;
}

export const STORE_LOGS = 'logs';
export const STORE_CATEGORIES = 'categories';
export const STORE_SETTINGS = 'settings';
export const STORE_ALARMS = 'alarms';

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
let dbPromise = null;

/**
 * Opens the IndexedDB connection.
 * Returns a promise that resolves to the database instance.
 */
export function openDatabase() {
    if (dbPromise) return dbPromise;
    if (db) return Promise.resolve(db);

    dbPromise = new Promise((resolve, reject) => {
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

            if (!db.objectStoreNames.contains(STORE_ALARMS)) {
                db.createObjectStore(STORE_ALARMS, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            db.onversionchange = () => {
                db.close();
                db = null;
                dbPromise = null;
                console.warn('Database version changed or deletion requested. Closing connection.');
            };
            resolve(db);
        };
        request.onerror = (event) => {
            dbPromise = null;
            reject(event.target.error);
        };
        request.onblocked = () => {
            console.warn('Database connection blocked. Please close other tabs of this app.');
        };
    });
    return dbPromise;
}

export async function dbGet(storeName, key) {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function dbAddMultiple(storeName, items) {
    if (!items || items.length === 0) return;
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);

        for (const item of items) {
            store.add(item);
        }
    });
}

/**
 * Imports categories in a single transaction.
 * @param {Array} items
 * @param {string} importMode - 'append' or 'overwrite'
 */
export async function dbImportCategories(items, importMode) {
    await openDatabase();
    return new Promise((resolve, reject) => {
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
                    const color = (item.color && isValidColor(item.color)) ? item.color : 'primary';
                    store.add({
                        name: item.name,
                        color: color,
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

export async function dbGetByName(storeName, name) {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index('name');
        const request = index.get(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function dbClear(storeName) {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function dbGetAll(storeName) {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function dbPut(storeName, value) {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function dbAdd(storeName, value) {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.add(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function dbDelete(storeName, key) {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function dbCount(storeName) {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Finds the most recent active task (one without an endTime) without fetching all logs.
 * @returns {Promise<Object|null>}
 */
export async function dbGetActiveTask() {
    await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_LOGS, 'readonly');
        const store = tx.objectStore(STORE_LOGS);
        // Open cursor in reverse order (newest ID first)
        const request = store.openCursor(null, 'prev');
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const log = cursor.value;
                if (!log.endTime) {
                    resolve(log);
                } else {
                    // This is an optimization: usually the active task is among the most recent.
                    // If we don't find it immediately, we continue to the previous record.
                    cursor.continue();
                }
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
    dbPromise = null;
}

/**
 * Initializes the database.
 * @param {boolean} isLite - If true, skips heavy maintenance tasks like log cleanup and dummy data generation.
 */
export async function initDB(isLite = false) {
    await openDatabase();
    const languageSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_LANGUAGE);
    const lang = languageSetting ? languageSetting.value : 'auto';

    if (isLite) {
        setLanguage(lang);
    } else {
        await setupInitialData(lang);
        await cleanupOldLogs();
    }

    return await getCurrentAppState();
}

export async function getCurrentAppState() {
    const theme = await dbGet(STORE_SETTINGS, SETTING_KEY_THEME);
    const font = await dbGet(STORE_SETTINGS, SETTING_KEY_FONT);
    const animation = await dbGet(STORE_SETTINGS, SETTING_KEY_ANIMATION);
    const language = await dbGet(STORE_SETTINGS, SETTING_KEY_LANGUAGE);
    const reportSettings = await dbGet(STORE_SETTINGS, SETTING_KEY_REPORT_SETTINGS);
    const autoStop = await dbGet(STORE_SETTINGS, SETTING_KEY_AUTO_STOP);
    const categories = await dbGetAll(STORE_CATEGORIES);
    const alarms = await dbGetAll(STORE_ALARMS);

    const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    let activeTask;

    if (pauseStateSetting) {
        activeTask = pauseStateSetting.value;
    } else {
        activeTask = await dbGetActiveTask();
    }

    return {
        theme: theme ? theme.value : null,
        font: font ? font.value : null,
        animation: animation ? animation.value : 'digital_rain',
        language: language ? language.value : 'auto',
        reportSettings: reportSettings ? reportSettings.value : null,
        autoStop: autoStop ? autoStop.value : true,
        categories: categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        alarms: alarms.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
        activeTask
    };
}

async function setupInitialData(languageSetting) {
    setLanguage(languageSetting);

    const autoStopSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_AUTO_STOP);
    if (autoStopSetting === undefined) {
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_AUTO_STOP, value: true });
    }

    const animationOrder = [
        'none', 'default', 'digital_rain', 'migrating_birds', 'ripple',
        'dot_typing', 'spectrum', 'coffee_drip', 'car_drive', 'left_to_right',
        'contour_lines', 'tetris_building', 'night_sky', 'open_reel', 'sand_clock',
        'clock', 'cats', 'hero_pot', 'right_to_left', 'smoke',
        'heart_beat', 'newtons_cradle'
    ];

    const categoryDefs = [
        { name: t('init-cat-dev'), color: 'primary', tags: '開発, 設計' },
        { name: t('init-cat-meeting'), color: 'secondary', tags: '会議' },
        { name: t('init-cat-research'), color: 'tertiary', tags: '調査' },
        { name: t('init-cat-admin'), color: 'neutral', tags: '事務' },
        { name: t('init-cat-focus'), color: 'error', tags: '集中' },
        { name: t('init-cat-skill'), color: 'tertiary', tags: '自己研鑽' },
        { name: t('init-cat-idea'), color: 'secondary', tags: '企画' },
        { name: t('init-cat-break'), color: 'outline', tags: '' },
        { name: t('init-cat-client'), color: 'primary', tags: '顧客対応' },
        { name: t('init-cat-doc'), color: 'secondary', tags: 'ドキュメント, 報告' },
        { name: t('init-cat-design'), color: 'tertiary', tags: 'デザイン' },
        { name: t('init-cat-bug'), color: 'error', tags: 'バグ修正' },
        { name: t('init-cat-release'), color: 'teal', tags: 'リリース' },
        { name: t('init-cat-tool'), color: 'green', tags: 'ツール' },
        { name: t('init-cat-schedule'), color: 'yellow', tags: '管理' },
        { name: t('init-cat-chat'), color: 'orange', tags: 'チャット' },
        { name: t('init-cat-wiki'), color: 'pink', tags: 'ドキュメント' },
        { name: t('init-cat-qa'), color: 'indigo', tags: 'テスト' },
        { name: t('init-cat-sales'), color: 'brown', tags: '営業' },
        { name: t('init-cat-arch'), color: 'cyan', tags: '設計' },
        { name: t('init-cat-sec'), color: 'error', tags: 'セキュリティ' },
        { name: t('init-cat-data'), color: 'teal', tags: '分析' },
        { name: t('init-cat-wfh'), color: 'neutral', tags: '' },
        { name: t('init-cat-move'), color: 'outline', tags: '移動' }
    ];

    const initialCategories = categoryDefs.map((def, i) => ({
        ...def,
        animation: animationOrder[i],
        tags: def.tags || ''
    }));

    let existingCategories = await dbGetAll(STORE_CATEGORIES);
    if (existingCategories.length === 0) {
        for (let i = 0; i < initialCategories.length; i++) {
            const cat = initialCategories[i];
            cat.order = i;
            await dbPut(STORE_CATEGORIES, cat);
        }
    } else {
        // Migration: Ensure existing categories have tags and animation if missing
        const categoriesToUpdate = [];
        for (const cat of existingCategories) {
            let changed = false;
            if (cat.tags === undefined) {
                const def = initialCategories.find(d => d.name === cat.name);
                cat.tags = def ? def.tags : '';
                changed = true;
            }
            if (cat.animation === undefined) {
                const def = initialCategories.find(d => d.name === cat.name);
                cat.animation = def ? def.animation : 'default';
                changed = true;
            }
            if (changed) {
                categoriesToUpdate.push(cat);
            }
        }

        if (categoriesToUpdate.length > 0) {
            console.log(`QuickLog-Solo: Migrating ${categoriesToUpdate.length} categories...`);
            await new Promise((resolve, reject) => {
                if (!db) { reject(new Error('DB not initialized')); return; }
                const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
                const store = tx.objectStore(STORE_CATEGORIES);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
                for (const cat of categoriesToUpdate) {
                    store.put(cat);
                }
            });
        }
    }

    const allLogs = await dbGetAll(STORE_LOGS);
    const isAutoStopEnabled = (await dbGet(STORE_SETTINGS, SETTING_KEY_AUTO_STOP))?.value ?? true;

    let openTasks = allLogs.filter(log => !log.endTime).sort((a, b) => b.startTime - a.startTime);

    // Auto-record 'Stop' at Midnight repair
    if (isAutoStopEnabled) {
        const repairUpdates = [];
        const newMarkers = [];

        for (const task of openTasks) {
            const stopTime = getAutoStopTimeIfPassed(task.startTime);
            if (stopTime) {
                task.endTime = stopTime;
                repairUpdates.push(task);

                // Add a Stop marker at 23:59:59 if it doesn't exist for that day
                const startOfDay = new Date(stopTime).setHours(0, 0, 0, 0);
                const dayLogs = allLogs.filter(l => l.startTime >= startOfDay && l.startTime < (startOfDay + 86400000));
                const hasStopMarker = dayLogs.some(l => l.isManualStop && l.category === SYSTEM_CATEGORY_IDLE);

                if (!hasStopMarker) {
                    const newMarker = {
                        category: SYSTEM_CATEGORY_IDLE,
                        startTime: stopTime,
                        endTime: stopTime,
                        isManualStop: true
                    };
                    newMarkers.push(newMarker);
                    allLogs.push(newMarker);
                }
            }
        }

        if (repairUpdates.length > 0 || newMarkers.length > 0) {
            console.log(`QuickLog-Solo: Performing auto-stop repair for ${repairUpdates.length} tasks and adding ${newMarkers.length} markers...`);
            await new Promise((resolve, reject) => {
                if (!db) { reject(new Error('DB not initialized')); return; }
                const tx = db.transaction(STORE_LOGS, 'readwrite');
                const store = tx.objectStore(STORE_LOGS);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
                for (const task of repairUpdates) {
                    store.put(task);
                }
                for (const marker of newMarkers) {
                    store.add(marker);
                }
            });
            // Refresh openTasks after auto-stop
            openTasks = allLogs.filter(log => !log.endTime).sort((a, b) => b.startTime - a.startTime);
        }
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

    const activeTask = (await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE))?.value || activeTaskFromLogs;

    // Ensure only one active task remains
    const hasPauseState = activeTask && activeTask.isPaused;
    const startIndex = hasPauseState ? 0 : 1;
    if (openTasks.length > startIndex) {
        const orphanedTasks = [];
        for (let i = startIndex; i < openTasks.length; i++) {
            const orphaned = openTasks[i];
            if (hasPauseState && orphaned.category === SYSTEM_CATEGORY_IDLE && orphaned.startTime === activeTask.startTime) continue;

            orphaned.endTime = orphaned.startTime + ORPHANED_TASK_MIN_DURATION_MS;
            orphanedTasks.push(orphaned);
        }
        if (orphanedTasks.length > 0) {
            await new Promise((resolve, reject) => {
                if (!db) { reject(new Error('DB not initialized')); return; }
                const tx = db.transaction(STORE_LOGS, 'readwrite');
                const store = tx.objectStore(STORE_LOGS);
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
                for (const task of orphanedTasks) {
                    store.put(task);
                }
            });
        }
    }

    // Ensure default alarms exist
    let existingAlarms = await dbGetAll(STORE_ALARMS);
    if (existingAlarms.length === 0) {
        const defaultAlarms = [];
        for (let i = 0; i < 5; i++) {
            defaultAlarms.push({
                enabled: false,
                time: "09:00",
                message: "",
                action: "none", // none, stop, pause, start
                actionCategory: ""
            });
        }
        await dbAddMultiple(STORE_ALARMS, defaultAlarms);
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
    const toMillis = (h, m) => (h * 60 + m) * 60 * 1000;

    const allNewLogs = [];

    for (const offset of CONFIG.DAYS_OFFSET) {
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - offset);
        baseDate.setHours(0, 0, 0, 0);

        const baseTime = baseDate.getTime();

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

        const addTasks = (start, end, count, isMorning) => {
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
                    const candidates = workCategories.filter(c => c.name !== lastCategoryName);
                    cat = candidates[Math.floor(Math.random() * candidates.length)];
                }
                lastCategoryName = cat.name;

                allNewLogs.push({
                    category: cat.name,
                    startTime: Math.floor(current),
                    endTime: Math.floor(taskEnd),
                    color: cat.color || 'primary',
                    tags: cat.tags || ''
                });
                current = taskEnd;
            }
        };

        // Morning Tasks
        addTasks(startTime, lunchStart, morningCount, true);

        // Lunch Break
        allNewLogs.push({
            category: SYSTEM_CATEGORY_IDLE,
            startTime: Math.floor(lunchStart),
            endTime: Math.floor(lunchEnd)
        });

        // Afternoon Tasks
        addTasks(lunchEnd, endTime, afternoonCount, false);

        // Final Stop Marker
        allNewLogs.push({
            category: SYSTEM_CATEGORY_IDLE,
            startTime: Math.floor(endTime),
            endTime: Math.floor(endTime),
            isManualStop: true
        });
    }
    await dbAddMultiple(STORE_LOGS, allNewLogs);
}

async function cleanupOldLogs() {
    const cleanupThresholdTime = Date.now() - LOG_CLEANUP_THRESHOLD_MS;
    const allLogs = await dbGetAll(STORE_LOGS);
    const logsToDelete = allLogs.filter(log => log.startTime < cleanupThresholdTime);

    if (logsToDelete.length === 0) return;

    console.log(`QuickLog-Solo: Cleaning up ${logsToDelete.length} old logs...`);

    return new Promise((resolve, reject) => {
        if (!db) { reject(new Error('DB not initialized')); return; }
        const tx = db.transaction(STORE_LOGS, 'readwrite');
        const store = tx.objectStore(STORE_LOGS);

        tx.oncomplete = () => {
            console.log('QuickLog-Solo: Cleanup completed.');
            resolve();
        };
        tx.onerror = (e) => reject(e.target.error);

        for (const log of logsToDelete) {
            store.delete(log.id);
        }
    });
}
