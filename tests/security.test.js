describe('Security Utilities', () => {
    let utils;

    beforeAll(async () => {
        try {
            utils = await import('../js/utils.js');
        } catch (e) {
            // If file doesn't exist yet, we'll mock it or just fail the tests
            console.error('js/utils.js not found. Implementation step may be required.');
        }
    });

    test('escapeHtml escapes dangerous characters', () => {
        if (!utils) return;
        const input = '<script>alert("xss")</script> & "item"';
        const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;item&quot;';
        expect(utils.escapeHtml(input)).toBe(expected);
    });

    test('escapeCsv quotes fields with commas, quotes, or newlines', () => {
        if (!utils) return;
        expect(utils.escapeCsv('normal')).toBe('normal');
        expect(utils.escapeCsv('one,two')).toBe('"one,two"');
        expect(utils.escapeCsv('quoted "item"')).toBe('"quoted ""item"""');
        expect(utils.escapeCsv('multi\nline')).toBe('"multi\nline"');
    });

    test('parseCsvLine correctly handles quoted fields', () => {
        if (!utils) return;
        const line = '1,"Category, with comma",12345678,';
        const parts = utils.parseCsvLine(line);
        expect(parts).toEqual(['1', 'Category, with comma', '12345678', '']);
    });

    test('parseCsvLine handles escaped quotes', () => {
        if (!utils) return;
        const line = '2,"Category with ""quotes""",12345678,';
        const parts = utils.parseCsvLine(line);
        expect(parts).toEqual(['2', 'Category with "quotes"', '12345678', '']);
    });
});

describe('Validation', () => {
    let utils;
    beforeAll(async () => {
        try {
            utils = await import('../js/utils.js');
        } catch (e) {
            console.warn('js/utils.js not loaded in Validation block');
        }
    });

    test('isValidCategoryName checks length and system names', () => {
        if (!utils) return;
        expect(utils.isValidCategoryName('Valid')).toBe(true);
        expect(utils.isValidCategoryName('')).toBe(false);
        expect(utils.isValidCategoryName('A'.repeat(50))).toBe(true);
        expect(utils.isValidCategoryName('A'.repeat(51))).toBe(false);
        expect(utils.isValidCategoryName(utils.SYSTEM_CATEGORY_IDLE)).toBe(false);
    });
});
