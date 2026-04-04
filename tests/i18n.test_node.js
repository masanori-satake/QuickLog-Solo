import { detectBrowserLanguage, setLanguage, getLanguage, t } from '../shared/js/i18n.js';
import { messages } from '../shared/js/messages.js';

/**
 * @jest-environment node
 */

describe('i18n Module', () => {
    beforeEach(() => {
        setLanguage('en');
        // Clear global mocks
        global.window = undefined;
        global.navigator = undefined;
    });

    describe('detectBrowserLanguage', () => {
        test('detects language from URL parameter', () => {
            // Using a plain object to mock window
            global.window = {
                location: {
                    search: '?lang=ja'
                }
            };
            expect(detectBrowserLanguage()).toBe('ja');
        });

        test('detects language from navigator.language', () => {
            global.navigator = { language: 'de-DE' };
            expect(detectBrowserLanguage()).toBe('de');

            global.navigator = { language: 'fr' };
            expect(detectBrowserLanguage()).toBe('fr');
        });

        test('detects language from navigator.userLanguage', () => {
            global.navigator = { userLanguage: 'es' };
            expect(detectBrowserLanguage()).toBe('es');
        });

        test('fallbacks to en for unsupported language', () => {
            global.navigator = { language: 'it' };
            expect(detectBrowserLanguage()).toBe('en');
        });

        test('handles missing window or navigator gracefully', () => {
            expect(detectBrowserLanguage()).toBe('en');
        });
    });

    describe('setLanguage and getLanguage', () => {
        test('sets and gets language correctly', () => {
            setLanguage('ja');
            expect(getLanguage()).toBe('ja');
        });

        test('handles auto behavior correctly', () => {
            global.navigator = { language: 'ko' };
            setLanguage('auto');
            expect(getLanguage()).toBe('ko');
        });

        test('fallbacks to en for invalid language in setLanguage', () => {
            setLanguage('invalid');
            expect(getLanguage()).toBe('en');
        });
    });

    describe('t (translation)', () => {
        test('translates keys correctly', () => {
            setLanguage('ja');
            expect(t('init-cat-dev')).toBe(messages.ja['init-cat-dev']);
        });

        test('fallbacks to en then key itself', () => {
            setLanguage('ja');
            const unknownKey = 'this-key-does-not-exist-anywhere';
            expect(t(unknownKey)).toBe(unknownKey);
        });

        test('replaces placeholders correctly', () => {
            setLanguage('en');
            const result = t('backup-err-unknown', { message: 'Failed' });
            expect(result).toContain('Failed');
        });
    });
});
