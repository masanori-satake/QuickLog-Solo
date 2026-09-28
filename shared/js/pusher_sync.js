import { PUSHER_CONFIG } from './pusher_config.js';

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

/**
 * Lightweight Pure JS MD5 implementation for computing body_md5 required by Pusher REST API.
 * @param {string} str - Input string to hash.
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
 * Computes HMAC-SHA256 in hex using WebCrypto API (crypto.subtle).
 * @param {string} keyStr - Secret key string.
 * @param {string} messageStr - Message string to sign.
 * @returns {Promise<string>} Hex signature.
 */
export async function computeHmacSha256(keyStr, messageStr) {
    const cryptoObj = getCrypto();
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyStr);
    const msgData = encoder.encode(messageStr);

    const key = await cryptoObj.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await cryptoObj.subtle.sign('HMAC', key, msgData);
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generates an authenticated AES-GCM CryptoKey from a 6-digit PIN using PBKDF2-HMAC-SHA256 key derivation.
 * @param {string} pinOrKey
 * @param {Uint8Array} saltBytes
 * @returns {Promise<CryptoKey>}
 */
async function getKeyFromPin(pinOrKey, saltBytes) {
    const cryptoObj = getCrypto();
    const encoder = new TextEncoder();
    const pinBytes = encoder.encode(String(pinOrKey));

    const baseKey = await cryptoObj.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveKey']);
    return cryptoObj.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: 100000,
            hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Generates a cryptographically secure random 6-digit PIN code string (e.g. "582914").
 * Eliminates modulo bias using rejection sampling over 32-bit unsigned integer space.
 * @returns {string} 6-digit PIN.
 */
export function generate6DigitPin() {
    const cryptoObj = getCrypto();
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        const array = new Uint32Array(1);
        // 4,294,000,000 is the largest multiple of 1,000,000 <= 2^32 - 1 (4,294,967,295).
        // Discard values >= 4,294,000,000 to eliminate modulo bias when deriving AES-GCM keys.
        const maxValid = 4294000000;
        let pinNum;
        do {
            cryptoObj.getRandomValues(array);
            pinNum = array[0];
        } while (pinNum >= maxValid);
        return String(pinNum % 1000000).padStart(6, '0');
    }

    let pin = '';
    for (let i = 0; i < 6; i++) {
        pin += Math.floor(Math.random() * 10).toString();
    }
    return pin;
}

/**
 * Generates a random 6-digit numeric string for compatibility.
 * @returns {string} 6-digit numeric string.
 */
export function generateSecretKey() {
    return generate6DigitPin();
}

/**
 * Encrypts data using WebCrypto API (AES-GCM 256-bit) with PBKDF2 key derivation.
 * Adds `createdAt: Date.now()` timestamp to payload object before encryption.
 * @param {any} data - Object to encrypt.
 * @param {string} pinOrKey - 6-digit PIN or secret key string.
 * @returns {Promise<{salt: string, iv: string, data: string}>} Base64 salt, IV and encrypted data.
 */
export async function encryptPayload(data, pinOrKey) {
    const cryptoObj = getCrypto();
    const payload = {
        createdAt: Date.now(),
        settings: data,
    };
    const jsonStr = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(jsonStr);

    const salt = cryptoObj.getRandomValues(new Uint8Array(16));
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));

    const key = await getKeyFromPin(pinOrKey, salt);
    const encryptedBuf = await cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv }, key, dataBytes);

    let saltBinary = '';
    for (let i = 0; i < salt.length; i++) {
        saltBinary += String.fromCharCode(salt[i]);
    }

    let ivBinary = '';
    for (let i = 0; i < iv.length; i++) {
        ivBinary += String.fromCharCode(iv[i]);
    }

    let dataBinary = '';
    const dataArr = new Uint8Array(encryptedBuf);
    for (let i = 0; i < dataArr.length; i++) {
        dataBinary += String.fromCharCode(dataArr[i]);
    }

    return {
        salt: btoa(saltBinary),
        iv: btoa(ivBinary),
        data: btoa(dataBinary),
    };
}

/**
 * Decrypts and authenticates data using WebCrypto API (AES-GCM 256-bit).
 * @param {{salt?: string, iv: string, data: string}} encryptedObj - Base64 salt, IV and encrypted data.
 * @param {string} pinOrKey - 6-digit PIN or secret key string.
 * @returns {Promise<{createdAt: number, settings: any}>} Decrypted payload object with timestamp and settings.
 */
