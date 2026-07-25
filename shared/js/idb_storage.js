/**
 * QuickLog-Solo: Custom Animations IndexedDB Storage Utility
 * Complete local-only storage for raw custom animation Blobs.
 */

const DB_NAME = 'QuickLogAnimationDB';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

let dbInstance = null;
let dbPromise = null;

/**
 * Opens and initializes the IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export function initAnimationDB() {
    if (dbPromise) return dbPromise;
    if (dbInstance) return Promise.resolve(dbInstance);

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            dbPromise = null;
            reject(event.target.error);
        };
    });

    return dbPromise;
}

/**
 * Saves a raw Blob and renderSpec for a given custom animation ID.
 * @param {string} id - The custom animation ID.
 * @param {Blob} blob - The raw binary data / GIF Blob.
 * @param {Object} renderSpec - The rendering configuration.
 * @returns {Promise<void>}
 */
export async function saveAnimationBlob(id, blob, renderSpec) {
    const db = await initAnimationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put({ id, blob, renderSpec });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Retrieves the raw Blob for a given custom animation ID.
 * @param {string} id - The custom animation ID.
 * @returns {Promise<Blob|null>}
 */
export async function getAnimationBlob(id) {
    const db = await initAnimationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result.blob);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Deletes the raw Blob for a given custom animation ID.
 * @param {string} id - The custom animation ID.
 * @returns {Promise<void>}
 */
export async function deleteAnimationBlob(id) {
    const db = await initAnimationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
