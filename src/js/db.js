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
        request.onblocked = (event) => {
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
        { name: t('init-cat-dev'), color: 'primary', order: 0, animation: 'matrix_code' },
        { name: t('init-cat-meeting'), color: 'secondary', order: 1, animation: 'migrating_birds' },
        { name: t('init-cat-research'), color: 'tertiary', order: 2, animation: 'contour_lines' },
        { name: t('init-cat-admin'), color: 'neutral', order: 3, animation: 'matrix_code' },
        { name: t('init-cat-focus'), color: 'error', order: 4, animation: 'ripple' },
        { name: t('init-cat-skill'), color: 'tertiary', order: 5, animation: 'plant_growth' },
        { name: t('init-cat-idea'), color: 'secondary', order: 6, animation: 'kaleidoscope' },
        { name: t('init-cat-break'), color: 'outline', order: 7, animation: 'coffee_drip' },
        { name: t('init-cat-client'), color: 'primary', order: 8, animation: 'car_drive' },
        { name: t('init-cat-doc'), color: 'secondary', order: 9, animation: 'dot_typing' },
        { name: t('init-cat-design'), color: 'tertiary', order: 10, animation: 'lissajous_pendulum' },
        { name: t('init-cat-bug'), color: 'error', order: 11, animation: 'tetris_building' },
        { name: t('init-cat-release'), color: 'teal', order: 12, animation: 'night_sky' },
        { name: t('init-cat-tool'), color: 'green', order: 13, animation: 'matrix_code' },
        { name: t('init-cat-schedule'), color: 'yellow', order: 14, animation: 'sand_clock' },
        { name: t('init-cat-chat'), color: 'orange', order: 15, animation: 'tennis' },
        { name: t('init-cat-wiki'), color: 'pink', order: 16, animation: 'dot_typing' },
        { name: t('init-cat-qa'), color: 'indigo', order: 17, animation: 'hero_pot' },
        { name: t('init-cat-sales'), color: 'brown', order: 18, animation: 'migrating_birds' },
        { name: t('init-cat-arch'), color: 'cyan', order: 19, animation: 'contour_lines' },
        { name: t('init-cat-sec'), color: 'error', order: 20, animation: 'spectrum' },
        { name: t('init-cat-data'), color: 'teal', order: 21, animation: 'cats' },
        { name: t('init-cat-wfh'), color: 'neutral', order: 22, animation: 'left_to_right' },
        { name: t('init-cat-move'), color: 'outline', order: 23, animation: 'right_to_left' }
    ];

    let existingCategories = await dbGetAll(STORE_CATEGORIES);
    if (existingCategories.length === 0) {
        for (const cat of initialCategories) {
            await dbPut(STORE_CATEGORIES, cat);
        }
    } else {
        for (let i = 0; i < existingCategories.length; i++) {
            let cat = existingCategories[i];
            if (cat.color === undefined || cat.order === undefined || cat.animation === undefined) {
                cat.color = cat.color || 'primary';
                cat.order = cat.order !== undefined ? cat.order : i;
                cat.animation = cat.animation || 'default';
                await dbPut(STORE_CATEGORIES, cat);
            }
        }
    }

    const allLogs = await dbGetAll(STORE_LOGS);
    const openTasks = allLogs.filter(log => !log.endTime).sort((a, b) => b.startTime - a.startTime);
    const activeTaskFromLogs = openTasks[0];

    // Migration / Auto-repair for (待機) tasks in logs
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

    const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    const activeTask = pauseStateSetting ? pauseStateSetting.value : activeTaskFromLogs;

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
