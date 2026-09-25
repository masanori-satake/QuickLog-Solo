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
            { id: 'cat1', name: '開発', color: '#1976d2', animation: 'digital_rain', tag: 'dev', order: 1 },
            { id: 'cat2', name: '会議', color: '#388e3c', animation: 'clock', tag: '', order: 2 },
        ];

        const inputAlarms = [
            {
                id: 'alm1',
                name: '昼休み',
                type: 'time',
                time: '12:00',
                actionCategory: 'cat2',
                action: 'start',
                weekdays: [1, 2, 3, 4, 5],
                customMessage: 'お昼です',
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

        expect(restored.settings.theme).toBe('dark');
        expect(restored.settings.font).toBe('Roboto');
        expect(restored.settings.timerHeight).toBe('compact');
        expect(restored.settings.businessDays).toEqual([1, 2, 3, 4, 5]);

        expect(restored.categories).toHaveLength(2);
        expect(restored.categories[0].name).toBe('開発');
        expect(restored.categories[0].animation).toBe('digital_rain');

        expect(restored.alarms).toHaveLength(1);
        expect(restored.alarms[0].name).toBe('昼休み');
        expect(restored.alarms[0].time).toBe('12:00');
    });

    test('should sanitize custom animations to digital_rain during serialization', () => {
        const inputSettings = {
            animation: 'custom_my_anim',
            pauseAnimation: 'qlanim_test',
        };

        const inputCategories = [
            { id: 'cat1', name: 'Task', color: '#ff0000', animation: 'custom_cool_anim' },
            { id: 'cat2', name: 'Task 2', color: '#00ff00', animation: 'heart_beat' },
        ];

        const jsonStr = serializeSettingsPayload({
            settings: inputSettings,
            categories: inputCategories,
            alarms: [],
        });

        const restored = deserializeSettingsPayload(jsonStr);

        expect(restored.settings.animation).toBe('digital_rain');
        expect(restored.settings.pauseAnimation).toBe('digital_rain');
        expect(restored.categories[0].animation).toBe('digital_rain');
        expect(restored.categories[1].animation).toBe('heart_beat');
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
