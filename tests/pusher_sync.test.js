import { jest } from '@jest/globals';
import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

if (!globalThis.crypto || !globalThis.crypto.subtle) {
    try {
        Object.defineProperty(globalThis, 'crypto', {
            value: webcrypto,
            configurable: true,
            writable: true,
        });
    } catch {
        globalThis.crypto = webcrypto;
    }
}

if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder;
    globalThis.TextDecoder = TextDecoder;
}

import 'fake-indexeddb/auto';
import {
    md5,
    generate6DigitPin,
    generateSecretKey,
    encryptPayload,
    decryptPayload,
    computeHmacSha256,
    generatePusherQueryString,
    sendSettingsToPusher,
    fetchSettingsFromPusher,
    validatePusherConfig,
    validatePinSyncTimestamp,
    PIN_EXPIRATION_MS,
    MAX_FUTURE_SKEW_MS,
} from '../shared/js/pusher_sync.js';
import { dbImportTransferredSettings, dbImportQRSettings, dbGetAll, STORE_SETTINGS, STORE_CATEGORIES, STORE_ALARMS, setDatabaseName } from '../shared/js/db.js';
import { t } from '../shared/js/i18n.js';
import { buildPusherErrorReport } from '../projects/app/js/app.js';

describe('pusher_sync.js', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test('md5 calculates correct hash', () => {
        expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
        expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });

    test('generate6DigitPin returns a 6-digit numeric string', () => {
        const pin = generate6DigitPin();
        expect(typeof pin).toBe('string');
        expect(pin.length).toBe(6);
        expect(/^\d{6}$/.test(pin)).toBe(true);
    });

    test('generate6DigitPin rejects out-of-range values to eliminate modulo bias', () => {
        const mockGetRandomValues = jest.fn();
        let callCount = 0;
        mockGetRandomValues.mockImplementation((buf) => {
            callCount++;
            if (callCount === 1) {
                buf[0] = 4294500000; // >= 4294000000 (disallowed due to modulo bias)
            } else {
                buf[0] = 12345678; // Valid
            }
            return buf;
        });

        const spy = jest.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(mockGetRandomValues);
        try {
            const pin = generate6DigitPin();
            expect(mockGetRandomValues).toHaveBeenCalledTimes(2);
            expect(pin).toBe('345678');
        } finally {
            spy.mockRestore();
        }
    });

    test('generate6DigitPin uses getRandomValues even in non-secure origins where crypto.subtle is undefined', () => {
        const mockGetRandomValues = jest.fn((buf) => {
            buf[0] = 654321;
            return buf;
        });

        const originalSubtleDescriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle');
        const spyGetRandomValues = jest.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(mockGetRandomValues);

        try {
            // Simulate non-secure origin (HTTP) where SubtleCrypto is undefined
            Object.defineProperty(globalThis.crypto, 'subtle', {
                value: undefined,
                configurable: true,
                writable: true,
            });

            const pin = generate6DigitPin();
            expect(mockGetRandomValues).toHaveBeenCalled();
            expect(pin).toBe('654321');
        } finally {
            spyGetRandomValues.mockRestore();
            if (originalSubtleDescriptor) {
                Object.defineProperty(globalThis.crypto, 'subtle', originalSubtleDescriptor);
            } else {
                delete globalThis.crypto.subtle;
            }
        }
    });

    test('encryptPayload and decryptPayload round-trip with createdAt timestamp', async () => {
        const pin = '582914';
        const settingsData = {
            settings: { theme: 'dark', language: 'ja' },
            categories: [{ name: '開発', color: 'primary' }],
            alarms: [{ id: 1, time: '12:00', enabled: true }],
        };

        const startTime = Date.now();
        const encrypted = await encryptPayload(settingsData, pin);
        expect(encrypted.data).toBeDefined();
        expect(encrypted.iv).toBeDefined();
        expect(typeof encrypted.data).toBe('string');

        const decrypted = await decryptPayload(encrypted, pin);
        expect(decrypted.createdAt).toBeGreaterThanOrEqual(startTime);
        expect(decrypted.settings).toEqual(settingsData);
    });

    test('encryptPayload and decryptPayload throw error on invalid PIN/key or invalid structure', async () => {
        const validData = { theme: 'light' };
        const validPin = '123456';

        // Invalid PIN/key on encrypt
        await expect(encryptPayload(validData, null)).rejects.toThrow('Invalid PIN or secret key');
        await expect(encryptPayload(validData, undefined)).rejects.toThrow('Invalid PIN or secret key');
        await expect(encryptPayload(validData, {})).rejects.toThrow('Invalid PIN or secret key');

        const encrypted = await encryptPayload(validData, validPin);

        // Invalid PIN/key on decrypt
        await expect(decryptPayload(encrypted, null)).rejects.toThrow('Invalid PIN or secret key');
        await expect(decryptPayload(encrypted, undefined)).rejects.toThrow('Invalid PIN or secret key');
        await expect(decryptPayload(encrypted, {})).rejects.toThrow('Invalid PIN or secret key');

        // Invalid payload structures or non-string fields
        await expect(decryptPayload(null, validPin)).rejects.toThrow('Invalid encrypted payload structure');
        await expect(decryptPayload('string', validPin)).rejects.toThrow('Invalid encrypted payload structure');
        await expect(decryptPayload({ data: 123, iv: encrypted.iv }, validPin)).rejects.toThrow('Invalid encrypted payload structure');
        await expect(decryptPayload({ data: encrypted.data, iv: 456 }, validPin)).rejects.toThrow('Invalid encrypted payload structure');
        await expect(decryptPayload({ data: encrypted.data, iv: encrypted.iv, salt: 789 }, validPin)).rejects.toThrow('Invalid encrypted payload structure');
    });

    test('decryptPayload throws error if decrypted JSON is non-object', async () => {
        const validPin = '123456';
        const cryptoObj = globalThis.crypto;
        const encoder = new TextEncoder();

        const salt = new Uint8Array(16);
        const iv = new Uint8Array(12);
        const baseKey = await cryptoObj.subtle.importKey('raw', encoder.encode(validPin), 'PBKDF2', false, ['deriveKey']);
        const key = await cryptoObj.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        const primitiveEncrypted = await cryptoObj.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(JSON.stringify('just a string'))
        );

        let saltBinary = '';
        for (let i = 0; i < salt.length; i++) saltBinary += String.fromCharCode(salt[i]);
        let ivBinary = '';
        for (let i = 0; i < iv.length; i++) ivBinary += String.fromCharCode(iv[i]);
        let dataBinary = '';
        const dataArr = new Uint8Array(primitiveEncrypted);
        for (let i = 0; i < dataArr.length; i++) dataBinary += String.fromCharCode(dataArr[i]);

        const fakeEncryptedObj = {
            salt: btoa(saltBinary),
            iv: btoa(ivBinary),
            data: btoa(dataBinary),
        };

        await expect(decryptPayload(fakeEncryptedObj, validPin)).rejects.toThrow('Invalid decrypted payload structure');
    });

    test('validatePinSyncTimestamp validates recent timestamps and rejects expired, future, non-finite, or invalid timestamps', () => {
        const now = 1000000;

        // Valid recent timestamps
        expect(validatePinSyncTimestamp(now - 1000, now)).toBe(true);
        expect(validatePinSyncTimestamp(now - PIN_EXPIRATION_MS, now)).toBe(true);
        expect(validatePinSyncTimestamp(now + MAX_FUTURE_SKEW_MS, now)).toBe(true);

        // Expired timestamp (> 180,000ms old)
        expect(() => validatePinSyncTimestamp(now - PIN_EXPIRATION_MS - 1, now)).toThrow('EXPIRED');

        // Future-dated timestamp exceeding skew (> 60,000ms ahead)
        expect(() => validatePinSyncTimestamp(now + MAX_FUTURE_SKEW_MS + 1, now)).toThrow('EXPIRED');

        // Non-finite and invalid values
        expect(() => validatePinSyncTimestamp(Number.NaN, now)).toThrow('EXPIRED');
        expect(() => validatePinSyncTimestamp(Infinity, now)).toThrow('EXPIRED');
        expect(() => validatePinSyncTimestamp(-Infinity, now)).toThrow('EXPIRED');
        expect(() => validatePinSyncTimestamp('1000000', now)).toThrow('EXPIRED');
        expect(() => validatePinSyncTimestamp(null, now)).toThrow('EXPIRED');
        expect(() => validatePinSyncTimestamp(undefined, now)).toThrow('EXPIRED');
        expect(() => validatePinSyncTimestamp({}, now)).toThrow('EXPIRED');
    });

    test('computeHmacSha256 generates correct signature matching RFC 4231 test vectors', async () => {
        // RFC 4231 Test Case 2:
        // Key = "Jefe" (4 bytes)
        // Data = "what do ya want for nothing?" (28 bytes)
        // HMAC-SHA-256 digest = 5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843
        const secret = 'Jefe';
        const message = 'what do ya want for nothing?';
        const sig = await computeHmacSha256(secret, message);
        expect(sig).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    });

    test('generatePusherQueryString formats query string with HMAC signature', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const body = JSON.stringify({ test: 'data' });
        const queryStr = await generatePusherQueryString('POST', '/apps/100/events', body, config, 1600000000);

        expect(queryStr).toContain('auth_key=test_key');
        expect(queryStr).toContain('auth_timestamp=1600000000');
        expect(queryStr).toContain('auth_version=1.0');
        expect(queryStr).toContain('body_md5=' + md5(body));
        expect(queryStr).toContain('auth_signature=');
    });

    test('validatePusherConfig throws error when config is missing or placeholders', () => {
        expect(() => validatePusherConfig({ appId: '__PUSHER_APP_ID__', key: 'key', cluster: 'ap3' })).toThrow();
        expect(() => validatePusherConfig({ appId: '123', key: '__PUSHER_KEY__', cluster: 'ap3' })).toThrow();
        expect(() => validatePusherConfig({ appId: '123', key: 'key', cluster: '__PUSHER_CLUSTER__' })).toThrow();
        expect(() => validatePusherConfig(null)).toThrow();
        expect(() => validatePusherConfig({ appId: '123', key: 'mykey', cluster: 'ap3' })).not.toThrow();
    });

    test('sendSettingsToPusher throws error when config has placeholders', async () => {
        const pin = '123456';
        const placeholderConfig = {
            appId: '__PUSHER_APP_ID__',
            key: '__PUSHER_KEY__',
            secret: '__PUSHER_SECRET__',
            cluster: '__PUSHER_CLUSTER__',
        };
        await expect(sendSettingsToPusher('sync-123456', {}, pin, placeholderConfig)).rejects.toThrow(
            'Pusher configuration is incomplete'
        );
    });

    test('sendSettingsToPusher issues POST fetch request with application/json Content-Type', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const pin = '582914';
        const roomId = 'sync-582914';
        const settingsData = { settings: { theme: 'light' } };

        const mockResponse = { ok: true, status: 200, statusText: 'OK' };
        const fetchMock = jest.fn().mockResolvedValue(mockResponse);
        globalThis.fetch = fetchMock;

        const res = await sendSettingsToPusher(roomId, settingsData, pin, config);
        expect(res.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const callArgs = fetchMock.mock.calls[0];
        expect(callArgs[0]).toContain('https://api-ap3.pusher.com/apps/100/events?');
        expect(callArgs[1].method).toBe('POST');
        expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    });

    test('sendSettingsToPusher retries on network failure and handles timeout', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const pin = '582914';
        const roomId = 'sync-582914';
        const settingsData = { settings: { theme: 'dark' } };

        const fetchMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        globalThis.fetch = fetchMock;

        await expect(
            sendSettingsToPusher(roomId, settingsData, pin, config, null, { timeoutMs: 10, maxRetries: 1 })
        ).rejects.toThrow('Failed to fetch');

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('fetchSettingsFromPusher receives and decrypts settings via WebSocket', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const pin = '582914';
        const roomId = 'sync-582914';
        const originalData = { settings: { language: 'en' } };

        const encrypted = await encryptPayload(originalData, pin);

        class MockWebSocket {
            constructor(url) {
                this.url = url;
                setTimeout(() => {
                    if (this.onmessage) {
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'pusher:connection_established',
                                data: '{}',
                            }),
                        });
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'sync-settings',
                                data: JSON.stringify({ payload: encrypted }),
                            }),
                        });
                    }
                }, 10);
            }
            send() {}
            close() {}
        }

        globalThis.WebSocket = MockWebSocket;

        const fetchedData = await fetchSettingsFromPusher(roomId, pin, config, 1000);
        expect(fetchedData.settings).toEqual(originalData);
        expect(typeof fetchedData.createdAt).toBe('number');
    });

    test('fetchSettingsFromPusher times out when no WebSocket message received', async () => {
        class TimeoutMockWebSocket {
            constructor() {
                setTimeout(() => {
                    if (this.onclose) this.onclose({ code: 1000, reason: 'Normal closure' });
                }, 50);
            }
            close() {}
        }

        globalThis.WebSocket = TimeoutMockWebSocket;

        const roomId = 'sync-582914';
        const pin = '582914';

        const dummyConfig = { appId: '12345', key: 'testkey', secret: 'testsecret', cluster: 'ap3' };
        await expect(fetchSettingsFromPusher(roomId, pin, dummyConfig, 100)).rejects.toThrow();
    });

    test('sendSettingsToPusher splits large payloads (>10KB) into multiple chunks without exceeding event limit', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const pin = '582914';
        const roomId = 'sync-582914';

        // Generate large settings data to exceed 10KB
        const largeCategories = Array.from({ length: 150 }, (_, i) => ({
            id: `cat-${i}`,
            name: `Category ${i} - ${'X'.repeat(100)}`,
            color: 'primary',
            tags: 'tag1, tag2, tag3',
        }));
        const largeSettingsData = { settings: { theme: 'dark' }, categories: largeCategories, alarms: [] };

        const mockResponse = { ok: true, status: 200, statusText: 'OK' };
        const fetchMock = jest.fn().mockResolvedValue(mockResponse);
        globalThis.fetch = fetchMock;

        const res = await sendSettingsToPusher(roomId, largeSettingsData, pin, config);
        expect(res.ok).toBe(true);

        // Verify multiple requests were issued
        expect(fetchMock.mock.calls.length).toBeGreaterThan(1);

        // Verify every POST body sent is well within Pusher's 10240 byte limit
        for (const call of fetchMock.mock.calls) {
            const bodyStr = call[1].body;
            const bodyBytes = new TextEncoder().encode(bodyStr).length;
            expect(bodyBytes).toBeLessThan(10240);

            const parsedBody = JSON.parse(bodyStr);
            const parsedData = JSON.parse(parsedBody.data);
            expect(parsedData.totalChunks).toBeGreaterThan(1);
            expect(typeof parsedData.chunkIndex).toBe('number');
            expect(typeof parsedData.transferId).toBe('string');
            expect(parsedData.transferId.length).toBeGreaterThan(0);
            expect(parsedData.payload.data.length).toBeLessThanOrEqual(6000);
        }
    });

    test('fetchSettingsFromPusher reassembles multi-chunk WebSocket messages and decrypts correctly', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const pin = '582914';
        const roomId = 'sync-582914';

        const largeData = {
            settings: { language: 'ja', theme: 'dark' },
            categories: Array.from({ length: 100 }, (_, i) => ({ name: `Cat ${i}`, details: 'Y'.repeat(100) })),
        };

        const encrypted = await encryptPayload(largeData, pin);
        const PUSHER_CHUNK_SIZE = 6000;
        const totalChunks = Math.ceil(encrypted.data.length / PUSHER_CHUNK_SIZE);
        expect(totalChunks).toBeGreaterThan(1);

        const chunksEvents = [];
        for (let i = 0; i < totalChunks; i++) {
            const chunkData = encrypted.data.slice(i * PUSHER_CHUNK_SIZE, (i + 1) * PUSHER_CHUNK_SIZE);
            chunksEvents.push({
                event: 'sync-settings',
                data: JSON.stringify({
                    chunkIndex: i,
                    totalChunks,
                    payload: {
                        salt: encrypted.salt,
                        iv: encrypted.iv,
                        data: chunkData,
                    },
                }),
            });
        }

        class MockChunkWebSocket {
            constructor(url) {
                this.url = url;
                setTimeout(() => {
                    if (this.onmessage) {
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'pusher:connection_established',
                                data: '{}',
                            }),
                        });
                        chunksEvents.forEach((evt) => {
                            this.onmessage({ data: JSON.stringify(evt) });
                        });
                    }
                }, 10);
            }
            send() {}
            close() {}
        }

        globalThis.WebSocket = MockChunkWebSocket;

        const statusLogs = [];
        const fetchedData = await fetchSettingsFromPusher(roomId, pin, config, 1000, (msg) => {
            statusLogs.push(msg);
        });

        expect(fetchedData.settings).toEqual(largeData);
        expect(statusLogs.some((s) => s.includes('データ受信中'))).toBe(true);
        expect(statusLogs[statusLogs.length - 1]).toBe('データ受信完了・復号中...');
    });

    test('fetchSettingsFromPusher ignores invalid chunkIndex and resets buffer on transferId change', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const pin = '582914';
        const roomId = 'sync-582914';

        const data1 = { settings: { theme: 'light' } };
        const data2 = { settings: { theme: 'dark' } };

        const enc1 = await encryptPayload(data1, pin);
        const enc2 = await encryptPayload(data2, pin);

        class MockTransferIdWebSocket {
            constructor(url) {
                this.url = url;
                setTimeout(() => {
                    if (this.onmessage) {
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'pusher:connection_established',
                                data: '{}',
                            }),
                        });

                        // 1. Invalid chunkIndex (negative or out of bounds) -> should be ignored
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'sync-settings',
                                data: JSON.stringify({
                                    chunkIndex: -1,
                                    totalChunks: 2,
                                    transferId: 't1',
                                    payload: { salt: enc1.salt, iv: enc1.iv, data: 'invalid' },
                                }),
                            }),
                        });
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'sync-settings',
                                data: JSON.stringify({
                                    chunkIndex: 5,
                                    totalChunks: 2,
                                    transferId: 't1',
                                    payload: { salt: enc1.salt, iv: enc1.iv, data: 'invalid' },
                                }),
                            }),
                        });

                        // 2. Partial transmission t1 (chunk 0)
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'sync-settings',
                                data: JSON.stringify({
                                    chunkIndex: 0,
                                    totalChunks: 2,
                                    transferId: 't1',
                                    payload: { salt: enc1.salt, iv: enc1.iv, data: enc1.data.slice(0, 10) },
                                }),
                            }),
                        });

                        // 3. New transmission t2 (chunk 0 and 1 for enc2) -> should clear t1 buffer and complete t2
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'sync-settings',
                                data: JSON.stringify({
                                    chunkIndex: 0,
                                    totalChunks: 1,
                                    transferId: 't2',
                                    payload: enc2,
                                }),
                            }),
                        });
                    }
                }, 10);
            }
            send() {}
            close() {}
        }

        globalThis.WebSocket = MockTransferIdWebSocket;

        const fetchedData = await fetchSettingsFromPusher(roomId, pin, config, 1000);
        expect(fetchedData.settings).toEqual(data2);
    });

    test('fetchSettingsFromPusher gracefully handles malformed WebSocket JSON and event.data without breaking connection', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const pin = '582914';
        const roomId = 'sync-582914';
        const validData = { settings: { theme: 'dark' } };
        const encrypted = await encryptPayload(validData, pin);

        class MockMalformedWebSocket {
            constructor(url) {
                this.url = url;
                setTimeout(() => {
                    if (this.onmessage) {
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'pusher:connection_established',
                                data: '{}',
                            }),
                        });

                        // Send completely invalid JSON string
                        this.onmessage({ data: 'INVALID_JSON{{{[' });

                        // Send primitive JSON values that pass JSON.parse but are not objects
                        this.onmessage({ data: '12345' });
                        this.onmessage({ data: 'true' });
                        this.onmessage({ data: '"just a string"' });
                        this.onmessage({ data: 'null' });

                        // Send valid WebSocket JSON but malformed event.data string
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'sync-settings',
                                data: 'CORRUPTED_JSON_STRING',
                            }),
                        });

                        // Send valid WebSocket message after malformed messages
                        this.onmessage({
                            data: JSON.stringify({
                                event: 'sync-settings',
                                data: JSON.stringify({ payload: encrypted }),
                            }),
                        });
                    }
                }, 10);
            }
            send() {}
            close() {}
        }

        globalThis.WebSocket = MockMalformedWebSocket;

        const fetchedData = await fetchSettingsFromPusher(roomId, pin, config, 1000);
        expect(fetchedData.settings).toEqual(validData);
    });

    test('buildPusherErrorReport generates rate limit guidance for 429 and 402 errors', () => {
        const steps = [
            { name: '1. 6桁PINコード生成', status: 'success', detail: 'OK' },
            { name: '2. 設定データ取得', status: 'success', detail: 'OK' },
            { name: '3. データ暗号化', status: 'success', detail: 'OK' },
            { name: '4. Pusher通信送信', status: 'failed', detail: 'Pusher API error: 429 Too Many Requests' },
        ];
        const err429 = new Error('Pusher API error: 429 Too Many Requests');
        const report429 = buildPusherErrorReport(steps, err429);

        expect(report429).toContain('Pusher API error: 429 Too Many Requests');
        expect(report429).toContain(t('pusher-error-rate-limit'));

        const err402 = new Error('Pusher API error: 402 Over Quota');
        const report402 = buildPusherErrorReport(steps, err402);
        expect(report402).toContain(t('pusher-error-rate-limit'));
    });

    test('dbImportTransferredSettings imports data into IDB and dbImportQRSettings is an alias', async () => {
        setDatabaseName(`TestTransferredSyncDB_${Date.now()}`);
        expect(dbImportQRSettings).toBe(dbImportTransferredSettings);

        const testPayload = {
            settings: { theme: 'dark', font: 'Inter' },
            categories: [{ id: 101, name: 'テストカテゴリ', color: 'primary', order: 0 }],
            alarms: [{ id: 201, time: '10:00', enabled: true }],
        };

        await dbImportTransferredSettings(testPayload);

        const settings = await dbGetAll(STORE_SETTINGS);
        const categories = await dbGetAll(STORE_CATEGORIES);
        const alarms = await dbGetAll(STORE_ALARMS);

        expect(settings.some((s) => s.key === 'theme' && s.value === 'dark')).toBe(true);
        expect(categories.some((c) => c.name === 'テストカテゴリ')).toBe(true);
        expect(alarms.some((a) => a.id === 201)).toBe(true);
    });
});
