import { SYSTEM_CATEGORY_IDLE } from './utils.js';

export const DB_NAME = 'QuickLogSoloDB';
export const DB_VERSION = 1;

export const STORE_LOGS = 'logs';
export const STORE_CATEGORIES = 'categories';
export const STORE_SETTINGS = 'settings';

export const SETTING_KEY_THEME = 'theme';
export const SETTING_KEY_ACCENT = 'accent';
export const SETTING_KEY_FONT = 'font';
export const SETTING_KEY_LAYOUT = 'layout';
export const SETTING_KEY_PAUSE_STATE = 'pauseState';

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
            resolve(db);
        };
        request.onerror = (event) => reject(event.target.error);
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
    const settings = await setupInitialData();
    await cleanupOldLogs();
    return settings;
}

async function setupInitialData() {
    const initialCategories = [
        { name: '💻 開発', color: 'blue', order: 0 },
        { name: '🤝 会議', color: 'orange', order: 1 },
        { name: '🔍 調査', color: 'green', order: 2 },
        { name: '事務作業 📝', color: 'gray', order: 3 },
        { name: '🔥 深い集中(Deep Work)', color: 'red', order: 4 },
        { name: '📚 スキルアップ', color: 'purple', order: 5 },
        { name: '💡 アイデア出し', color: 'teal', order: 6 },
        { name: '☕ メンタル休憩', color: 'orange', order: 7 }
    ];

    let existingCategories = await dbGetAll(STORE_CATEGORIES);
    if (existingCategories.length === 0) {
        for (const cat of initialCategories) {
            await dbPut(STORE_CATEGORIES, cat);
        }
    } else {
        for (let i = 0; i < existingCategories.length; i++) {
            let cat = existingCategories[i];
            if (cat.color === undefined || cat.order === undefined) {
                cat.color = cat.color || 'blue';
                cat.order = cat.order !== undefined ? cat.order : i;
                await dbPut(STORE_CATEGORIES, cat);
            }
        }
    }

    const theme = await dbGet(STORE_SETTINGS, SETTING_KEY_THEME);
    const accent = await dbGet(STORE_SETTINGS, SETTING_KEY_ACCENT);
    const font = await dbGet(STORE_SETTINGS, SETTING_KEY_FONT);
    const layout = await dbGet(STORE_SETTINGS, SETTING_KEY_LAYOUT);

    const allLogs = await dbGetAll(STORE_LOGS);
    const openTasks = allLogs.filter(log => !log.endTime).sort((a, b) => b.startTime - a.startTime);
    let activeTask = openTasks[0];

    // Migration / Auto-repair for (待機) tasks in logs
    if (activeTask && activeTask.category === SYSTEM_CATEGORY_IDLE) {
        console.log(`QuickLog-Solo: Migrating open ${SYSTEM_CATEGORY_IDLE} task to pauseState`);
        const pauseState = {
            id: activeTask.id,
            category: SYSTEM_CATEGORY_IDLE,
            startTime: activeTask.startTime,
            resumableCategory: activeTask.resumableCategory,
            isPaused: true
        };
        await dbPut(STORE_SETTINGS, { key: SETTING_KEY_PAUSE_STATE, value: pauseState });
        // DO NOT delete from logs to preserve history
        activeTask = pauseState;
    } else {
        const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
        if (pauseStateSetting) {
            activeTask = pauseStateSetting.value;
        }
    }

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

    return {
        theme: theme ? theme.value : null,
        accent: accent ? accent.value : null,
        font: font ? font.value : null,
        layout: layout ? layout.value : null,
        activeTask
    };
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
