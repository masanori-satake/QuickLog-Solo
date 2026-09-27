import { PUSHER_CONFIG } from './pusher_config.js';

/**
 * Lightweight Pure JS MD5 implementation for computing body_md5 required by Pusher REST API.
 * @param {string} string - Input string to hash.
 * @returns {string} MD5 hex digest.
 */
export function md5(str) {
    const k = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8,
        0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
        0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87,
        0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
        0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039,
        0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
        0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb,
        0xeb86d391,
    ];
    const r = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
        20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6,
        10, 15, 21,
    ];
    const utf8 = unescape(encodeURIComponent(str));
    const len = utf8.length;
    const words = [];
    for (let i = 0; i < len; i++) {
        words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((i % 4) * 8);
    }
    words[len >> 2] |= 0x80 << ((len % 4) * 8);
    const wordLen = (((len + 8) >> 6) + 1) * 16;
    while (words.length < wordLen) words.push(0);
    words[wordLen - 2] = (len * 8) & 0xffffffff;
    words[wordLen - 1] = Math.floor((len * 8) / 0x100000000);

    let h0 = 0x67452301,
        h1 = 0xefcdab89,
        h2 = 0x98badcfe,
        h3 = 0x10325476;
    for (let i = 0; i < words.length; i += 16) {
        let a = h0,
            b = h1,
            c = h2,
            d = h3;
        for (let j = 0; j < 64; j++) {
            let f, g;
            if (j < 16) {
                f = (b & c) | (~b & d);
                g = j;
            } else if (j < 32) {
                f = (d & b) | (~d & c);
                g = (5 * j + 1) % 16;
            } else if (j < 48) {
                f = b ^ c ^ d;
                g = (3 * j + 5) % 16;
            } else {
                f = c ^ (b | ~d);
                g = (7 * j) % 16;
            }
            const temp = d;
            d = c;
            c = b;
            const sum = (a + f + k[j] + (words[i + g] || 0)) & 0xffffffff;
            const rot = (sum << r[j]) | (sum >>> (32 - r[j]));
            b = (b + rot) & 0xffffffff;
            a = temp;
        }
        h0 = (h0 + a) & 0xffffffff;
        h1 = (h1 + b) & 0xffffffff;
        h2 = (h2 + c) & 0xffffffff;
        h3 = (h3 + d) & 0xffffffff;
    }
    const toHex = (n) => {
        let hex = '';
        for (let i = 0; i < 4; i++) {
            hex += ((n >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
        }
        return hex;
    };
    return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3);
}

/**
 * Generates a random 32-byte secret key as a hex string (64 characters).
 * @returns {string} Hex string of 32 random bytes.
 */
export function generateSecretKey() {
    const bytes = new Uint8Array(32);
    const cryptoObj = getCrypto();
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Converts a hex string to Uint8Array.
 * @param {string} hexString
 * @returns {Uint8Array}
 */
function hexToBytes(hexString) {
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return bytes;
}

/**
 * Encrypts data using Web Crypto API (AES-GCM 256-bit).
 * @param {any} data - Data to encrypt.
 * @param {string} secretKeyHex - 32-byte key in hex string format.
 * @returns {Promise<{iv: string, data: string}>} Object with Base64 encoded iv and encrypted data.
 */
function getCrypto() {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
        return globalThis.crypto;
    }
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        return window.crypto;
    }
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        return crypto;
    }
    return null;
}

export async function encryptPayload(data, secretKeyHex) {
    const cryptoObj = getCrypto();
    const keyBytes = hexToBytes(secretKeyHex);
    const cryptoKey = await cryptoObj.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);

    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const jsonStr = JSON.stringify(data);
    const encodedData = new TextEncoder().encode(jsonStr);

    const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encodedData);

    const ivBase64 = btoa(String.fromCharCode(...iv));
    const dataBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

    return {
        iv: ivBase64,
        data: dataBase64,
    };
}

/**
 * Decrypts data using Web Crypto API (AES-GCM 256-bit).
 * @param {{iv: string, data: string}} encryptedObj - Object containing Base64 encoded iv and data.
 * @param {string} secretKeyHex - 32-byte key in hex string format.
 * @returns {Promise<any>} Decrypted JSON data.
 */
