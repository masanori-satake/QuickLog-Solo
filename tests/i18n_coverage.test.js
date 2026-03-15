import { messages } from '../shared/js/messages.js';

describe('i18n Coverage', () => {
    const baseLang = 'en';
    const allLanguages = Object.keys(messages).filter(lang => lang !== '_common');
    const targetLanguages = allLanguages.filter(lang => lang !== baseLang);
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

    test('all languages in messages should be valid', async () => {
        allLanguages.forEach(code => {
            expect(messages[code]).toBeDefined();
        });
    });
});