export async function decryptPayload(encryptedObj, pinOrKey) {
    if (!encryptedObj || !encryptedObj.data || !encryptedObj.iv) {
        throw new Error('Invalid encrypted payload structure');
    }

    const cryptoObj = getCrypto();

    const ivBinary = atob(encryptedObj.iv);
    const iv = new Uint8Array(ivBinary.length);
    for (let i = 0; i < ivBinary.length; i++) {
        iv[i] = ivBinary.charCodeAt(i);
    }

    let salt;
    if (encryptedObj.salt) {
        const saltBinary = atob(encryptedObj.salt);
        salt = new Uint8Array(saltBinary.length);
        for (let i = 0; i < saltBinary.length; i++) {
            salt[i] = saltBinary.charCodeAt(i);
        }
    } else {
        salt = new TextEncoder().encode('QuickLog-Solo-Sync-Salt');
    }

    const key = await getKeyFromPin(pinOrKey, salt);

    const dataBinary = atob(encryptedObj.data);
    const dataBytes = new Uint8Array(dataBinary.length);
    for (let i = 0; i < dataBinary.length; i++) {
        dataBytes[i] = dataBinary.charCodeAt(i);
    }

    const decryptedBuf = await cryptoObj.subtle.decrypt({ name: 'AES-GCM', iv }, key, dataBytes);
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuf);
    return JSON.parse(jsonStr);
}

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

/**
 * Generates Pusher REST API authentication signature query string.
 * @param {string} method - HTTP method ('POST' or 'GET').
 * @param {string} path - Request path e.g. '/apps/123/events'.
 * @param {string} body - Request body string (empty string for GET).
 * @param {Object} config - Pusher configuration object.
 * @param {number} [timestamp] - Unix timestamp in seconds.
 * @returns {Promise<string>} Query string containing authentication parameters.
 */
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

const PUSHER_MAX_PAYLOAD_BYTES = 10240; // Pusher standard event data limit (10KB)

/**
 * Sends encrypted settings payload to Pusher via HTTP REST API POST request.
 * @param {string} roomId - Room ID / Channel name (e.g. "sync-582914").
 * @param {Object} settingsData - Settings data to send.
 * @param {string} pinOrKey - 6-digit PIN or secret key string.
 * @param {Object} [config=PUSHER_CONFIG] - Pusher config object.
 * @returns {Promise<Response>} Fetch response.
 */
export async function sendSettingsToPusher(
    roomId,
    settingsData,
    pinOrKey,
    config = PUSHER_CONFIG,
    onEncrypted = null,
    options = {}
) {
    validatePusherConfig(config);

    const timeoutMs = options.timeoutMs || 10000;
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;

    const encryptedPayload = await encryptPayload(settingsData, pinOrKey);
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
                    'Content-Type': 'application/json',
                },
                body: bodyStr,
            };
            if (controller) {
                fetchOptions.signal = controller.signal;
            }

            const response = await fetch(`${url}?${queryParams}`, fetchOptions);
            if (timerId) clearTimeout(timerId);

            if (!response.ok) {
                const responseText = await response.text().catch(() => '');
                throw new Error(
                    `Pusher API error: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ''}`
                );
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
 * Subscribes to Pusher WebSocket channel and receives encrypted settings payload in Pure JS.
 * @param {string} roomId - Room ID / Channel name (e.g. "sync-582914").
 * @param {string} pinOrKey - 6-digit PIN or secret key string.
 * @param {Object} [config=PUSHER_CONFIG] - Pusher config object.
 * @param {number} [timeoutMs=12000] - Connection timeout in ms.
 * @param {function} [onStatusChange] - Status callback e.g. (statusMsg) => void.
 * @returns {Promise<{createdAt: number, settings: any}>} Decrypted payload object with timestamp and settings.
 */
export function fetchSettingsFromPusher(
    roomId,
    pinOrKey,
    config = PUSHER_CONFIG,
    timeoutMs = 12000,
    onStatusChange = null
) {
    validatePusherConfig(config);

    if (typeof onStatusChange === 'function') {
        onStatusChange('接続中...');
    }

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
                    if (typeof onStatusChange === 'function') {
                        onStatusChange('データ待機中...');
                    }
                    socket.send(
                        JSON.stringify({
                            event: 'pusher:subscribe',
                            data: { channel: roomId },
                        })
                    );
                }

                if (message.event === 'sync-settings') {
                    clearTimeout(timeoutId);
                    if (typeof onStatusChange === 'function') {
                        onStatusChange('データ受信完了・復号中...');
                    }
                    const eventData = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
                    const encryptedPayload = eventData.payload;
                    const decryptedPayload = await decryptPayload(encryptedPayload, pinOrKey);

                    isResolved = true;
                    socket.close();
                    resolve(decryptedPayload);
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
