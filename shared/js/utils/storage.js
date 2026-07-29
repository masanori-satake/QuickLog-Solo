/**
 * Shared utility module for custom animation storage operations.
 */

/**
 * Retrieves the custom animation metadata map.
 * Transparently falls back to localStorage if chrome.storage.local is unavailable.
 * @returns {Promise<Object>}
 */
export async function getCustomAnimationMetadataMap() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get('custom_animation_metadata_map');
        return result.custom_animation_metadata_map || {};
    } else {
        try {
            const stored = localStorage.getItem('custom_animation_metadata_map');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.error('Failed to parse custom_animation_metadata_map from localStorage:', e);
            return {};
        }
    }
}

/**
 * Saves the custom animation metadata map.
 * Transparently falls back to localStorage if chrome.storage.local is unavailable.
 * @param {Object} map
 * @returns {Promise<void>}
 */
export async function setCustomAnimationMetadataMap(map) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ custom_animation_metadata_map: map });
    } else {
        try {
            localStorage.setItem('custom_animation_metadata_map', JSON.stringify(map));
        } catch (e) {
            console.error('Failed to save custom_animation_metadata_map to localStorage:', e);
        }
    }
}