export async function decryptPayload(encryptedObj, secretKeyHex) {
    const cryptoObj = getCrypto();
    const keyBytes = hexToBytes(secretKeyHex);
    const cryptoKey = await cryptoObj.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);

    const ivBytes = Uint8Array.from(atob(encryptedObj.iv), (c) => c.charCodeAt(0));
    const dataBytes = Uint8Array.from(atob(encryptedObj.data), (c) => c.charCodeAt(0));

    const decryptedBuffer = await cryptoObj.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, cryptoKey, dataBytes);

    const decodedStr = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decodedStr);
}

/**
 * Computes HMAC-SHA256 signature in hex using Web Crypto API.
 * @param {string} secret - Secret key string.
 * @param {string} message - String to sign.
 * @returns {Promise<string>} Hex signature.
 */
export async function computeHmacSha256(secret, message) {
    const cryptoObj = getCrypto();
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(message);

    const cryptoKey = await cryptoObj.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
    );

    const signatureBuffer = await cryptoObj.subtle.sign('HMAC', cryptoKey, msgData);
    return Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generates Pusher REST API authentication signature query string.
 * @param {string} method - HTTP method ('POST' or 'GET').
 * @param {string} path - Request path e.g. '/apps/123/events'.
 * @param {string} body - Request body string (empty string for GET).
 * @param {Object} config - Pusher configuration object ({ appId, key, secret, cluster }).
 * @param {number} [timestamp] - Unix timestamp in seconds.
 * @returns {Promise<string>} Query string containing authentication parameters.
 */
/**
 * Validates whether Pusher configuration has been injected.
 * @param {Object} [config=PUSHER_CONFIG] - Pusher configuration object.
 * @throws {Error} If configuration is missing or contains placeholder values.
 */
export function validatePusherConfig(config = PUSHER_CONFIG) {
    if (
        !config ||
        !config.appId ||
        !config.key ||
        !config.cluster ||
        String(config.appId).includes('__PUSHER_') ||
        String(config.key).includes('__PUSHER_') ||
        String(config.cluster).includes('__PUSHER_')
    ) {
        throw new Error('Pusher configuration is incomplete (API key or cluster is missing).');
    }
}

export async function generatePusherQueryString(method, path, body, config, timestamp = Math.floor(Date.now() / 1000)) {
    const params = {
        auth_key: config.key,
        auth_timestamp: String(timestamp),
        auth_version: '1.0',
    };

    if (method.toUpperCase() === 'POST' && body) {
        params.body_md5 = md5(body);
    }

    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');

    if (!config.secret) {
        return queryString;
    }

    const stringToSign = `${method.toUpperCase()}\n${path}\n${queryString}`;
    const signature = await computeHmacSha256(config.secret, stringToSign);

    return `${queryString}&auth_signature=${signature}`;
}

/**
 * Sends encrypted settings payload to Pusher via HTTP REST API POST request.
 * @param {string} roomId - Room ID (channel name).
 * @param {Object} settingsData - Settings data to send.
 * @param {string} secretKeyHex - 32-byte secret key in hex string format.
 * @param {Object} [config=PUSHER_CONFIG] - Pusher config object.
 * @returns {Promise<Response>} Fetch response.
 */
const PUSHER_MAX_PAYLOAD_BYTES = 10240; // Pusher standard event data limit (10KB)

