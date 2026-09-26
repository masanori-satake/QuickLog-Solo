import { jest } from '@jest/globals';
import {
    serializeSettingsPayload,
    deserializeSettingsPayload,
    generateQRCodeMatrix,
    renderQRCodeToCanvas,
    decodeQRCodeFromCanvas,
} from '../shared/js/qr_code.js';

describe('QR Code Payload Serialization and Deserialization', () => {
    test('should correctly serialize and deserialize standard settings, categories, and alarms', () => {
        const inputSettings = {
            theme: 'dark',
            font: 'Roboto',
            fontWeight: '500',
            animation: 'clock',
            pauseAnimation: 'snoring_zzz',
            pauseTheme: 'neutral',
            timerHeight: 'compact',
            categoryLayout: '2x4',
            businessDays: [1, 2, 3, 4, 5],
            language: 'ja',
            reportSettings: { showChart: true },
        };

        const inputCategories = [
            { id: 'cat1', name: '開発', color: '#1976d2', animation: 'digital_rain', tags: 'dev', order: 1 },
            { id: 'cat2', name: '会議', color: '#388e3c', animation: 'clock', tags: '', order: 2 },
        ];

        const inputAlarms = [
            {
                id: 'alm1',
                name: '昼休み',
                type: 'time',
                time: '12:00',
                actionCategory: 'cat2',
                action: 'start',
                daysOfWeek: [1, 2, 3, 4, 5],
                message: 'お昼です',
                holidayAdjustment: 'next_business_day',
                requireConfirmation: true,
                enabled: true,
                order: 1,
            },
        ];

        const jsonStr = serializeSettingsPayload({
            settings: inputSettings,
            categories: inputCategories,
            alarms: inputAlarms,
        });

        expect(typeof jsonStr).toBe('string');
        expect(jsonStr.length).toBeGreaterThan(0);

        // Parsed json should contain shortened keys
        const rawParsed = JSON.parse(jsonStr);
        expect(rawParsed.v).toBe(1);
        expect(rawParsed.s).toBeDefined();
        expect(rawParsed.c).toHaveLength(2);
        expect(rawParsed.a).toHaveLength(1);

        // Deserialization check
        const restored = deserializeSettingsPayload(jsonStr);

        expect(restored).toEqual({
            settings: {
                theme: 'dark',
                font: 'Roboto',
                fontWeight: '500',
                animation: 'clock',
                timerHeight: 'compact',
                categoryLayout: '2x4',
                language: 'ja',
            },
            categories: [
                { id: 'cat1', name: '開発', color: '#1976d2', animation: 'digital_rain', tags: 'dev', order: 1 },
                { id: 'cat2', name: '会議', color: '#388e3c', animation: 'clock', tags: '', order: 2 },
            ],
            alarms: [
                {
                    id: 'alm1',
                    name: '昼休み',
                    type: 'time',
                    time: '12:00',
                    actionCategory: 'cat2',
                    action: 'start',
                    daysOfWeek: [1, 2, 3, 4, 5],
                    message: 'お昼です',
                    enabled: true,
                    holidayAdjustment: 'next_business_day',
                    dayOfMonth: 1,
                    daysBeforeEnd: 0,
                    requireConfirmation: true,
                    order: 1,
                },
            ],
        });
    });

    test('should filter out internal system categories (IDLE) and page breaks (__PAGE_BREAK__)', () => {
        const categories = [
            { id: 'cat1', name: '開発', color: '#1976d2' },
            { id: 'idle', name: 'IDLE', color: 'neutral' },
            { id: 'pb1', name: '__PAGE_BREAK__12345', color: 'neutral' },
            { id: 'cat2', name: '会議', color: '#388e3c' },
        ];

        const jsonStr = serializeSettingsPayload({ categories });
        const restored = deserializeSettingsPayload(jsonStr);

        expect(restored.categories).toHaveLength(2);
        expect(restored.categories[0].name).toBe('開発');
        expect(restored.categories[1].name).toBe('会議');
    });

    test('should preserve none and default animations while sanitizing custom animations to digital_rain', () => {
        const inputSettings = {
            animation: 'custom_my_anim',
            pauseAnimation: 'none',
        };

        const inputCategories = [
            { id: 'cat1', name: 'Task 1', color: '#ff0000', animation: 'custom_cool_anim' },
            { id: 'cat2', name: 'Task 2', color: '#00ff00', animation: 'default' },
            { id: 'cat3', name: 'Task 3', color: '#0000ff', animation: 'none' },
            { id: 'cat4', name: 'Task 4', color: '#ffff00', animation: 'heart_beat' },
        ];

        const jsonStr = serializeSettingsPayload({
            settings: inputSettings,
            categories: inputCategories,
            alarms: [],
        });

        const restored = deserializeSettingsPayload(jsonStr);

        expect(restored.settings.animation).toBe('digital_rain');
        expect(restored.settings.pauseAnimation).toBe('none');
        expect(restored.categories[0].animation).toBe('digital_rain');
        expect(restored.categories[1].animation).toBe('default');
        expect(restored.categories[2].animation).toBe('none');
        expect(restored.categories[3].animation).toBe('heart_beat');
    });

    test('verifies QR version 1-40 data capacity boundaries including VERSION_SPECS_L[19]', () => {
        // Test Version 1 boundary: max 17 bytes of pure data in Byte mode (19 - 2)
        const v1Data = 'A'.repeat(17);
        const v1Matrix = generateQRCodeMatrix(v1Data);
        expect(v1Matrix.length).toBe(21); // Size for version 1: 17 + 4*1 = 21

        const v1ExceededData = 'A'.repeat(18);
        const v2Matrix = generateQRCodeMatrix(v1ExceededData);
        expect(v2Matrix.length).toBe(25); // Size for version 2: 17 + 4*2 = 25

        // Test Version 19 boundary: VERSION_SPECS_L[19] has 795 data bytes, countBits=16 (2 bytes), mode=4 bits (0.5 byte) -> 792 bytes max
        const v19Data = 'B'.repeat(792);
        const v19Matrix = generateQRCodeMatrix(v19Data);
        expect(v19Matrix.length).toBe(17 + 19 * 4); // 93

        const v19ExceededData = 'B'.repeat(793);
        const v20Matrix = generateQRCodeMatrix(v19ExceededData);
        expect(v20Matrix.length).toBe(17 + 20 * 4); // 97
    });

    test('should ignore sensitive fields like clientId, backup handles, and sessionSync', () => {
        const inputSettings = {
            theme: 'light',
            sessionSync: true,
            clientId: 'secret-uuid-1234',
            backupConfig: { auto: true },
            backupDirectoryHandle: {},
        };

        const jsonStr = serializeSettingsPayload({
            settings: inputSettings,
            categories: [],
            alarms: [],
        });

        expect(jsonStr).not.toContain('secret-uuid-1234');
        expect(jsonStr).not.toContain('backupConfig');

        const restored = deserializeSettingsPayload(jsonStr);
        expect(restored.settings.theme).toBe('light');
        expect(restored.settings.sessionSync).toBeUndefined();
        expect(restored.settings.clientId).toBeUndefined();
    });

    test('restores omitted defaults, index ordering and disabled alarms on round trip', () => {
        const restored = deserializeSettingsPayload(
            serializeSettingsPayload({
                categories: [
                    { id: 0, name: 'First' },
                    { id: 'second', name: 'Second' },
                ],
                alarms: [{ id: 1, enabled: false }, { id: 2 }, { id: 3, order: 8 }],
            })
        );
        expect(restored.categories.map(({ color, order }) => ({ color, order }))).toEqual([
            { color: 'primary', order: 0 },
            { color: 'primary', order: 1 },
        ]);
        expect(
            restored.alarms.map(({ type, action, enabled, order, name }) => ({ type, action, enabled, order, name }))
        ).toEqual([
            { type: 'time', action: 'start', enabled: false, order: 0, name: '' },
            { type: 'time', action: 'start', enabled: true, order: 1, name: '' },
            { type: 'time', action: 'start', enabled: true, order: 8, name: '' },
        ]);
    });

    test.each([0, false])('keeps enabled=%s disabled', (enabled) => {
        expect(deserializeSettingsPayload(JSON.stringify({ v: 1, a: [{ i: 1, e: enabled }] })).alarms[0].enabled).toBe(
            false
        );
    });

    test.each([
        { c: {} },
        { a: null },
        { c: [null] },
        { a: [[]] },
        { c: [{ n: 'Missing ID' }] },
        { a: [{ i: '', n: 'Empty ID' }] },
        { c: [{ i: {}, n: 'Invalid ID' }] },
        { a: [{ i: true }] },
        { c: [{ i: 1 }] },
        { c: [{ i: 1, n: 7 }] },
        { a: [{ i: 1, n: {} }] },
        {
            c: [
                { i: 1, n: 'A' },
                { i: 1, n: 'B' },
            ],
        },
        { a: [{ i: 'a' }, { i: 'a' }] },
        { c: [{ i: 1, n: 'A', c: {} }] },
        { c: [{ i: 1, n: 'A', o: '0' }] },
        { a: [{ i: 1, w: 'Monday' }] },
        { a: [{ i: 1, w: [7] }] },
        { a: [{ i: 1, e: 'false' }] },
        { a: [{ i: 1, ti: 1200 }] },
    ])('rejects malformed record shapes: %j', (records) => {
        expect(() => deserializeSettingsPayload(JSON.stringify({ v: 1, ...records }))).toThrow();
    });

    test('should throw error on invalid payload deserialization', () => {
        expect(() => deserializeSettingsPayload('invalid json')).toThrow();
        expect(() => deserializeSettingsPayload(JSON.stringify({ v: 999 }))).toThrow();
    });

    test('should correctly serialize and deserialize split payloads (Group 1: General+Alarms, Group 2: Categories)', () => {
        const inputSettings = { theme: 'dark', font: 'Roboto', language: 'ja' };
        const inputAlarms = [{ id: 'alm1', name: 'Alarm 1', enabled: true }];
        const inputCategories = [{ id: 'cat1', name: 'Dev', color: 'primary' }];

        // Group 1: General Settings + Alarms
        const group1Json = serializeSettingsPayload({ settings: inputSettings, alarms: inputAlarms });
        const parsedGroup1 = JSON.parse(group1Json);
        expect(parsedGroup1.s).toBeDefined();
        expect(parsedGroup1.a).toBeDefined();
        expect(parsedGroup1.c).toBeUndefined();

        const restoredGroup1 = deserializeSettingsPayload(group1Json);
        expect(restoredGroup1.settings.theme).toBe('dark');
        expect(restoredGroup1.alarms).toHaveLength(1);
        expect(restoredGroup1.categories).toBeUndefined();

        // Group 2: Business Categories
        const group2Json = serializeSettingsPayload({ categories: inputCategories });
        const parsedGroup2 = JSON.parse(group2Json);
        expect(parsedGroup2.c).toBeDefined();
        expect(parsedGroup2.s).toBeUndefined();
        expect(parsedGroup2.a).toBeUndefined();

        const restoredGroup2 = deserializeSettingsPayload(group2Json);
        expect(restoredGroup2.categories).toHaveLength(1);
        expect(restoredGroup2.categories[0].name).toBe('Dev');
        expect(restoredGroup2.settings).toBeUndefined();
        expect(restoredGroup2.alarms).toBeUndefined();
    });

    test('should include partInfo metadata when provided in serializeSettingsPayload', () => {
        const payloadStr = serializeSettingsPayload({
            categories: [{ id: 'cat1', name: 'Task 1' }],
            partInfo: { gt: 1, gi: 0, ct: 3, ci: 2 },
        });

        const raw = JSON.parse(payloadStr);
        expect(raw.p).toEqual({ gt: 1, gi: 0, ct: 3, ci: 2 });

        const restored = deserializeSettingsPayload(payloadStr);
        expect(restored.partInfo).toEqual({ gt: 1, gi: 0, ct: 3, ci: 2 });
    });
});

