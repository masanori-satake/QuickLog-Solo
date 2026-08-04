import { detectBrowserLanguage, setLanguage, getLanguage, t, applyLanguage } from '../shared/js/i18n.js';
import { messages } from '../shared/js/messages.js';

/**
 * @jest-environment jsdom
 */

describe('i18n Module', () => {
    let originalLocation;
    let originalNavigator;

    beforeAll(() => {
        originalLocation = window.location;
        originalNavigator = window.navigator;
    });

    beforeEach(() => {
        setLanguage('en');
        // Use history.replaceState to change URL search in JSDOM safely
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, '', url.toString());

        const mockNavigator = {
            language: 'en-US',
            userLanguage: undefined
        };
        Object.defineProperty(window, 'navigator', {
            value: mockNavigator,
            configurable: true
        });
    });

    afterAll(() => {
        window.location = originalLocation;
        Object.defineProperty(window, 'navigator', {
            value: originalNavigator,
            configurable: true
        });
    });

    describe('detectBrowserLanguage', () => {
        test('detects language from URL parameter', () => {
            const url = new URL(window.location.href);
            url.search = '?lang=ja';
            window.history.replaceState({}, '', url.toString());
            expect(detectBrowserLanguage()).toBe('ja');
        });

        test('detects language from navigator.language', () => {
            Object.defineProperty(window.navigator, 'language', { value: 'de-DE', configurable: true });
            expect(detectBrowserLanguage()).toBe('de');

            Object.defineProperty(window.navigator, 'language', { value: 'fr', configurable: true });
            expect(detectBrowserLanguage()).toBe('fr');
        });

        test('detects language from navigator.userLanguage', () => {
            Object.defineProperty(window.navigator, 'language', { value: undefined, configurable: true });
            Object.defineProperty(window.navigator, 'userLanguage', { value: 'es', configurable: true });
            expect(detectBrowserLanguage()).toBe('es');
        });

        test('fallbacks to en for unsupported language', () => {
            Object.defineProperty(window.navigator, 'language', { value: 'it', configurable: true });
            expect(detectBrowserLanguage()).toBe('en');
        });

        test('handles missing navigator gracefully', () => {
            const originalNav = window.navigator;
            Object.defineProperty(window, 'navigator', { value: undefined, configurable: true });

            expect(detectBrowserLanguage()).toBe('en');

            Object.defineProperty(window, 'navigator', { value: originalNav, configurable: true });
        });
    });

    describe('setLanguage and getLanguage', () => {
        test('sets and gets language correctly', () => {
            setLanguage('ja');
            expect(getLanguage()).toBe('ja');
        });

        test('handles auto behavior correctly', () => {
            Object.defineProperty(window.navigator, 'language', { value: 'ko', configurable: true });
            setLanguage('auto');
            expect(getLanguage()).toBe('ko');
        });

        test('fallbacks to en for invalid language in setLanguage', () => {
            setLanguage('invalid');
            expect(getLanguage()).toBe('en');
        });
    });

    describe('applyLanguage', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="test-el" data-i18n="init-cat-dev"></div>
                <button id="test-btn" data-i18n-title="btn-copy"></button>
                <input id="test-input" data-i18n-placeholder="placeholder-tags">
            `;
        });

        test('applies translations to DOM elements', () => {
            setLanguage('ja');
            applyLanguage();

            expect(document.getElementById('test-el').textContent).toBe(messages.ja['init-cat-dev']);
            expect(document.getElementById('test-btn').title).toBe(messages.ja['btn-copy']);
            expect(document.getElementById('test-input').placeholder).toBe(messages.ja['placeholder-tags']);
        });

        test('handles missing attributes gracefully', () => {
            document.body.innerHTML = '<div>No i18n here</div>';
            expect(() => applyLanguage()).not.toThrow();
        });
    });

    describe('t (translation)', () => {
        test('translates keys correctly', () => {
            setLanguage('ja');
            expect(t('init-cat-dev')).toBe(messages.ja['init-cat-dev']);
        });

        test('fallbacks to _common then en then key itself', () => {
            setLanguage('ja');
            const unknownKey = 'this-key-does-not-exist-anywhere';
            expect(t(unknownKey)).toBe(unknownKey);

            // Test fallback to _common
            // If there's a common key that is missing in specific lang, it falls back to _common
            expect(t('lang-ja-native')).toBe('🇯🇵 日本語');

            // Test fallback to en when key is absent in ja and _common but present in en
            messages.en['test-en-only-key'] = 'English Fallback Message';
            if (messages.ja) {
                delete messages.ja['test-en-only-key'];
            }
            if (messages._common) {
                delete messages._common['test-en-only-key'];
            }
            expect(t('test-en-only-key')).toBe('English Fallback Message');
        });

        test('replaces placeholders correctly', () => {
            setLanguage('en');
            const result = t('backup-err-unknown', { message: 'Failed' });
            expect(result).toContain('Failed');
        });

        test('handles translation arrays correctly (e.g. day-names)', () => {
            setLanguage('ja');
            const jaDays = t('day-names');
            expect(Array.isArray(jaDays)).toBe(true);
            expect(jaDays).toEqual(['日', '月', '火', '水', '木', '金', '土']);

            setLanguage('en');
            const enDays = t('day-names');
            expect(Array.isArray(enDays)).toBe(true);
            expect(enDays).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
        });

        test('handles translation arrays with placeholder replacements robustly', () => {
            // Save original state
            const hadKey = Object.prototype.hasOwnProperty.call(messages.en, 'test-array-placeholder');
            const originalValue = hadKey ? messages.en['test-array-placeholder'] : undefined;

            try {
                // Mock an array with placeholders
                messages.en['test-array-placeholder'] = ['Hello {name}', 'Goodbye {name}'];
                setLanguage('en');
                const result = t('test-array-placeholder', { name: 'Jules' });
                expect(result).toEqual(['Hello Jules', 'Goodbye Jules']);
            } finally {
                // Restore original state
                if (hadKey) {
                    messages.en['test-array-placeholder'] = originalValue;
                } else {
                    delete messages.en['test-array-placeholder'];
                }
            }
        });
    });

    // =============================================================================
    // Property-Based Tests (Deterministic)
    // =============================================================================

    describe('Property 13: setLanguage の未知言語フォールバック (Deterministic)', () => {
        test('setLanguage with invalid language or non-string inputs falls back to en', () => {
            const invalidInputs = [
                'invalid-lang', 'fr-FR', 'valueOf', 'toString', '__proto__',
                undefined, null, 123, 4.56, { a: 1 }, [1, 2, 3]
            ];
            invalidInputs.forEach(input => {
                setLanguage('ja'); // Reset language first
                expect(getLanguage()).toBe('ja'); // Verify it is reset
                setLanguage(input); // Try to set invalid/non-string input
                expect(getLanguage()).toBe('en'); // Verify it falls back to en
            });
        });
    });

    describe('Property 14: detectBrowserLanguage の lang パラメータ優先 (Deterministic)', () => {
        test('lang parameter takes precedence', () => {
            const supported = ['ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh'];
            supported.forEach(lang => {
                const url = new URL(window.location.href);
                url.search = `?lang=${lang}`;
                window.history.replaceState({}, '', url.toString());
                expect(detectBrowserLanguage()).toBe(lang);
            });
        });
    });
});
