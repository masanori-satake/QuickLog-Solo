/**
 * QuickLog-Solo: Schema Definitions and Validation
 * Aligned with docs/schema/*.schema.json
 */

import { isValidCategoryName, isValidColor } from './utils.js';

export const SCHEMA_VERSION_1_0 = '1.0';

export const SCHEMA_KIND_CATEGORY = 'QuickLogSolo/Category';
export const SCHEMA_KIND_HISTORY = 'QuickLogSolo/History';
export const SCHEMA_KIND_SETTINGS = 'QuickLogSolo/Settings';

export const SCHEMA_TYPE_CATEGORY = 'category';
export const SCHEMA_TYPE_PAGE_BREAK = 'page-break';

export const SCHEMA_TYPE_HISTORY_TASK = 'task';
export const SCHEMA_TYPE_HISTORY_IDLE = 'idle';
export const SCHEMA_TYPE_HISTORY_STOP = 'stop';

/**
 * Validates an object against the Category Schema (v1.0).
 * @param {any} data
 * @returns {boolean}
 */
export function validateCategorySchema(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.kind !== SCHEMA_KIND_CATEGORY || data.version !== SCHEMA_VERSION_1_0) return false;

    if (data.type === SCHEMA_TYPE_CATEGORY) {
        if (!isValidCategoryName(data.name)) return false;
        if (!isValidColor(data.color)) return false;
        if (data.tags !== undefined && !Array.isArray(data.tags)) return false;
        if (data.animation !== undefined && (typeof data.animation !== 'string' || data.animation.length > 50)) return false;
        if (data.order !== undefined && typeof data.order !== 'number') return false;
        return true;
    } else if (data.type === SCHEMA_TYPE_PAGE_BREAK) {
        // Page breaks must NOT have category-specific properties
        if (data.order !== undefined && typeof data.order !== 'number') return false;
        return data.name === undefined &&
               data.color === undefined &&
               data.tags === undefined &&
               data.animation === undefined;
    }

    return false;
}

/**
 * Validates an object against the History Schema (v1.0).
 * @param {any} data
 * @returns {boolean}
 */
export function validateHistorySchema(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.kind !== SCHEMA_KIND_HISTORY || data.version !== SCHEMA_VERSION_1_0) return false;
    if (typeof data.startTime !== 'number') return false;

    const type = data.type;
    if (type === SCHEMA_TYPE_HISTORY_TASK) {
        if (typeof data.category !== 'string' || data.category.length === 0 || data.category.length > 100) return false;
        if (data.color !== undefined && !isValidColor(data.color)) return false;
        if (data.tags !== undefined && !Array.isArray(data.tags)) return false;
        if (data.memo !== undefined && (typeof data.memo !== 'string' || data.memo.length > 100)) return false;
        if (data.resumableCategory !== undefined || data.isManualStop !== undefined) return false;
        return true;
    } else if (type === SCHEMA_TYPE_HISTORY_IDLE) {
        if (data.resumableCategory !== undefined && (typeof data.resumableCategory !== 'string' || data.resumableCategory.length > 100)) return false;
        if (data.category !== undefined || data.color !== undefined || data.tags !== undefined || data.isManualStop !== undefined) return false;
        return true;
    } else if (type === SCHEMA_TYPE_HISTORY_STOP) {
        if (typeof data.endTime !== 'number' || data.isManualStop !== true) return false;
        if (data.category !== undefined || data.color !== undefined || data.tags !== undefined || data.memo !== undefined || data.resumableCategory !== undefined) return false;
        return true;
    }

    return false;
}

/**
 * Validates an object against the Settings Schema (v1.0).
 * @param {any} data
 * @returns {boolean}
 */
export function validateSettingsSchema(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.app !== 'QuickLog-Solo' || data.kind !== SCHEMA_KIND_SETTINGS || data.version !== SCHEMA_VERSION_1_0) return false;
    if (!Array.isArray(data.entries)) return false;

    const allowedKeys = ['theme', 'font', 'defaultAnimation', 'language', 'reportSettings'];

    for (const entry of data.entries) {
        if (!entry || typeof entry !== 'object' || !allowedKeys.includes(entry.key)) return false;

        const key = entry.key;
        const val = entry.value;

        switch (key) {
            case 'theme':
                if (!['system', 'light', 'dark'].includes(val)) return false;
                break;
            case 'font':
                if (typeof val !== 'string' || val.length > 200) return false;
                break;
            case 'defaultAnimation':
                if (typeof val !== 'string' || val.length > 50) return false;
                break;
            case 'language':
                if (!['auto', 'ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'].includes(val)) return false;
                break;
            case 'reportSettings': {
                if (typeof val !== 'object' || val === null) return false;
                const required = ['format', 'emoji', 'endTime', 'duration', 'adjust'];
                for (const k of required) {
                    if (val[k] === undefined) return false;
                }
                if (!['markdown', 'wiki', 'html', 'csv', 'text-plain', 'text-table'].includes(val.format)) return false;
                if (!['keep', 'remove'].includes(val.emoji)) return false;
                if (!['none', 'show'].includes(val.endTime)) return false;
                if (!['none', 'right', 'bottom'].includes(val.duration)) return false;
                if (!['none', '5', '10', '15', '30', '60'].includes(val.adjust)) return false;
                break;
            }
        }
    }

    return true;
}
