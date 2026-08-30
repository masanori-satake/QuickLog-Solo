/**
 * Ensures Google Fonts stylesheets are loaded dynamically if needed.
 * Skips loading in Chrome extension contexts to satisfy Content Security Policy (CSP).
 *
 * @param {string} fontValue - Font family CSS string containing family names.
 */
export function ensureGoogleFontLoaded(fontValue) {
    if (!fontValue || typeof fontValue !== 'string') return Promise.resolve();
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'chrome-extension:') {
        return Promise.resolve();
    }
    const fontFamilies = [
        'Dela Gothic One',
        'Yusei Magic',
        'Roboto',
        'Inter',
        'Montserrat',
        'Open Sans',
        'Ubuntu',
        'Noto Sans JP',
        'Noto Sans KR',
        'Noto Sans SC',
        'Noto Sans Symbols',
    ];

    const multiWeightFonts = [
        'Noto Sans JP',
        'Noto Sans KR',
        'Noto Sans SC',
        'Roboto',
        'Inter',
        'Montserrat',
        'Open Sans',
        'Ubuntu',
    ];

    const promises = [];

    fontFamilies.forEach((f) => {
        if (fontValue.includes(f)) {
            const linkId = `google-font-link-${f.replace(/\s+/g, '-').toLowerCase()}`;
            if (!document.getElementById(linkId)) {
                const linkPromise = new Promise((resolve) => {
                    const link = document.createElement('link');
                    link.id = linkId;
                    link.rel = 'stylesheet';
                    const familyQuery = multiWeightFonts.includes(f)
                        ? `${encodeURIComponent(f)}:wght@400;500;700`
                        : encodeURIComponent(f);
                    link.href = `https://fonts.googleapis.com/css2?family=${familyQuery}&display=swap`;
                    link.onload = () => {
                        if (
                            typeof document !== 'undefined' &&
                            document.fonts &&
                            typeof document.fonts.load === 'function'
                        ) {
                            document.fonts
                                .load(`1em "${f}"`)
                                .then(() => resolve())
                                .catch(() => resolve());
                        } else {
                            resolve();
                        }
                    };
                    link.onerror = () => {
                        // Silent fallback to local system font if offline or blocked
                        link.remove();
                        resolve();
                    };
                    document.head.appendChild(link);
                });
                promises.push(linkPromise);
            } else if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.load === 'function') {
                promises.push(document.fonts.load(`1em "${f}"`).catch(() => {}));
            }
        }
    });

    return Promise.all(promises).then(() => {});
}
