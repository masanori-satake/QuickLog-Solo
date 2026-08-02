/**
 * QuickLog-Solo: Animation Sync Manager
 * Handles chunked synchronization of custom animations via chrome.storage.sync.
 */

/**
 * Splits a Base64 string into chunks of maxSize or fewer characters.
 * @param {string} base64String - The Base64 encoded string to split.
 * @param {number} [maxSize=6000] - Maximum characters per chunk.
 * @returns {string[]} Array of string chunks, each <= maxSize characters.
 */
export function splitIntoChunks(base64String, maxSize = 6000) {
    if (base64String.length === 0) {
        return [''];
    }

    const chunks = [];
    for (let i = 0; i < base64String.length; i += maxSize) {
        chunks.push(base64String.slice(i, i + maxSize));
    }
    return chunks;
}

/**
 * Joins an array of chunks back into the original Base64 string.
 * @param {string[]} chunks - Array of string chunks to join.
 * @returns {string} The reassembled Base64 string.
 */
export function joinChunks(chunks) {
    return chunks.join('');
}

/**
 * Generates a storage key name for an animation chunk.
 * @param {string} animationId - The animation identifier.
 * @param {number} chunkIndex - The zero-based chunk index.
 * @returns {string} The key in format: anim_chunk_{animationId}_{chunkIndex}
 */
export function animChunkKey(animationId, chunkIndex) {
    return `anim_chunk_${animationId}_${chunkIndex}`;
}

/**
 * Maximum number of retry attempts for sync write operations.
 * @type {number}
 */
const MAX_RETRIES = 3;

/**
 * Delay in milliseconds between retry attempts.
 * @type {number}
 */
const RETRY_DELAY_MS = 500;

/**
 * Generates the metadata key for an animation.
 * @param {string} animationId - The animation identifier.
 * @returns {string} The metadata key in format: anim_meta_{animationId}
 */
function animMetaKey(animationId) {
    return `anim_meta_${animationId}`;
}

/**
 * Waits for the specified number of milliseconds.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pushes an animation's Base64 data to chrome.storage.sync in chunks with retry logic.
 * Splits the data into 6,000-character chunks and writes each one individually.
 * Also writes a metadata key with the chunk count.
 *
 * @param {string} animationId - The animation identifier.
 * @param {string} base64 - The Base64 encoded animation data.
 * @param {Function} onProgress - Callback invoked after each successful chunk write: onProgress(completedChunks, totalChunks).
 * @returns {Promise<void>}
 * @throws {Error} If all retries are exhausted or a QUOTA_BYTES_PER_ITEM error occurs.
 */
export async function pushAnimationToSync(animationId, base64, onProgress) {
    const chunks = splitIntoChunks(base64, 6000);
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
        const key = animChunkKey(animationId, i);
        let success = false;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                await chrome.storage.sync.set({ [key]: chunks[i] });
                success = true;
                break;
            } catch (err) {
                if (err && err.message && err.message.includes('QUOTA_BYTES_PER_ITEM')) {
                    throw err;
                }
                if (attempt < MAX_RETRIES - 1) {
                    await delay(RETRY_DELAY_MS);
                }
            }
        }

        if (!success) {
            throw new Error(`Failed to write chunk ${i} for animation ${animationId} after ${MAX_RETRIES} retries`);
        }

        onProgress(i + 1, totalChunks);
    }

    // Write metadata key with chunk count
    const metaKey = animMetaKey(animationId);
    let metaSuccess = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            await chrome.storage.sync.set({ [metaKey]: { chunkCount: totalChunks } });
            metaSuccess = true;
            break;
        } catch (err) {
            if (attempt < MAX_RETRIES - 1) {
                await delay(RETRY_DELAY_MS);
            }
        }
    }

    if (!metaSuccess) {
        throw new Error(`Failed to write metadata for animation ${animationId} after ${MAX_RETRIES} retries`);
    }
}

/**
 * Pulls all animation data from sync storage and reconstructs Base64 strings.
 * Groups chunks by animationId, sorts by chunk index, and joins them.
 *
 * @param {Object} syncData - The object returned from chrome.storage.sync.get(null).
 * @returns {Array<{id: string, base64: string}>} Array of reconstructed animation data.
 */
export function pullAnimationsFromSync(syncData) {
    const CHUNK_PREFIX = 'anim_chunk_';
    const animationChunks = {};

    for (const key of Object.keys(syncData)) {
        if (!key.startsWith(CHUNK_PREFIX)) {
            continue;
        }

        // Key format: anim_chunk_{animationId}_{chunkIndex}
        // animationId may contain underscores (e.g., UUID), so parse from the end
        const withoutPrefix = key.slice(CHUNK_PREFIX.length);
        const lastUnderscoreIdx = withoutPrefix.lastIndexOf('_');

        if (lastUnderscoreIdx === -1) {
            continue;
        }

        const animationId = withoutPrefix.slice(0, lastUnderscoreIdx);
        const chunkIndex = parseInt(withoutPrefix.slice(lastUnderscoreIdx + 1), 10);

        if (isNaN(chunkIndex)) {
            continue;
        }

        if (!animationChunks[animationId]) {
            animationChunks[animationId] = [];
        }

        animationChunks[animationId].push({ index: chunkIndex, data: syncData[key] });
    }

    const results = [];

    for (const animationId of Object.keys(animationChunks)) {
        const chunks = animationChunks[animationId];
        chunks.sort((a, b) => a.index - b.index);
        const base64 = joinChunks(chunks.map((c) => c.data));
        results.push({ id: animationId, base64 });
    }

    return results;
}

/**
 * Removes all chunks and metadata for a specific animation from chrome.storage.sync.
 *
 * @param {string} animationId - The animation identifier to remove.
 * @returns {Promise<void>}
 */
export async function removeAnimationFromSync(animationId) {
    const allData = await chrome.storage.sync.get(null);
    const chunkPrefix = `anim_chunk_${animationId}_`;
    const metaKey = animMetaKey(animationId);
    const keysToRemove = [];

    for (const key of Object.keys(allData)) {
        if (key.startsWith(chunkPrefix) || key === metaKey) {
            keysToRemove.push(key);
        }
    }

    if (keysToRemove.length > 0) {
        await chrome.storage.sync.remove(keysToRemove);
    }
}

/**
 * Removes ALL animation chunk and metadata keys from chrome.storage.sync.
 * Targets keys with 'anim_chunk_' and 'anim_meta_' prefixes.
 *
 * @returns {Promise<void>}
 */
export async function clearAllAnimationChunksFromSync() {
    const allData = await chrome.storage.sync.get(null);
    const keysToRemove = [];

    for (const key of Object.keys(allData)) {
        if (key.startsWith('anim_chunk_') || key.startsWith('anim_meta_')) {
            keysToRemove.push(key);
        }
    }

    if (keysToRemove.length > 0) {
        await chrome.storage.sync.remove(keysToRemove);
    }
}
