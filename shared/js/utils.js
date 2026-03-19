/**
 * QuickLog-Solo: Security and Validation Utilities
 */

export const SYSTEM_CATEGORY_IDLE = '__IDLE__';
export const SYSTEM_CATEGORY_PAGE_BREAK = '__PAGE_BREAK__';

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
    if (typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 50) return false;
    if (trimmed === SYSTEM_CATEGORY_IDLE || trimmed.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)) return false;
    return true;
}

const VALID_COLORS = [
    'primary', 'secondary', 'tertiary', 'error', 'neutral', 'outline',
    'teal', 'green', 'yellow', 'orange', 'pink', 'indigo', 'brown', 'cyan'
];

/**
 * Validates if the color is in the predefined list.
 * @param {string} color
 * @returns {boolean}
 */
export function isValidColor(color) {
    return VALID_COLORS.includes(color);
}

/**
 * Generates a unique name for a duplicated category.
 * Append (n) suffix based on existing names.
 * @param {string} baseName
 * @param {string[]} existingNames
 * @returns {string}
 */
export function generateDuplicateName(baseName, existingNames) {
    const cleanBase = baseName.replace(/\s*\(\d+\)$/, '').trim();
    let maxNum = 0;
    const pattern = new RegExp(`^${cleanBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\((\\d+)\\)$`);

    existingNames.forEach(name => {
        const match = name.match(pattern);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
        // Note: Exact matches of cleanBase without a suffix are ignored here.
        // We only care about the maximum sequential (n) to determine the next number.
    });

    return `${cleanBase} (${maxNum + 1})`;
}
