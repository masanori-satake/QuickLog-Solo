import { SYSTEM_CATEGORY_IDLE } from './utils.js';

export const DB_NAME = 'QuickLogSoloDB';
export const DB_VERSION = 1;

export const STORE_LOGS = 'logs';
export const STORE_CATEGORIES = 'categories';
export const STORE_SETTINGS = 'settings';

export const SETTING_KEY_THEME = 'theme';
export const SETTING_KEY_FONT = 'font';
export const SETTING_KEY_ANIMATION = 'animation';
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
    await setupInitialData();
    const settings = await getCurrentAppState();
    await cleanupOldLogs();
    return settings;
}

export async function getCurrentAppState() {
    const theme = await dbGet(STORE_SETTINGS, SETTING_KEY_THEME);
    const font = await dbGet(STORE_SETTINGS, SETTING_KEY_FONT);
    const animation = await dbGet(STORE_SETTINGS, SETTING_KEY_ANIMATION);

    const pauseStateSetting = await dbGet(STORE_SETTINGS, SETTING_KEY_PAUSE_STATE);
    let activeTask = null;

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
        animation: animation ? animation.value : null,
        activeTask
    };
}

async function setupInitialData() {
    const initialCategories = [
        { name: '💻 開発・プログラミング', color: 'primary', order: 0 },
        { name: '🤝 チームミーティング・定例会', color: 'secondary', order: 1 },
        { name: '🔍 調査・リサーチ・技術検証', color: 'tertiary', order: 2 },
        { name: '事務作業・メール対応 📝', color: 'neutral', order: 3 },
        { name: '🔥 深い集中が必要なタスク', color: 'error', order: 4 },
        { name: '📚 自己研鑽・スキルアップ', color: 'tertiary', order: 5 },
        { name: '💡 アイデア出し・企画立案', color: 'secondary', order: 6 },
        { name: '☕ メンタル休憩・リフレッシュ', color: 'outline', order: 7 },
        { name: '📞 クライアント連絡・電話', color: 'primary', order: 8 },
        { name: '📝 資料作成・レポート', color: 'secondary', order: 9 },
        { name: '🎨 デザイン・UI/UX検討', color: 'tertiary', order: 10 },
        { name: '🐛 バグ修正・品質改善', color: 'error', order: 11 },
        { name: '🚀 リリース・デプロイ作業', color: 'teal', order: 12 },
        { name: '🛠 ツール整備・自動化', color: 'green', order: 13 },
        { name: '🗓 スケジュール調整・タスク管理', color: 'yellow', order: 14 },
        { name: '💬 チャット対応・Slack/Teams', color: 'orange', order: 15 },
        { name: '📖 ドキュメント整備・Wiki更新', color: 'pink', order: 16 },
        { name: '🧪 テスト・QA作業', color: 'indigo', order: 17 },
        { name: '💼 営業・提案活動', color: 'brown', order: 18 },
        { name: '🏗 アーキテクチャ設計', color: 'cyan', order: 19 },
        { name: '🔐 セキュリティ対応・監査', color: 'error', order: 20 },
        { name: '📊 データ分析・SQL', color: 'teal', order: 21 },
        { name: '🏠 在宅ワーク環境整備', color: 'neutral', order: 22 },
        { name: '🚶 移動・外出', color: 'outline', order: 23 }
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
                cat.color = cat.color || 'primary';
                cat.order = cat.order !== undefined ? cat.order : i;
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