export async function sendSettingsToPusher(
    roomId,
    settingsData,
    secretKeyHex,
    config = PUSHER_CONFIG,
    onEncrypted = null,
    options = {}
) {
    validatePusherConfig(config);

    const timeoutMs = options.timeoutMs || 10000;
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;

    const encryptedPayload = await encryptPayload(settingsData, secretKeyHex);
    if (typeof onEncrypted === 'function') {
        onEncrypted();
    }

    const path = `/apps/${config.appId}/events`;
    const url = `https://api-${config.cluster}.pusher.com${path}`;

    const payloadDataStr = JSON.stringify({ payload: encryptedPayload });
    const payloadSizeBytes = new TextEncoder().encode(payloadDataStr).length;

    if (payloadSizeBytes > PUSHER_MAX_PAYLOAD_BYTES) {
        throw new Error(
            `Payload size (${payloadSizeBytes} bytes) exceeds Pusher event limit (${PUSHER_MAX_PAYLOAD_BYTES} bytes)`
        );
    }

    const bodyObj = {
        name: 'sync-settings',
        channels: [roomId],
        data: payloadDataStr,
    };
    const bodyStr = JSON.stringify(bodyObj);

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const queryParams = await generatePusherQueryString('POST', path, bodyStr, config);
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timerId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        try {
            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                },
                body: bodyStr,
            };
            if (controller) {
                fetchOptions.signal = controller.signal;
            }

            const response = await fetch(`${url}?${queryParams}`, fetchOptions);
            if (timerId) clearTimeout(timerId);

            if (!response.ok) {
                throw new Error(`Pusher API error: ${response.status} ${response.statusText}`);
            }

            return response;
        } catch (err) {
            if (timerId) clearTimeout(timerId);
            const isAbort = err && (err.name === 'AbortError' || err.message?.includes('aborted'));
            if (isAbort) {
                lastError = new Error(`Communication timed out (${timeoutMs / 1000}s)`);
            } else {
                lastError = err;
            }

            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }

    throw lastError;
}

/**
 * Fetches encrypted settings payload from Pusher via HTTP REST API GET request with retry polling.
 * @param {string} roomId - Room ID (channel name).
 * @param {string} secretKeyHex - 32-byte secret key in hex string format.
 * @param {Object} [config=PUSHER_CONFIG] - Pusher config object.
 * @param {number} [maxRetries=5] - Maximum retry count.
 * @param {number} [intervalMs=1000] - Polling interval in ms.
 * @returns {Promise<Object>} Decrypted settings data.
 */
/**
 * Subscribes to Pusher WebSocket channel and receives encrypted settings payload in Pure JS.
 * @param {string} roomId - Room ID (channel name).
 * @param {string} secretKeyHex - 32-byte secret key in hex string format.
 * @param {Object} [config=PUSHER_CONFIG] - Pusher config object.
 * @param {number} [timeoutMs=30000] - Connection timeout in ms.
 * @returns {Promise<Object>} Decrypted settings data.
 */
export function fetchSettingsFromPusher(roomId, secretKeyHex, config = PUSHER_CONFIG, timeoutMs = 30000) {
    validatePusherConfig(config);

    return new Promise((resolve, reject) => {
        const wsUrl = `wss://ws-${config.cluster}.pusher.com/app/${config.key}?protocol=7&client=js&version=8.0.0`;
        let socket;
        let timeoutId;

        try {
            socket = new WebSocket(wsUrl);
        } catch (err) {
            return reject(err);
        }

        timeoutId = setTimeout(() => {
            if (socket) socket.close();
            reject(new Error('Pusher WebSocket connection timeout'));
        }, timeoutMs);

        let isResolved = false;

        socket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.event === 'pusher:connection_established') {
                    socket.send(
                        JSON.stringify({
                            event: 'pusher:subscribe',
                            data: { channel: roomId },
                        })
                    );
                }

                if (message.event === 'sync-settings') {
                    isResolved = true;
                    clearTimeout(timeoutId);
                    const eventData = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
                    const encryptedPayload = eventData.payload;
                    const settings = await decryptPayload(encryptedPayload, secretKeyHex);
                    socket.close();
                    resolve(settings);
                }
            } catch (err) {
                if (!isResolved) {
                    clearTimeout(timeoutId);
                    if (socket) socket.close();
                    reject(err);
                }
            }
        };

        socket.onerror = (err) => {
            if (!isResolved) {
                clearTimeout(timeoutId);
                reject(err || new Error('WebSocket error'));
            }
        };

        socket.onclose = (event) => {
            if (!isResolved) {
                clearTimeout(timeoutId);
                reject(
                    new Error(
                        `WebSocket closed before message received (code: ${event.code}, reason: ${event.reason || 'none'})`
                    )
                );
            }
        };
    });
}
