/**
 * QuickLog-Solo: Security and Validation Utilities
 */

export const SYSTEM_CATEGORY_IDLE = '__IDLE__';
export const SYSTEM_CATEGORY_UNKNOWN = '__UNKNOWN__';
export const SYSTEM_CATEGORY_PAGE_BREAK = '__PAGE_BREAK__';
export const DEFAULT_ALARM_MESSAGE_STOP = 'Stop Task';
export const CELL_SIZE = 6;
export const CONTIGUITY_TOLERANCE_MS = 1000;

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
        "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Escapes a string for TSV field.
 * Quotes the field if it contains tabs, quotes, or newlines.
 * Escapes double quotes by doubling them.
 * @param {string} str
 * @returns {string}
 */
export function escapeTsv(str) {
    if (typeof str !== 'string') return str;
    if (str.includes('\t') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
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
    if (typeof line !== 'string') return [];
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
    return parts.map((p) => p.trim());
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
    if (
        trimmed === SYSTEM_CATEGORY_IDLE ||
        trimmed === SYSTEM_CATEGORY_UNKNOWN ||
        trimmed.startsWith(SYSTEM_CATEGORY_PAGE_BREAK)
    )
        return false;
    return true;
}

const VALID_COLORS = [
    'primary',
    'secondary',
    'tertiary',
    'error',
    'neutral',
    'outline',
    'teal',
    'green',
    'yellow',
    'orange',
    'pink',
    'indigo',
    'brown',
    'cyan',
    'retro-lcd',
    'retro-crt',
    'retro-nixie',
];

/**
 * Validates if the color is in the predefined list.
 * @param {string} color
 * @returns {boolean}
 */
export function isValidColor(color) {
    if (typeof color !== 'string') return false;
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
    if (typeof baseName !== 'string') return '';
    if (!Array.isArray(existingNames)) return baseName;
    const cleanBase = baseName.replace(/\s*\(\d+\)$/, '').trim();
    let maxNum = 0;
    const pattern = new RegExp(`^${cleanBase.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}\\s*\\((\\d+)\\)$`);

    existingNames.forEach((name) => {
        if (typeof name !== 'string') return;
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

/**
 * Generates a UUID or a fallback unique string.
 * crypto.randomUUID is only available in secure contexts.
 * @returns {string}
 */
export function generateUUID() {
    const cryptoObj =
        (typeof globalThis !== 'undefined' && globalThis.crypto) ||
        (typeof window !== 'undefined' && window.crypto) ||
        (typeof self !== 'undefined' && self.crypto) ||
        (typeof crypto !== 'undefined' ? crypto : null);

    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
    }
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        cryptoObj.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 1 (RFC 4122)
        var hex = '';
        for (var i = 0; i < bytes.length; i++) {
            var byteHex = bytes[i].toString(16);
            hex += byteHex.length === 1 ? '0' + byteHex : byteHex;
        }
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    let seed =
        ((typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()) ^
            (Math.random() * 0xffffffff)) >>>
        0;
    if (seed === 0) seed = 0x12345678;
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const r = (seed >>> 0) % 16;
        return (c ^ (r >> (c / 4))).toString(16);
    });
}

/**
 * Floors a timestamp to the nearest minute (00 seconds).
 * @param {number} ms
 * @returns {number}
 */
export function floorToMinute(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return 0;
    return Math.floor(ms / 60000) * 60000;
}

/**
 * Sanitizes and bounds custom animation renderSpec parameters to safe limits and defaults.
 * @param {any} rawSpec
 * @returns {Object} Safe renderSpec object
 */
export function sanitizeRenderSpec(rawSpec) {
    const spec = rawSpec && typeof rawSpec === 'object' ? rawSpec : {};

    const parseNum = (val, min, max, defaultVal) => {
        if (val === null || val === undefined || val === '') return defaultVal;
        const num = Number(val);
        return Number.isFinite(num) ? Math.max(min, Math.min(max, num)) : defaultVal;
    };

    const parseBool = (val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return Boolean(val);
    };

    return {
        focusX: parseNum(spec.focusX, -5000, 5000, 0),
        focusY: parseNum(spec.focusY, -5000, 5000, 0),
        targetHeight: parseNum(spec.targetHeight, 10, 2000, 100),
        maxWidth: parseNum(spec.maxWidth, 10, 5000, 2030),
        scaleWithHeight: parseBool(spec.scaleWithHeight),
        invert: parseBool(spec.invert),
        overflowBehavior: spec.overflowBehavior === 'repeat' ? 'repeat' : 'categoryColor',
        brightness: parseNum(spec.brightness, 0.1, 3.0, 1.0),
    };
}

/**
 * Returns default pause animation and pause theme depending on current date (season).
 * - October (month index 9): 'halloween_jack', 'retro-nixie'
 * - November to January (month index 10, 11, 0): 'snow_fall', 'cyan'
 * - Other periods (February to September): 'snoring_zzz', 'outline'
 *
 * @param {Date} [date=new Date()]
 * @returns {{ pauseAnimation: string, pauseTheme: string }}
 */
export function getSeasonalPauseDefaults(date = new Date()) {
    const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
    const month = d.getMonth(); // 0 = Jan, 9 = Oct, 10 = Nov, 11 = Dec

    if (month === 9) {
        return { pauseAnimation: 'halloween_jack', pauseTheme: 'retro-nixie' };
    } else if (month === 10 || month === 11 || month === 0) {
        return { pauseAnimation: 'snow_fall', pauseTheme: 'cyan' };
    } else {
        return { pauseAnimation: 'snoring_zzz', pauseTheme: 'outline' };
    }
}