describe('QR Code Generator & Renderer', () => {
    test('should generate QR code boolean matrix for input string', () => {
        const text = 'https://masanori-satake.github.io/QuickLog-Solo/projects/pwa/';
        const matrix = generateQRCodeMatrix(text);

        expect(Array.isArray(matrix)).toBe(true);
        expect(matrix.length).toBeGreaterThan(20);
        expect(matrix[0].length).toEqual(matrix.length);

        // Finder pattern check at top-left
        expect(matrix[0][0]).toBe(true);
        expect(matrix[0][6]).toBe(true);
        expect(matrix[6][0]).toBe(true);
        expect(matrix[6][6]).toBe(true);
        expect(matrix[1][1]).toBe(false);
    });

    test('should render QR Code onto HTML canvas', () => {
        const fillRectMock = jest.fn();
        const canvas = {
            width: 200,
            height: 200,
            getContext: jest.fn().mockReturnValue({
                fillRect: fillRectMock,
                fillStyle: '#000000',
            }),
        };

        renderQRCodeToCanvas('Test Payload', canvas, { width: 200 });

        expect(canvas.getContext).toHaveBeenCalledWith('2d');
        expect(fillRectMock).toHaveBeenCalled();
        expect(canvas.width).toBe(200);
        expect(canvas.height).toBe(200);
    });

    test('should throw error when payload exceeds version 40 QR capacity limit', () => {
        const hugePayload = 'X'.repeat(3000);
        expect(() => generateQRCodeMatrix(hugePayload)).toThrow('Payload too large for QR Code');
    });

    test('should decode QR code from canvas using mock detector or return null safely', async () => {
        const canvas = {
            width: 100,
            height: 100,
            getContext: jest.fn().mockReturnValue(null),
        };

        const result = await decodeQRCodeFromCanvas(canvas);
        expect(result).toBeNull();
    });
});
