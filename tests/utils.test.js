import {
    escapeHtml, escapeCsv, escapeTsv, parseCsvLine, isValidCategoryName, isValidColor, generateDuplicateName, generateUUID, floorToMinute
} from '../shared/js/utils.js';
import { fc, test as fcTest } from '@fast-check/jest';

describe('Utils Module', () => {
    describe('escapeHtml', () => {
        test('escapes special characters', () => {
            expect(escapeHtml('<b>"Me & You"</b>')).toBe('&lt;b&gt;&quot;Me &amp; You&quot;&lt;/b&gt;');
        });
        test('returns non-string values as is', () => {
            expect(escapeHtml(123)).toBe(123);
            expect(escapeHtml(null)).toBe(null);
            expect(escapeHtml(undefined)).toBe(undefined);
            expect(escapeHtml({ a: 1 })).toEqual({ a: 1 });
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
            expect(escapeCsv(null)).toBe(null);
            expect(escapeCsv(undefined)).toBe(undefined);
            expect(escapeCsv({ a: 1 })).toEqual({ a: 1 });
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
            expect(escapeTsv(null)).toBe(null);
            expect(escapeTsv(undefined)).toBe(undefined);
            expect(escapeTsv({ a: 1 })).toEqual({ a: 1 });
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
            expect(isValidCategoryName(undefined)).toBe(false);
            expect(isValidCategoryName({})).toBe(false);
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

    describe('generateUUID and floorToMinute', () => {
        test('generateUUID fallback when crypto.randomUUID is not available', () => {
            const originalCrypto = globalThis.crypto;
            try {
                // Mock crypto to lack randomUUID or be undefined
                delete globalThis.crypto;
                const uuid = generateUUID();
                expect(uuid).toMatch(/^uuid-\d+-[a-z0-9]+$/);
            } finally {
                globalThis.crypto = originalCrypto;
            }
        });

        test('floorToMinute edge cases', () => {
            expect(floorToMinute(0)).toBe(0);
            expect(floorToMinute(-60000)).toBe(-60000);
            expect(floorToMinute(-30000)).toBe(-60000);
            expect(floorToMinute(59999)).toBe(0);
            expect(floorToMinute(60000)).toBe(60000);
        });
    });

    // =============================================================================
    // Property-Based Tests (fast-check)
    // =============================================================================

    describe('Property 1: Escape 関数の型ガード恒等性', () => {
        fcTest.prop([
            fc.oneof(
                fc.integer(),
                fc.double(),
                fc.boolean(),
                fc.constant(null),
                fc.constant(undefined),
                fc.object()
            )
        ])('escape functions return non-string inputs unchanged', (val) => {
            expect(escapeHtml(val)).toEqual(val);
            expect(escapeCsv(val)).toEqual(val);
            expect(escapeTsv(val)).toEqual(val);
        });
    });

    describe('Property 2: 無効なカテゴリ名の拒否', () => {
        fcTest.prop([
            fc.oneof(
                fc.string().filter(s => s.trim().length === 0 || s.length > 50 || s === '__IDLE__' || s === '__UNKNOWN__' || s.startsWith('__PAGE_BREAK__')),
                fc.integer(),
                fc.constant(null),
                fc.constant(undefined),
                fc.object()
            )
        ])('isValidCategoryName returns false for invalid inputs', (val) => {
            expect(isValidCategoryName(val)).toBe(false);
        });
    });

    describe('Property 3: CSV ラウンドトリップ', () => {
        // String array containing no unescaped newlines/CRs or tabs
        fcTest.prop([
            fc.array(fc.string().filter(s => !s.includes('\n') && !s.includes('\r')), { minLength: 1 })
        ])('joining with escapeCsv and comma then parsing with parseCsvLine matches original (trimmed)', (arr) => {
            const line = arr.map(s => escapeCsv(s)).join(',');
            const parsed = parseCsvLine(line);
            const expected = arr.map(s => s.trim());
            expect(parsed).toEqual(expected);
        });
    });

    describe('Property 4: generateDuplicateName のサフィックス増分', () => {
        fcTest.prop([
            fc.string({ minLength: 1 }).filter(s => s.trim() === s && !s.includes('(') && !s.includes(')')),
            fc.array(fc.integer({ min: 1, max: 100 }))
        ])('generateDuplicateName returns max_suffix + 1', (baseName, suffixes) => {
            const existing = suffixes.map(n => `${baseName} (${n})`);
            const next = generateDuplicateName(baseName, existing);
            const maxSuffix = suffixes.length > 0 ? Math.max(...suffixes) : 0;
            expect(next).toBe(`${baseName} (${maxSuffix + 1})`);
        });
    });

    describe('Property 5: floorToMinute の分境界プロパティ', () => {
        fcTest.prop([
            fc.integer({ min: 0, max: 10000000 })
        ])('floorToMinute(ms) is a multiple of 60000 and floorToMinute(ms) <= ms', (ms) => {
            const floored = floorToMinute(ms);
            expect(floored % 60000).toBe(0);
            expect(floored).toBeLessThanOrEqual(ms);
            expect(ms - floored).toBeLessThan(60000);
        });
    });
});
