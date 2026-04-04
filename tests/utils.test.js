import {
    escapeHtml, escapeCsv, escapeTsv, parseCsvLine, isValidCategoryName, isValidColor, generateDuplicateName
} from '../shared/js/utils.js';

describe('Utils Module', () => {
    describe('escapeHtml', () => {
        test('escapes special characters', () => {
            expect(escapeHtml('<b>"Me & You"</b>')).toBe('&lt;b&gt;&quot;Me &amp; You&quot;&lt;/b&gt;');
        });
        test('returns non-string values as is', () => {
            expect(escapeHtml(123)).toBe(123);
            expect(escapeHtml(null)).toBe(null);
        });
    });

    describe('escapeCsv', () => {
        test('quotes fields with commas', () => {
            expect(escapeCsv('a,b')).toBe('"a,b"');
        });
        test('escapes quotes', () => {
            expect(escapeCsv('a"b')).toBe('"a""b"');
        });
        test('handles newlines', () => {
            expect(escapeCsv('a\nb')).toBe('"a\nb"');
        });
        test('handles carriage returns', () => {
            expect(escapeCsv('a\rb')).toBe('"a\rb"');
        });
        test('returns non-string values as is', () => {
            expect(escapeCsv(123)).toBe(123);
        });
    });

    describe('escapeTsv', () => {
        test('quotes fields with tabs', () => {
            expect(escapeTsv('a\tb')).toBe('"a\tb"');
        });
        test('escapes quotes', () => {
            expect(escapeTsv('a"b')).toBe('"a""b"');
        });
        test('handles newlines', () => {
            expect(escapeTsv('a\nb')).toBe('"a\nb"');
        });
        test('handles carriage returns', () => {
            expect(escapeTsv('a\rb')).toBe('"a\rb"');
        });
        test('does not quote fields with commas', () => {
            expect(escapeTsv('a,b')).toBe('a,b');
        });
        test('returns non-string values as is', () => {
            expect(escapeTsv(123)).toBe(123);
        });
    });

    describe('parseCsvLine', () => {
        test('parses simple CSV line', () => {
            expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
        });
        test('handles quoted fields with commas', () => {
            expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
        });
        test('handles escaped quotes', () => {
            expect(parseCsvLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
        });
    });

    describe('isValidCategoryName', () => {
        test('validates correctly', () => {
            expect(isValidCategoryName('Work')).toBe(true);
            expect(isValidCategoryName('  ')).toBe(false);
            expect(isValidCategoryName('')).toBe(false);
            expect(isValidCategoryName('a'.repeat(51))).toBe(false);
            expect(isValidCategoryName('__IDLE__')).toBe(false);
            expect(isValidCategoryName('__PAGE_BREAK__')).toBe(false);
            expect(isValidCategoryName('__PAGE_BREAK___123')).toBe(false);
            expect(isValidCategoryName(123)).toBe(false);
            expect(isValidCategoryName(null)).toBe(false);
        });
    });

    describe('isValidColor', () => {
        test('validates predefined colors', () => {
            expect(isValidColor('primary')).toBe(true);
            expect(isValidColor('teal')).toBe(true);
            expect(isValidColor('not-a-color')).toBe(false);
        });
    });

    describe('generateDuplicateName', () => {
        test('appends (1) when no duplicates exist', () => {
            expect(generateDuplicateName('Task', [])).toBe('Task (1)');
        });

        test('increments number based on existing suffixes', () => {
            expect(generateDuplicateName('Task', ['Task (1)', 'Task (2)'])).toBe('Task (3)');
        });

        test('handles base name with existing suffix', () => {
            expect(generateDuplicateName('Task (1)', ['Task (1)'])).toBe('Task (2)');
        });

        test('ignores unrelated names', () => {
            expect(generateDuplicateName('Task', ['Other (1)'])).toBe('Task (1)');
        });

        test('finds maximum number even if out of order', () => {
            expect(generateDuplicateName('Task', ['Task (5)', 'Task (2)'])).toBe('Task (6)');
        });

        test('handles special characters in base name', () => {
            expect(generateDuplicateName('Task [A]', ['Task [A] (1)'])).toBe('Task [A] (2)');
        });

        test('handles multi-byte characters', () => {
            expect(generateDuplicateName('作業', ['作業'])).toBe('作業 (1)');
            expect(generateDuplicateName('作業 (1)', ['作業 (1)', '作業 (2)'])).toBe('作業 (3)');
        });

        test('handles cases where base name is part of another name', () => {
            expect(generateDuplicateName('Task', ['Task-Force (1)'])).toBe('Task (1)');
        });

        test('handles large numbers', () => {
            expect(generateDuplicateName('Task', ['Task (999)'])).toBe('Task (1000)');
        });
    });

});
