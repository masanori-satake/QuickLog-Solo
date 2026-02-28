/**
 * QuickLog-Solo: i18n Translation Utility
 */

import { messages } from './messages.js';

let currentLanguage = 'en';

/**
 * Detects the browser language and returns 'ja' if Japanese, otherwise 'en'.
 * Supports 'lang' query parameter as a hint.
 * @returns {string}
 */
export function detectBrowserLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    if (langParam && messages[langParam]) {
        return langParam;
    }

    const lang = navigator.language || navigator.userLanguage;
    return lang.startsWith('ja') ? 'ja' : 'en';
}

/**
 * Sets the current language.
 * @param {string} lang - 'ja', 'en', or 'auto'
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
 */
export function applyLanguage() {
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
