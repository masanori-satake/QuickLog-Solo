import { messages } from '../src/js/messages.js';

describe('i18n Coverage', () => {
    const baseLang = 'en';
    const targetLanguages = ['ja', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];
    const baseKeys = Object.keys(messages[baseLang]);

    targetLanguages.forEach(lang => {
        test(`language "${lang}" should have all keys from "${baseLang}"`, () => {
            const langKeys = Object.keys(messages[lang]);
            const missingKeys = baseKeys.filter(key => !langKeys.includes(key));

            if (missingKeys.length > 0) {
                throw new Error(`Language "${lang}" is missing the following keys: ${missingKeys.join(', ')}`);
            }
        });

        test(`language "${lang}" should have all initial categories from "${baseLang}"`, () => {
            // Specifically check init-cat-* keys as they are critical for first-run experience
            const baseCatKeys = baseKeys.filter(key => key.startsWith('init-cat-'));
            const langKeys = Object.keys(messages[lang]);
            const missingCats = baseCatKeys.filter(key => !langKeys.includes(key));

            if (missingCats.length > 0) {
                throw new Error(`Language "${lang}" is missing the following initial categories: ${missingCats.join(', ')}`);
            }
        });
    });

    test('all languages in ID_LANGUAGE_SELECT should be present in messages', async () => {
        // This is a sanity check that the codes used in app.js/app.html match messages.js
        const supportedCodes = ['en', 'ja', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];
        supportedCodes.forEach(code => {
            expect(messages[code]).toBeDefined();
        });
    });
});
