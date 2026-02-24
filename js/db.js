export const DB_NAME = 'QuickLogSoloDB';
export const DB_VERSION = 1;

let db;

export function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('logs')) {
                db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('categories')) {
                db.createObjectStore('categories', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
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

    let existingCategories = await dbGetAll('categories');
    if (existingCategories.length === 0) {
        for (const cat of initialCategories) {
            await dbPut('categories', cat);
        }
    } else {
        for (let i = 0; i < existingCategories.length; i++) {
            let cat = existingCategories[i];
            if (cat.color === undefined || cat.order === undefined) {
                cat.color = cat.color || 'blue';
                cat.order = cat.order !== undefined ? cat.order : i;
                await dbPut('categories', cat);
            }
        }
    }

    const theme = await dbGet('settings', 'theme');
    const accent = await dbGet('settings', 'accent');
    const font = await dbGet('settings', 'font');
    const layout = await dbGet('settings', 'layout');

    const allLogs = await dbGetAll('logs');
    const activeTask = allLogs.find(log => !log.endTime);

    return {
        theme: theme ? theme.value : null,
        accent: accent ? accent.value : null,
        font: font ? font.value : null,
        layout: layout ? layout.value : null,
        activeTask
    };
}

async function cleanupOldLogs() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const logs = await dbGetAll('logs');
    for (const log of logs) {
        if (log.startTime < thirtyDaysAgo) {
            await dbDelete('logs', log.id);
        }
    }
}
