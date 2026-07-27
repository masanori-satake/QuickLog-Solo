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
 * Saves animation data for a custom animation ID.
 * @param {string} id - The custom animation ID.
 * @param {Blob} blob - The animation binary data.
 * @param {Object} renderSpec - The rendering configuration.
 * @param {Object} [config] - The optional animation configuration.
 */
export async function saveAnimationBlob(id, blob, renderSpec, config) {
    const db = await initAnimationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put({ id, blob, renderSpec, config });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

const DRAFT_DB_NAME = 'QuickLogAnimationDraftDB';
const DRAFT_DB_VERSION = 1;
const DRAFT_STORE_NAME = 'blobs';

let draftDbInstance = null;
let draftDbPromise = null;

/**
 * Opens and initializes the IndexedDB connection used for animation drafts.
 * @returns {Promise<IDBDatabase>} The draft animation database connection.
 */
export function initAnimationDraftDB() {
    if (draftDbPromise) return draftDbPromise;
    if (draftDbInstance) return Promise.resolve(draftDbInstance);

    draftDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
                db.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            draftDbInstance = event.target.result;
            resolve(draftDbInstance);
        };

        request.onerror = (event) => {
            draftDbPromise = null;
            reject(event.target.error);
        };
    });

    return draftDbPromise;
}

/**
 * Saves a raw Blob, renderSpec, and optional config to the Draft IndexedDB.
 */
export async function saveAnimationDraftBlob(id, blob, renderSpec, config) {
    const db = await initAnimationDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
        const store = tx.objectStore(DRAFT_STORE_NAME);
        const request = store.put({ id, blob, renderSpec, config });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Retrieves the stored draft animation Blob for an identifier.
 * @param {*} id - The identifier of the draft animation.
 * @return {Promise<Blob|null>} The stored Blob, or `null` if no record exists.
 */
export async function getAnimationDraftBlob(id) {
    const db = await initAnimationDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
        const store = tx.objectStore(DRAFT_STORE_NAME);
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
 * Retrieves a draft animation record by its identifier.
 * @param {string} id - The record identifier.
 * @return {Promise<Object|null>} The matching draft record, or `null` if no record exists.
 */
export async function getAnimationDraftRecord(id) {
    const db = await initAnimationDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
        const store = tx.objectStore(DRAFT_STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Retrieves all records from the Draft IndexedDB.
 */
export async function getAllAnimationDraftRecords() {
    const db = await initAnimationDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
        const store = tx.objectStore(DRAFT_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Deletes a record from the Draft IndexedDB by persisting a tombstone.
 */
export async function deleteAnimationDraftBlob(id) {
    const db = await initAnimationDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
        const store = tx.objectStore(DRAFT_STORE_NAME);
        const request = store.put({ id, deleted: true });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Clears the entire Draft IndexedDB.
 */
export async function clearAnimationDraftDB() {
    const db = await initAnimationDraftDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
        const store = tx.objectStore(DRAFT_STORE_NAME);
        const request = store.clear();

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
