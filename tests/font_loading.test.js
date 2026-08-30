import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('ensureGoogleFontLoaded in app.js', () => {
    const getFnInContext = (protocol) => {
        const appJsPath = resolve(process.cwd(), 'projects/app/js/app.js');
        const code = readFileSync(appJsPath, 'utf-8');
        const fnMatch = code.match(/(function ensureGoogleFontLoaded[\s\S]*?\n\})/);
        expect(fnMatch).not.toBeNull();

        const mockWindow = {
            location: { protocol },
        };
        // eslint-disable-next-line no-eval
        return eval(`(function(window, document) { return ${fnMatch[1]}; })(mockWindow, document)`);
    };

    beforeEach(() => {
        document.head.replaceChildren();
    });

    test('skips creating link elements when protocol is chrome-extension:', () => {
        const ensureGoogleFontLoaded = getFnInContext('chrome-extension:');
        ensureGoogleFontLoaded("'Roboto', sans-serif");

        const links = document.querySelectorAll('link[id^="google-font-link-"]');
        expect(links.length).toBe(0);
    });

    test('creates link elements in http: or https: protocol context', () => {
        const ensureGoogleFontLoaded = getFnInContext('https:');
        ensureGoogleFontLoaded("'Roboto', sans-serif");

        const links = document.querySelectorAll('link[id^="google-font-link-"]');
        expect(links.length).toBeGreaterThan(0);
        expect(links[0].href).toContain('fonts.googleapis.com');
    });
});
