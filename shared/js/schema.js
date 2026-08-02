/**
 * QuickLog-Solo: Schema Definitions and Validation
 * Aligned with docs/schema/*.schema.json
 */

import { isValidCategoryName, isValidColor } from './utils.js';

export const SCHEMA_VERSION_1_0 = '1.0';
export const SCHEMA_VERSION_2_0 = '2.0';

export const SCHEMA_KIND_CATEGORY = 'QuickLogSolo/Category';
export const SCHEMA_KIND_HISTORY = 'QuickLogSolo/History';
export const SCHEMA_KIND_SETTINGS = 'QuickLogSolo/Settings';
export const SCHEMA_KIND_ALARM = 'QuickLogSolo/Alarm';
export const SCHEMA_KIND_CUSTOM_ANIMATION = 'QuickLogSolo/CustomAnimation';

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
        if (data.tags !== undefined) {
            if (!Array.isArray(data.tags)) return false;
            if (data.tags.length > 20) return false;
            for (const tag of data.tags) {
                if (typeof tag !== 'string' || tag.length === 0 || tag.length > 30) return false;
            }
        }
        if (data.animation !== undefined && (typeof data.animation !== 'string' || data.animation.length > 50))
            return false;
        return true;
    } else if (data.type === SCHEMA_TYPE_PAGE_BREAK) {
        // Page breaks must NOT have category-specific properties
        return (
            data.name === undefined &&
            data.color === undefined &&
            data.tags === undefined &&
            data.animation === undefined
        );
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
        if (data.tags !== undefined) {
            if (!Array.isArray(data.tags)) return false;
            if (data.tags.length > 20) return false;
            for (const tag of data.tags) {
                if (typeof tag !== 'string' || tag.length === 0 || tag.length > 30) return false;
            }
        }
        if (data.memo !== undefined && (typeof data.memo !== 'string' || data.memo.length > 1000)) return false;
        if (data.resumableCategory !== undefined || data.isManualStop !== undefined) return false;
        return true;
    } else if (type === SCHEMA_TYPE_HISTORY_IDLE) {
        if (
            data.resumableCategory !== undefined &&
            data.resumableCategory !== null &&
            (typeof data.resumableCategory !== 'string' || data.resumableCategory.length > 100)
        )
            return false;
        if (
            data.category !== undefined ||
            data.color !== undefined ||
            data.tags !== undefined ||
            data.isManualStop !== undefined
        )
            return false;
        return true;
    } else if (type === SCHEMA_TYPE_HISTORY_STOP) {
        if (typeof data.endTime !== 'number' || data.isManualStop !== true) return false;
        if (
            data.category !== undefined ||
            data.color !== undefined ||
            data.tags !== undefined ||
            data.memo !== undefined ||
            data.resumableCategory !== undefined
        )
            return false;
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
    if (
        data.app !== 'QuickLog-Solo' ||
        data.kind !== SCHEMA_KIND_SETTINGS ||
        (data.version !== SCHEMA_VERSION_1_0 && data.version !== SCHEMA_VERSION_2_0)
    )
        return false;
    if (!Array.isArray(data.entries)) return false;

    const allowedKeys = ['theme', 'font', 'defaultAnimation', 'language', 'reportSettings', 'businessDays', 'alarms'];

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
            case 'businessDays': {
                if (!Array.isArray(val)) return false;
                if (val.length === 0 || val.length > 7) return false;
                for (const d of val) {
                    if (![0, 1, 2, 3, 4, 5, 6].includes(d)) return false;
                }
                break;
            }
            case 'alarms': {
                if (!Array.isArray(val)) return false;
                for (const alarm of val) {
                    if (typeof alarm !== 'object' || alarm === null) return false;
                    const required = [
                        'enabled',
                        'time',
                        'message',
                        'action',
                        'actionCategory',
                        'requireConfirmation',
                        'type',
                        'daysOfWeek',
                        'dayOfMonth',
                        'daysBeforeEnd',
                        'holidayAdjustment',
                    ];
                    for (const k of required) {
                        if (alarm[k] === undefined) return false;
                    }
                    if (typeof alarm.enabled !== 'boolean') return false;
                    if (typeof alarm.time !== 'string' || !alarm.time.match(/^([01]\d|2[0-3]):([0-5]\d)$/))
                        return false;
                    if (typeof alarm.message !== 'string' || alarm.message.length > 200) return false;
                    if (!['none', 'stop', 'pause', 'start'].includes(alarm.action)) return false;
                    if (typeof alarm.actionCategory !== 'string' || alarm.actionCategory.length > 100) return false;
                    if (typeof alarm.requireConfirmation !== 'boolean') return false;

                    if (!['daily_business', 'weekly', 'monthly_date', 'monthly_end_relative'].includes(alarm.type))
                        return false;
                    if (!Array.isArray(alarm.daysOfWeek)) return false;
                    for (const d of alarm.daysOfWeek) {
                        if (![0, 1, 2, 3, 4, 5, 6].includes(d)) return false;
                    }
                    if (typeof alarm.dayOfMonth !== 'number' || alarm.dayOfMonth < 1 || alarm.dayOfMonth > 31)
                        return false;
                    if (typeof alarm.daysBeforeEnd !== 'number' || alarm.daysBeforeEnd < 0 || alarm.daysBeforeEnd > 31)
                        return false;
                    if (!['none', 'prev_business_day', 'next_business_day', 'skip'].includes(alarm.holidayAdjustment))
                        return false;
                }
                break;
            }
        }
    }

    return true;
}

