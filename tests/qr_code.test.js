import { createHash } from 'node:crypto';
import { jest } from '@jest/globals';
import {
    serializeSettingsPayload,
    deserializeSettingsPayload,
    generateQRCodeMatrix,
    renderQRCodeToCanvas,
    decodeQRCodeFromCanvas,
    isQRCodeScanningSupported,
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
            { id: 'cat1', name: '開発', color: '#1976d2', animation: 'digital_rain', tags: 'dev,開発', order: 1 },
            { id: 'cat2', name: '会議', color: '#388e3c', animation: 'clock', tags: '', order: 2 },
        ];

        const inputAlarms = [
            {
                id: 'alm1',
                name: '昼休み',
                type: 'daily',
                time: '12:00',
                actionCategory: 'cat2',
                action: 'start',
                daysOfWeek: [1, 2, 3, 4, 5],
                message: 'お昼です',
                enabled: false,
                requireConfirmation: true,
                holidayAdjustment: 'next_business_day',
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
        expect(restored.alarms[0]).toMatchObject(inputAlarms[0]);
        expect(restored.categories).toEqual(inputCategories);
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

    test('reports unsupported browsers instead of silently returning no detection', async () => {
        expect(await isQRCodeScanningSupported()).toBe(false);
        await expect(decodeQRCodeFromCanvas({})).rejects.toThrow('not supported');
    });

    test('uses native QR detection and checks supported formats', async () => {
        const detect = jest.fn().mockResolvedValue([{ rawValue: 'payload' }]);
        globalThis.BarcodeDetector = class {
            static async getSupportedFormats() {
                return ['qr_code'];
            }
            detect = detect;
        };
        try {
            expect(await isQRCodeScanningSupported()).toBe(true);
            const canvas = document.createElement('canvas');
            expect(await decodeQRCodeFromCanvas(canvas)).toBe('payload');
            expect(detect).toHaveBeenCalledWith(canvas);
            detect.mockResolvedValue([]);
            expect(await decodeQRCodeFromCanvas(canvas)).toBeNull();
            globalThis.BarcodeDetector.getSupportedFormats = async () => ['ean_13'];
            expect(await isQRCodeScanningSupported()).toBe(false);
        } finally {
            delete globalThis.BarcodeDetector;
        }
    });
});

test('restores omitted defaults, order, disabled flags and special animations', () => {
    const restored = deserializeSettingsPayload(
        serializeSettingsPayload({
            settings: { animation: 'none', pauseAnimation: 'default' },
            categories: [
                { id: 1, name: 'One', animation: 'none' },
                { id: 2, name: 'Two', animation: 'default' },
            ],
            alarms: [
                { id: 1, time: '09:00', enabled: false },
                { id: 2, time: '10:00', enabled: true },
            ],
        })
    );
    expect(restored.settings).toEqual({ animation: 'none', pauseAnimation: 'default' });
    expect(restored.categories.map((c) => [c.color, c.order, c.animation])).toEqual([
        ['primary', 0, 'none'],
        ['primary', 1, 'default'],
    ]);
    expect(restored.categories.map((c) => c.tags)).toEqual(['', '']);
    expect(restored.alarms.map((a) => [a.type, a.action, a.enabled, a.order, a.requireConfirmation])).toEqual([
        ['daily_business', 'start', false, 0, false],
        ['daily_business', 'start', true, 1, false],
    ]);
});

test.each([
    { c: [{ n: 'Missing ID' }] },
    { c: [{ i: 1, n: 123 }] },
    { c: [null] },
    { c: [{ i: 1, n: 'Bad tags', tg: ['tag'] }] },
    {
        c: [
            { i: 1, n: 'One' },
            { i: 1, n: 'Two' },
        ],
    },
    { a: [{ i: 1, ti: '25:00' }] },
    { a: [{ i: 1, n: 123, ti: '09:00' }] },
    { a: [{ i: 1, ti: '09:00', w: [7] }] },
    { a: [{ i: 1, ti: '09:00', rc: 'false' }] },
    { a: [{ i: 1, ti: '09:00', e: 'false' }] },
    { a: {} },
])('rejects malformed records: %j', (records) => {
    expect(() => deserializeSettingsPayload(JSON.stringify({ v: 1, ...records }))).toThrow();
});

