/**
 * QuickLog-Solo: Custom Animation IndexedDB Utility
 * Aligned with Local-Only Storage Tiering specs.
 */

export function openAnimationDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuickLogAnimationDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('blobs')) {
                db.createObjectStore('blobs');
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

export async function getAnimationBlob(id) {
    const db = await openAnimationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('blobs', 'readonly');
        const store = tx.objectStore('blobs');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function putAnimationBlob(id, blob) {
    const db = await openAnimationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('blobs', 'readwrite');
        const store = tx.objectStore('blobs');
        const req = store.put(blob, id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function deleteAnimationBlob(id) {
    const db = await openAnimationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('blobs', 'readwrite');
        const store = tx.objectStore('blobs');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function clearAnimationDB() {
    const db = await openAnimationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('blobs', 'readwrite');
        const store = tx.objectStore('blobs');
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}
