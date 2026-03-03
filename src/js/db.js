import { SYSTEM_CATEGORY_IDLE } from './utils.js';
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
                db.createObjectStore(STORE_CATEGORIES, { keyPath: 'name' });
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
        categories,
        activeTask
    };
}

async function setupInitialData(languageSetting) {
    setLanguage(languageSetting);

    const initialCategories = [
        { name: t('init-cat-dev'), color: 'primary', order: 0, animation: 'matrix_code', tags: '' },
        { name: t('init-cat-meeting'), color: 'secondary', order: 1, animation: 'migrating_birds', tags: '' },
        { name: t('init-cat-research'), color: 'tertiary', order: 2, animation: 'contour_lines', tags: '' },
        { name: t('init-cat-admin'), color: 'neutral', order: 3, animation: 'matrix_code', tags: '' },
        { name: t('init-cat-focus'), color: 'error', order: 4, animation: 'ripple', tags: '' },
        { name: t('init-cat-skill'), color: 'tertiary', order: 5, animation: 'dot_typing', tags: '' },
        { name: t('init-cat-idea'), color: 'secondary', order: 6, animation: 'spectrum', tags: '' },
        { name: t('init-cat-break'), color: 'outline', order: 7, animation: 'coffee_drip', tags: '' },
        { name: t('init-cat-client'), color: 'primary', order: 8, animation: 'car_drive', tags: '' },
        { name: t('init-cat-doc'), color: 'secondary', order: 9, animation: 'dot_typing', tags: '' },
        { name: t('init-cat-design'), color: 'tertiary', order: 10, animation: 'contour_lines', tags: '' },
        { name: t('init-cat-bug'), color: 'error', order: 11, animation: 'tetris_building', tags: '' },
        { name: t('init-cat-release'), color: 'teal', order: 12, animation: 'night_sky', tags: '' },
        { name: t('init-cat-tool'), color: 'green', order: 13, animation: 'matrix_code', tags: '' },
        { name: t('init-cat-schedule'), color: 'yellow', order: 14, animation: 'sand_clock', tags: '' },
        { name: t('init-cat-chat'), color: 'orange', order: 15, animation: 'matrix_code', tags: '' },
        { name: t('init-cat-wiki'), color: 'pink', order: 16, animation: 'dot_typing', tags: '' },
        { name: t('init-cat-qa'), color: 'indigo', order: 17, animation: 'hero_pot', tags: '' },
        { name: t('init-cat-sales'), color: 'brown', order: 18, animation: 'migrating_birds', tags: '' },
        { name: t('init-cat-arch'), color: 'cyan', order: 19, animation: 'contour_lines', tags: '' },
        { name: t('init-cat-sec'), color: 'error', order: 20, animation: 'spectrum', tags: '' },
        { name: t('init-cat-data'), color: 'teal', order: 21, animation: 'cats', tags: '' },
        { name: t('init-cat-wfh'), color: 'neutral', order: 22, animation: 'left_to_right', tags: '' },
        { name: t('init-cat-move'), color: 'outline', order: 23, animation: 'right_to_left', tags: '' }
    ];

    let existingCategories = await dbGetAll(STORE_CATEGORIES);
    if (existingCategories.length === 0) {
        for (const cat of initialCategories) {
            await dbPut(STORE_CATEGORIES, cat);
        }
    } else {
        const deletedAnimations = ['kaleidoscope', 'lissajous_pendulum', 'plant_growth', 'tennis'];
        for (let i = 0; i < existingCategories.length; i++) {
            let cat = existingCategories[i];
            let changed = false;
            if (cat.color === undefined) { cat.color = 'primary'; changed = true; }
            if (cat.order === undefined) { cat.order = i; changed = true; }
            if (cat.animation === undefined) { cat.animation = 'default'; changed = true; }
            if (cat.tags === undefined) { cat.tags = ''; changed = true; }

            if (deletedAnimations.includes(cat.animation)) {
                cat.animation = 'default';
                changed = true;
            }

            if (changed) {
                await dbPut(STORE_CATEGORIES, cat);
            }
        }
    }

    const allLogs = await dbGetAll(STORE_LOGS);

    // Backward compatibility migration: convert legacy Japanese "(待機)" to language-independent "__IDLE__"
    const legacyIdleName = '(待機)';
    for (const log of allLogs) {
        if (log.category === legacyIdleName) {
            log.category = SYSTEM_CATEGORY_IDLE;
            await dbPut(STORE_LOGS, log);
        }
    }
    const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    if (pauseStateSetting && pauseStateSetting.value && pauseStateSetting.value.category === legacyIdleName) {
        pauseStateSetting.value.category = SYSTEM_CATEGORY_IDLE;
        await dbPut(STORE_SETTINGS, pauseStateSetting);
    }

    const openTasks = allLogs.filter(log => !log.endTime).sort((a, b) => b.startTime - a.startTime);
    const activeTaskFromLogs = openTasks[0];

    // Migration / Auto-repair for idle tasks in logs
    if (activeTaskFromLogs && activeTaskFromLogs.category === SYSTEM_CATEGORY_IDLE) {
        console.log(`QuickLog-Solo: Migrating open ${SYSTEM_CATEGORY_IDLE} task to pauseState`);
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

    // 複数の未終了タスクがある場合は、最新以外を強制終了させて整合性を保つ
    // ただし、activeTaskがpauseStateの場合は、全てのopenTasksを強制終了すべき
    const hasPauseState = activeTask && activeTask.isPaused;
    const startIndex = hasPauseState ? 0 : 1;
    if (openTasks.length > startIndex) {
        console.warn('QuickLog-Solo: Found orphaned active tasks. Closing them.');
        for (let i = startIndex; i < openTasks.length; i++) {
            const orphaned = openTasks[i];
            // すでにmigrationで削除済みの場合はスキップ
            if (hasPauseState && orphaned.category === SYSTEM_CATEGORY_IDLE && orphaned.startTime === activeTask.startTime) continue;

            orphaned.endTime = orphaned.startTime + ORPHANED_TASK_MIN_DURATION_MS; // 最小限の時間を記録
            await dbPut(STORE_LOGS, orphaned);
        }
    }

    // Generate dummy history if no logs exist (demo purpose)
    const logsAfterMigration = await dbGetAll(STORE_LOGS);
    if (logsAfterMigration.length === 0) {
        await generateDummyHistory();
    }
}

async function generateDummyHistory() {
    console.log('QuickLog-Solo: Generating dummy history...');
    const daysOffset = [1, 2, 4]; // Yesterday, 2 days ago, 4 days ago
    const categories = await dbGetAll(STORE_CATEGORIES);
    const workCategories = categories.filter(c => c.name !== SYSTEM_CATEGORY_IDLE);

    if (workCategories.length === 0) return;

    for (const offset of daysOffset) {
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - offset);
        baseDate.setHours(0, 0, 0, 0);

        // Start time: 8:30 +/- 3-7 mins
        const startJitter = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 5) + 3);
        const startTime = baseDate.getTime() + (8 * 60 + 30 + startJitter) * 60 * 1000;

        // End time: 17:30 +/- 3-7 mins
        const endJitter = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 5) + 3);
        const endTime = baseDate.getTime() + (17 * 60 + 30 + endJitter) * 60 * 1000;

        // Lunch: 12:30 +/- 2-5 mins
        const lunchJitter = (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 4) + 2);
        const lunchStart = baseDate.getTime() + (12 * 60 + 30 + lunchJitter) * 60 * 1000;
        const lunchEnd = lunchStart + 60 * 60 * 1000; // Exactly 1 hour

        const numTasks = Math.floor(Math.random() * 3) + 5; // 5 to 7 tasks total per day
        const morningCount = 2; // Fixed 2 tasks for morning for demo balance
        const afternoonCount = numTasks - morningCount;

        // Morning Tasks
        let current = startTime;
        for (let i = 0; i < morningCount; i++) {
            const taskEnd = i === morningCount - 1 ? lunchStart : current + (lunchStart - current) / (morningCount - i) * (0.8 + Math.random() * 0.4);
            const isFirst = i === 0;
            const cat = isFirst ? { name: t('demo-warning'), color: 'error' } : workCategories[Math.floor(Math.random() * workCategories.length)];

            await dbPut(STORE_LOGS, {
                category: cat.name,
                startTime: Math.floor(current),
                endTime: Math.floor(taskEnd),
                color: cat.color || 'primary'
            });
            current = taskEnd;
        }

        // Lunch Break
        await dbPut(STORE_LOGS, {
            category: SYSTEM_CATEGORY_IDLE,
            startTime: Math.floor(lunchStart),
            endTime: Math.floor(lunchEnd)
        });

        // Afternoon Tasks
        current = lunchEnd;
        for (let i = 0; i < afternoonCount; i++) {
            const taskEnd = i === afternoonCount - 1 ? endTime : current + (endTime - current) / (afternoonCount - i) * (0.8 + Math.random() * 0.4);
            const cat = workCategories[Math.floor(Math.random() * workCategories.length)];

            await dbPut(STORE_LOGS, {
                category: cat.name,
                startTime: Math.floor(current),
                endTime: Math.floor(taskEnd),
                color: cat.color || 'primary'
            });
            current = taskEnd;
        }
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