// Independent byte-mode / Level L / mask 0 vectors generated with Project Nayuki:
// https://github.com/nayuki/QR-Code-generator/blob/master/python/qrcodegen.py
// Reference source SHA-256: 9f4ed1dd201dcb92b1bc0d6e14f46c754bcff0ce48580c5d7e8ace8f6926c8ef
const capacityVectors = [
    [1, 17, 'bc9c84bde65dcdc06442a918c258bc558a0ee305782c48efb6f1f66fe8ed3bae'],
    [2, 32, '26afe19f3ae4df76e1c1438191b00c21ead5f4216cc3d9988e68e513406e7608'],
    [3, 53, 'dde5409d0c5a46eced0d8316e14cf0297f64b7b92d34b3b2419ba9afbd5028aa'],
    [4, 78, '259e1b663895352d5268594999d735ee37aa0ec844b206bc62e8fae98df10767'],
    [5, 106, 'da1c31549520b6649cd87a7823c21f19c9fc666571679b68ea01fcfdc5aaf040'],
    [6, 134, '38a6e5fb75a50caef76b15d0f1a1244ea356e00d1f015fd7a0a078c65273837a'],
    [7, 154, '0b330ff72bc3fa92969e29a266f98e163e42044d150d053dd3cb9a0d2c215cca'],
    [8, 192, 'ecbbaf3f3d71512ab9136b37e05591fd142671ffbaad968f330a84b7742fad2f'],
    [9, 230, 'b7d5f12a45a9d461c3b1f5c1dd3c357ebe45900f78f18d209c37f55128dd648e'],
    [10, 271, 'bdc73cf2798dde47b703c10736ecd7b57a150da0bdab5f473e2430b15b27f03c'],
    [11, 321, '7efc0ef727bbf8724d9ecd75ae87f24bcb74ab2d34f030dfcb8978f1747efbaf'],
    [12, 367, 'd3bc48dd632e2e48a711ea6fb0c2784ecd697423a3ca3cd0c560c232b763722d'],
    [13, 425, 'b0bb786c09165d1b00fcbe9926e06944c57522c085df7a32943248c698686bf9'],
    [14, 458, '6d58ccc604f6290632da6d617a479220d3808590a4d2669e0591a47363cb0ced'],
    [15, 520, 'b050727eac3b2fa10de39f4f42384b3b9b26360110096f632acb42ca579ef83c'],
    [16, 586, '006aaf3425d2cbbcf4d7aeed0f269537d0ae752fcde20f9df77dfe9ce6c5f662'],
    [17, 644, 'a62f4aae08a8c930374eec3a5ecf84be5553022ca58124a063bf3d067dcc0e09'],
    [18, 718, '1cb72aec13111591c6b9bfa12fcf5dfa9742b9cdd091b6be1baedf6ba5d05b50'],
    [19, 792, '55f8254822c7643b44c562d43c3fa4fbb92407db6555039220298209dff28f5e'],
    [20, 858, 'c39352b221b1ab3fb2f9af0687108fe4004ee81439e4844556e70d92dc1c39c8'],
    [21, 929, '524febbeb046e87c0f40ecc707414c86dd1aa28126dd66f87f0de2a786dd9d8a'],
    [22, 1003, 'd5d64404fd3b596786841871eebe995933028d1d1906f6aa77057429acc7960a'],
    [23, 1091, 'd9485144876763d4f883b65142506b083ee4df0fb5fd06bd2ac0f34410a8596f'],
    [24, 1171, '633bf77b46d0ab473d236b870cf627b4d385d31ca3143ba6f3dc7fd39b5fa1cf'],
    [25, 1273, '9f160548f43a07dfa108dc7e2979f4b9136636450248f10a4a0b47bd63c0bb6c'],
    [26, 1367, '52c2f9b5b22d723e3464c579a86fb212b1b5c373f64493fe3af0df78b28524a5'],
    [27, 1465, 'ec802ebed038a0a7b7288f91c1d208c51d88865840cfdfa5a7bd5e89b3cce5a4'],
    [28, 1528, 'b486b0b299e6ea77afc1ab774d8f4d5fe7ac983515e51f7b94311f6503b14060'],
    [29, 1628, 'd3b7b8cf4f030cdba731082b27ea9abcf12b39750bfa5307b39f3445b09854b6'],
    [30, 1732, '8855570e72a149248a43c1b7c1a5ba7c7edd9abbe54f5b200ebe723b1e7157e1'],
    [31, 1840, '2c91af85d45b0d0e92cf46e44c4c0cf422943234d1f72497f92561bf410299c8'],
    [32, 1952, '9fac56ede9093e69778c02adb123874a3278480a204ead0db32269367ad66772'],
    [33, 2068, 'b5bbd47fddf06155318ed557c3a91cb9af6c2b4e58a4022ca8356e40d33634a9'],
    [34, 2188, '7ad70946b711b514bfc33598edfe634ad6ca416d408fd4e876e5717336c5983e'],
    [35, 2303, '1c2cf0c17209178a1e8a4d35145e8f1d52c1749f3d6ab28044be66f58cff2bb9'],
    [36, 2431, 'eb5a3334fc1cedc90d26f202003d08d29c85aeeabd4a0582ca17343105c65c1c'],
    [37, 2563, '22d4f778751cec245850a18c8f6344b042eee9649ce7b85f007231457c85f6b6'],
    [38, 2699, 'b37f4aadb9e61bc581d3cf488b51e287b5e626f771b98f08aacd54e4fa6f70a3'],
    [39, 2809, 'dc32f3e7da6c44422a71df46c4b0d225f50c593a84abb5a11ad9d117108b03fe'],
    [40, 2953, '9071d2f6f8af1060bfdd838f3e6016b46cebc0986a354a8bf4a65845fb0d005f'],
];
test.each(capacityVectors)('encodes version %i at its byte capacity (%i bytes)', (version, length, expectedHash) => {
    const matrix = generateQRCodeMatrix('x'.repeat(length));
    expect(matrix.length).toBe(17 + version * 4);
    expect(createHash('sha256').update(JSON.stringify(matrix)).digest('hex')).toBe(expectedHash);
    if (version < 40) expect(generateQRCodeMatrix('x'.repeat(length + 1)).length).toBe(21 + version * 4);
    else expect(() => generateQRCodeMatrix('x'.repeat(length + 1))).toThrow('Payload too large for QR Code');
});