/**
 * Validates an object against the Alarm Schema (v2.0).
 * Validates the full alarm backup object including kind, version, and entries.
 * @param {any} data
 * @returns {boolean}
 */
export function validateAlarmSchema(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.kind !== SCHEMA_KIND_ALARM || data.version !== SCHEMA_VERSION_2_0) return false;
    if (!Array.isArray(data.entries)) return false;

    for (const entry of data.entries) {
        if (!entry || typeof entry !== 'object') return false;

        if (typeof entry.enabled !== 'boolean') return false;
        if (typeof entry.time !== 'string' || !entry.time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) return false;
        if (typeof entry.message !== 'string' || entry.message.length > 200) return false;
        if (!['none', 'stop', 'pause', 'start'].includes(entry.action)) return false;
        if (typeof entry.actionCategory !== 'string' || entry.actionCategory.length > 100) return false;
        if (typeof entry.requireConfirmation !== 'boolean') return false;

        if (!['daily_business', 'weekly', 'monthly_date', 'monthly_end_relative'].includes(entry.type)) return false;
        if (!Array.isArray(entry.daysOfWeek)) return false;
        for (const d of entry.daysOfWeek) {
            if (typeof d !== 'number' || d < 0 || d > 6) return false;
        }
        if (typeof entry.dayOfMonth !== 'number' || entry.dayOfMonth < 1 || entry.dayOfMonth > 31) return false;
        if (typeof entry.daysBeforeEnd !== 'number' || entry.daysBeforeEnd < 0 || entry.daysBeforeEnd > 31)
            return false;
        if (!['none', 'prev_business_day', 'next_business_day', 'skip'].includes(entry.holidayAdjustment))
            return false;
    }

    return true;
}

/**
 * Validates an object against the Custom Animation Schema (v2.0).
 * Validates the full custom animation backup object including kind, version, and entries.
 * @param {any} data
 * @returns {boolean}
 */
export function validateCustomAnimationSchema(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.kind !== SCHEMA_KIND_CUSTOM_ANIMATION || data.version !== SCHEMA_VERSION_2_0) return false;
    if (!Array.isArray(data.entries)) return false;

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const entry of data.entries) {
        if (!entry || typeof entry !== 'object') return false;

        if (typeof entry.id !== 'string' || entry.id.length < 1 || entry.id.length > 50) return false;
        if (!uuidPattern.test(entry.id)) return false;
        if (typeof entry.name !== 'string' || entry.name.length < 1 || entry.name.length > 100) return false;
        if (entry.description !== undefined) {
            if (typeof entry.description !== 'string' || entry.description.length > 500) return false;
        }
        if (typeof entry.config !== 'object' || entry.config === null || Array.isArray(entry.config)) return false;
        if (typeof entry.renderSpec !== 'object' || entry.renderSpec === null || Array.isArray(entry.renderSpec))
            return false;
    }

    return true;
}
