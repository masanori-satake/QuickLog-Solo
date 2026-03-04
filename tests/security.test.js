import * as utils from '../src/js/utils.js';

describe('Security Utilities', () => {
    test('escapeHtml escapes dangerous characters', () => {
        const input = '<script>alert("xss")</script> & "item"';
        const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;item&quot;';
        expect(utils.escapeHtml(input)).toBe(expected);
    });

    test('escapeCsv quotes fields with commas, quotes, or newlines', () => {
        expect(utils.escapeCsv('normal')).toBe('normal');
        expect(utils.escapeCsv('one,two')).toBe('"one,two"');
        expect(utils.escapeCsv('quoted "item"')).toBe('"quoted ""item"""');
        expect(utils.escapeCsv('multi\nline')).toBe('"multi\nline"');
    });

    test('parseCsvLine correctly handles quoted fields', () => {
        const line = '1,"Category, with comma",12345678,';
        const parts = utils.parseCsvLine(line);
        expect(parts).toEqual(['1', 'Category, with comma', '12345678', '']);
    });

    test('parseCsvLine handles escaped quotes', () => {
        const line = '2,"Category with ""quotes""",12345678,';
        const parts = utils.parseCsvLine(line);
        expect(parts).toEqual(['2', 'Category with "quotes"', '12345678', '']);
    });
});

describe('Validation', () => {
    test('isValidCategoryName checks length and system names', () => {
        expect(utils.isValidCategoryName('Valid')).toBe(true);
        expect(utils.isValidCategoryName('')).toBe(false);
        expect(utils.isValidCategoryName('A'.repeat(50))).toBe(true);
        expect(utils.isValidCategoryName('A'.repeat(51))).toBe(false);
        expect(utils.isValidCategoryName(utils.SYSTEM_CATEGORY_IDLE)).toBe(false);
    });
});
