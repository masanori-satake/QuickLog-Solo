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
    generateSecretKey,
    encryptPayload,
    decryptPayload,
    computeHmacSha256,
    generatePusherQueryString,
    sendSettingsToPusher,
    fetchSettingsFromPusher,
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

    test('generateSecretKey returns 64-char hex string', () => {
        const key = generateSecretKey();
        expect(typeof key).toBe('string');
        expect(key.length).toBe(64);
        expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });

    test('encryptPayload and decryptPayload round-trip', async () => {
        const secretKey = generateSecretKey();
        const data = {
            settings: { theme: 'dark', language: 'ja' },
            categories: [{ name: '開発', color: 'primary' }],
            alarms: [{ id: 1, time: '12:00', enabled: true }],
        };

        const encrypted = await encryptPayload(data, secretKey);
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.data).toBeDefined();

        const decrypted = await decryptPayload(encrypted, secretKey);
        expect(decrypted).toEqual(data);
    });

    test('computeHmacSha256 generates correct signature', async () => {
        const secret = 'my_secret';
        const message = 'POST\n/apps/123/events\nauth_key=key&auth_timestamp=1000&auth_version=1.0';
        const sig = await computeHmacSha256(secret, message);
        expect(typeof sig).toBe('string');
        expect(sig.length).toBe(64);
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

    test('sendSettingsToPusher issues POST fetch request', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const secretKey = generateSecretKey();
        const roomId = 'room_123';
        const settingsData = { settings: { theme: 'light' } };

        const mockResponse = { ok: true, status: 200, statusText: 'OK' };
        const fetchMock = jest.fn().mockResolvedValue(mockResponse);
        globalThis.fetch = fetchMock;

        const res = await sendSettingsToPusher(roomId, settingsData, secretKey, config);
        expect(res.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const callArgs = fetchMock.mock.calls[0];
        expect(callArgs[0]).toContain('https://api-ap3.pusher.com/apps/100/events?');
        expect(callArgs[1].method).toBe('POST');
    });

    test('fetchSettingsFromPusher receives and decrypts settings via WebSocket', async () => {
        const config = {
            appId: '100',
            key: 'test_key',
            secret: 'test_secret',
            cluster: 'ap3',
        };
        const secretKey = generateSecretKey();
        const roomId = 'room_123';
        const originalData = { settings: { language: 'en' } };

        const encrypted = await encryptPayload(originalData, secretKey);

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

        const fetchedData = await fetchSettingsFromPusher(roomId, secretKey, config, 1000);
        expect(fetchedData).toEqual(originalData);
    });
});
