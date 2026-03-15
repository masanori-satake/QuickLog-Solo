import {
    escapeHtml, escapeCsv, parseCsvLine, isValidCategoryName, isValidColor, getAutoStopTimeIfPassed
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

    describe('getAutoStopTimeIfPassed', () => {
        test('returns auto-stop time (with ms) if passed', () => {
            const startTime = new Date('2026-03-03T10:00:00').getTime();
            const now = new Date('2026-03-04T01:00:00').getTime();
            expect(getAutoStopTimeIfPassed(startTime, now)).toBe(new Date('2026-03-03T23:59:59.999').getTime());
        });
        test('returns auto-stop time even if multiple days have passed', () => {
            const startTime = new Date('2026-03-03T10:00:00').getTime();
            const now = new Date('2026-03-08T10:00:00').getTime();
            expect(getAutoStopTimeIfPassed(startTime, now)).toBe(new Date('2026-03-03T23:59:59.999').getTime());
        });
        test('returns null if not yet passed', () => {
            const startTime = new Date('2026-03-03T10:00:00').getTime();
            const now = new Date('2026-03-03T22:00:00').getTime();
            expect(getAutoStopTimeIfPassed(startTime, now)).toBeNull();
        });
        test('returns null if it is exactly at the same day start', () => {
            const startTime = new Date('2026-03-03T00:00:00').getTime();
            const now = new Date('2026-03-03T12:00:00').getTime();
            expect(getAutoStopTimeIfPassed(startTime, now)).toBeNull();
        });
    });
});
