/**
 * QuickLog-Solo: Security and Validation Utilities
 */

export const SYSTEM_CATEGORY_IDLE = '(待機)';

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Escapes a string for CSV field.
 * Quotes the field if it contains commas, quotes, or newlines.
 * Escapes double quotes by doubling them.
 * @param {string} str
 * @returns {string}
 */
export function escapeCsv(str) {
    if (typeof str !== 'string') return str;
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * Parses a single line of CSV, respecting quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvLine(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++; // Skip next quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                parts.push(current);
                current = '';
            } else {
                current += char;
            }
        }
    }
    parts.push(current);
    return parts.map(p => p.trim());
}

/**
 * Validates category name.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidCategoryName(name) {
    if (!name) return false;
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 50) return false;
    if (trimmed === SYSTEM_CATEGORY_IDLE) return false;
    return true;
}

/**
 * Checks if the current storage is persistent.
 * @returns {Promise<boolean>}
 */
export async function isStoragePersisted() {
    if (!navigator.storage || !navigator.storage.persisted) return false;
    return await navigator.storage.persisted();
}

/**
 * Requests to make the storage persistent.
 * @returns {Promise<boolean>} - Returns true if granted, false if denied.
 */
export async function requestStoragePersistence() {
    if (!navigator.storage || !navigator.storage.persist) return false;
    return await navigator.storage.persist();
}
