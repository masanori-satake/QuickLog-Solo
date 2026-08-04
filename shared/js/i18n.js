/**
 * QuickLog-Solo: i18n Translation Utility
 */

import { messages } from './messages.js';

let currentLanguage = 'en';

const SUPPORTED_LOCALES = Object.keys(messages).filter((key) => key !== '_common');

/**
 * Detects the browser language and returns the best matching language code.
 * Supports 'lang' query parameter as a hint.
 * @returns {string}
 */
export function detectBrowserLanguage() {
    if (typeof window !== 'undefined' && window.location) {
        const search = window.location.search || '';
        const urlParams = new URLSearchParams(search);
        const langParam = urlParams.get('lang');
        if (langParam && SUPPORTED_LOCALES.includes(langParam)) {
            return langParam;
        }
    }

    const lang = typeof navigator !== 'undefined' ? navigator.language || navigator.userLanguage || 'en' : 'en';
    for (const prefix of SUPPORTED_LOCALES) {
        if (lang.startsWith(prefix)) return prefix;
    }
    return 'en';
}

/**
 * Sets the current language.
 * @param {string} lang - 'ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh' or 'auto'
 */
export function setLanguage(lang) {
    if (lang === 'auto') {
        const detected = detectBrowserLanguage();
        currentLanguage = SUPPORTED_LOCALES.includes(detected) ? detected : 'en';
    } else if (typeof lang === 'string' && SUPPORTED_LOCALES.includes(lang)) {
        currentLanguage = lang;
    } else {
        currentLanguage = 'en'; // Fallback
    }
}

/**
 * Returns the current language code.
 * @returns {string}
 */
export function getLanguage() {
    return currentLanguage;
}

/**
 * Translates a key into the current language.
 * @param {string} key
 * @param {Object} params - Key-value pairs for placeholders like {name}
 * @returns {string}
 */
export function t(key, params = {}) {
    if (typeof key !== 'string') return '';
    const safeParams = params && typeof params === 'object' ? params : {};

    let message;
    const lookupInDict = (dict) => {
        if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
            const val = dict[key];
            if (typeof val === 'string' || Array.isArray(val)) {
                return val;
            }
        }
        return null;
    };

    const currentDict = messages[currentLanguage];
    const commonDict = messages['_common'];
    const enDict = messages['en'];

    const foundInCurrent = lookupInDict(currentDict);
    if (foundInCurrent !== null) {
        message = foundInCurrent;
    } else {
        const foundInCommon = lookupInDict(commonDict);
        if (foundInCommon !== null) {
            message = foundInCommon;
        } else {
            const foundInEn = lookupInDict(enDict);
            if (foundInEn !== null) {
                message = foundInEn;
            } else {
                message = key;
            }
        }
    }

    if (Array.isArray(message)) {
        return message.map((item) => {
            if (typeof item !== 'string') return item;
            let itemStr = item;
            Object.keys(safeParams).forEach((param) => {
                const replacement = String(safeParams[param]);
                itemStr = itemStr.split(`{${param}}`).join(replacement);
            });
            return itemStr;
        });
    }

    // Simple placeholder replacement
    let msgStr = String(message);
    Object.keys(safeParams).forEach((param) => {
        const replacement = String(safeParams[param]);
        msgStr = msgStr.split(`{${param}}`).join(replacement);
    });

    return msgStr;
}

/**
 * Updates all elements with data-i18n and data-i18n-title attributes.
 * Exported for testing purposes only.
 */
export function applyLanguage() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}
