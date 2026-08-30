import { ensureGoogleFontLoaded } from '../shared/js/font_utils.js';

describe('ensureGoogleFontLoaded', () => {
    let impl;
    let originalScheme;

    beforeAll(() => {
        const symbols = Object.getOwnPropertySymbols(window.location);
        const implSymbol = symbols.find((s) => s.description === 'impl');
        if (implSymbol) {
            impl = window.location[implSymbol];
            if (impl && impl._url) {
                originalScheme = impl._url.scheme;
            }
        }
    });

    beforeEach(() => {
        document.head.replaceChildren();
    });

    afterEach(() => {
        if (impl && impl._url && originalScheme) {
            impl._url.scheme = originalScheme;
        }
    });

    test('creates link elements in chrome-extension:, http:, and https: protocol contexts', () => {
        const protocols = ['chrome-extension', 'http', 'https'];

        protocols.forEach((scheme) => {
            document.head.replaceChildren();
            if (impl && impl._url) {
                impl._url.scheme = scheme;
            }

            ensureGoogleFontLoaded("'Roboto', sans-serif");

            const links = document.querySelectorAll('link[id^="google-font-link-"]');
            expect(links.length).toBeGreaterThan(0);
            expect(links[0].href).toContain('fonts.googleapis.com');
        });
    });

    test('creates link elements for Japanese web fonts in http context', () => {
        if (impl && impl._url) {
            impl._url.scheme = 'http';
        }

        const japaneseFonts = [
            "'Dela Gothic One', sans-serif",
            "'Yusei Magic', sans-serif",
            "'Noto Sans JP', sans-serif",
        ];

        japaneseFonts.forEach((font) => {
            document.head.replaceChildren();
            ensureGoogleFontLoaded(font);

            const links = document.querySelectorAll('link[id^="google-font-link-"]');
            expect(links.length).toBeGreaterThan(0);
            expect(links[0].href).toContain('fonts.googleapis.com');
        });
    });
});
