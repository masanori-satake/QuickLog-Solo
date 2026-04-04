/**
 * QuickLog-Solo: i18n Translation Utility
 */

import { messages } from './messages.js';

let currentLanguage = 'en';

/**
 * Detects the browser language and returns the best matching language code.
 * Supports 'lang' query parameter as a hint.
 * @returns {string}
 */
export function detectBrowserLanguage() {
    if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        const langParam = urlParams.get('lang');
        if (langParam && messages[langParam]) {
            return langParam;
        }
    }

    const lang = (typeof navigator !== 'undefined') ? (navigator.language || navigator.userLanguage) : 'en';
    const prefixes = ['ja', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];
    for (const prefix of prefixes) {
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
        currentLanguage = detectBrowserLanguage();
    } else if (messages[lang]) {
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
    let message = messages[currentLanguage][key] || messages['_common']?.[key] || messages['en'][key] || key;

    // Simple placeholder replacement
    Object.keys(params).forEach(param => {
        message = message.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });

    return message;
}

/**
 * Updates all elements with data-i18n and data-i18n-title attributes.
 * Exported for testing purposes only.
 */
export function applyLanguage() {
    if (typeof document === 'undefined') return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}
