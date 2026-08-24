/**
 * Shared theme initialization helper for subproject standalone pages.
 * Resolves theme from URL query param ('theme'), localStorage key(s), or system color scheme preference.
 *
 * @param {string|string[]} storageKey - localStorage key or array of keys to check for saved theme.
 * @param {'light'|'dark'} defaultTheme - Default theme declared on <body> ('light' or 'dark').
 */
function initTheme(storageKey, defaultTheme = 'light') {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');

    let savedTheme = null;
    if (Array.isArray(storageKey)) {
        for (const key of storageKey) {
            const val = localStorage.getItem(key);
            if (val) {
                savedTheme = val;
                break;
            }
        }
    } else if (storageKey) {
        savedTheme = localStorage.getItem(storageKey);
    }

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const prefersLight = window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches;

    let resolvedTheme = defaultTheme;
    if (themeParam === 'light' || themeParam === 'dark') {
        resolvedTheme = themeParam;
    } else if (savedTheme === 'light' || savedTheme === 'dark') {
        resolvedTheme = savedTheme;
    } else if (defaultTheme === 'light' && prefersDark) {
        resolvedTheme = 'dark';
    } else if (defaultTheme === 'dark' && prefersLight) {
        resolvedTheme = 'light';
    }

    const currentThemeClass = defaultTheme === 'dark' ? 'theme-dark' : 'theme-light';
    const targetThemeClass = resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light';

    if (currentThemeClass !== targetThemeClass) {
        document.body.classList.replace(currentThemeClass, targetThemeClass);
    }
}

if (typeof window !== 'undefined') {
    window.initTheme = initTheme;
}
