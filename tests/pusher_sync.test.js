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
} from '../shared/js/pusher_sync.js';

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

    test('computeHmacSha256 generates correct signature using WebCrypto SHA256', async () => {
        const secret = 'my_secret';
        const message = 'POST\n/apps/123/events\nauth_key=key&auth_timestamp=1000&auth_version=1.0';
        const sig = await computeHmacSha256(secret, message);
        expect(typeof sig).toBe('string');
        expect(sig.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(sig)).toBe(true);
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
});
