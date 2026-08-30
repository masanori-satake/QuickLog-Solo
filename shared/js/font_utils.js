/**
 * Ensures Google Fonts stylesheets are loaded dynamically if needed.
 * Skips loading in Chrome extension contexts to satisfy Content Security Policy (CSP).
 *
 * @param {string} fontValue - Font family CSS string containing family names.
 */
export function ensureGoogleFontLoaded(fontValue) {
    if (!fontValue || typeof fontValue !== 'string') return;
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'chrome-extension:') return;
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

    fontFamilies.forEach((f) => {
        if (fontValue.includes(f)) {
            const linkId = `google-font-link-${f.replace(/\s+/g, '-').toLowerCase()}`;
            if (!document.getElementById(linkId)) {
                const link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@400;500;700&display=swap`;
                link.onerror = () => {
                    // Silent fallback to local system font if offline or blocked
                    link.remove();
                };
                document.head.appendChild(link);
            }
        }
    });
}
