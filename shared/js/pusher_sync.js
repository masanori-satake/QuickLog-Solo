import { PUSHER_CONFIG } from './pusher_config.js';

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
 * Pure JS SHA-256 implementation on byte arrays.
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} 32-byte digest
 */
export function sha256Bytes(bytes) {
    const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
        0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
        0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
        0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
        0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
        0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];

    let H0 = 0x6a09e667,
        H1 = 0xbb67ae85,
        H2 = 0x3c6ef372,
        H3 = 0xa54ff53a;
    let H4 = 0x510e527f,
        H5 = 0x9b05688c,
        H6 = 0x1f83d9ab,
        H7 = 0x5be0cd19;

    const l = bytes.length;
    const bitLen = l * 8;
    const padLen = (l + 9) % 64 === 0 ? l + 9 : l + 9 + (64 - ((l + 9) % 64));
    const padded = new Uint8Array(padLen);
    padded.set(bytes);
    padded[l] = 0x80;

    const highBits = Math.floor(bitLen / 0x100000000);
    const lowBits = bitLen % 0x100000000;
    padded[padLen - 8] = (highBits >>> 24) & 0xff;
    padded[padLen - 7] = (highBits >>> 16) & 0xff;
    padded[padLen - 6] = (highBits >>> 8) & 0xff;
    padded[padLen - 5] = highBits & 0xff;
    padded[padLen - 4] = (lowBits >>> 24) & 0xff;
    padded[padLen - 3] = (lowBits >>> 16) & 0xff;
    padded[padLen - 2] = (lowBits >>> 8) & 0xff;
    padded[padLen - 1] = lowBits & 0xff;

    const W = new Uint32Array(64);

    for (let i = 0; i < padded.length; i += 64) {
        for (let t = 0; t < 16; t++) {
            W[t] =
                (padded[i + t * 4] << 24) |
                (padded[i + t * 4 + 1] << 16) |
                (padded[i + t * 4 + 2] << 8) |
                padded[i + t * 4 + 3];
        }
        for (let t = 16; t < 64; t++) {
            const s0 =
                ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3);
            const s1 =
                ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10);
            W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
        }

        let a = H0,
            b = H1,
            c = H2,
            d = H3,
            e = H4,
            f = H5,
            g = H6,
            h = H7;

        for (let t = 0; t < 64; t++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
            const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) | 0;

            h = g;
            g = f;
            f = e;
            e = (d + temp1) | 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) | 0;
        }

        H0 = (H0 + a) | 0;
        H1 = (H1 + b) | 0;
        H2 = (H2 + c) | 0;
        H3 = (H3 + d) | 0;
        H4 = (H4 + e) | 0;
        H5 = (H5 + f) | 0;
        H6 = (H6 + g) | 0;
        H7 = (H7 + h) | 0;
    }

    const out = new Uint8Array(32);
    const state = [H0, H1, H2, H3, H4, H5, H6, H7];
    for (let i = 0; i < 8; i++) {
        out[i * 4] = (state[i] >>> 24) & 0xff;
        out[i * 4 + 1] = (state[i] >>> 16) & 0xff;
        out[i * 4 + 2] = (state[i] >>> 8) & 0xff;
        out[i * 4 + 3] = state[i] & 0xff;
    }
    return out;
}

/**
 * Computes HMAC-SHA256 in hex using Pure JS.
 * @param {string} keyStr - Secret key string.
 * @param {string} messageStr - Message string to sign.
 * @returns {Promise<string>} Hex signature.
 */
export async function computeHmacSha256(keyStr, messageStr) {
    const encoder = new TextEncoder();
    let keyBytes = encoder.encode(keyStr);
    const msgBytes = encoder.encode(messageStr);

    if (keyBytes.length > 64) {
        keyBytes = sha256Bytes(keyBytes);
    }
    const kPadded = new Uint8Array(64);
    kPadded.set(keyBytes);

    const ipad = new Uint8Array(64);
    const opad = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
        ipad[i] = kPadded[i] ^ 0x36;
        opad[i] = kPadded[i] ^ 0x5c;
    }

    const inner = new Uint8Array(64 + msgBytes.length);
    inner.set(ipad);
    inner.set(msgBytes, 64);
    const innerHash = sha256Bytes(inner);

    const outer = new Uint8Array(64 + 32);
    outer.set(opad);
    outer.set(innerHash, 64);
    const outerHash = sha256Bytes(outer);

    return Array.from(outerHash)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generates a random 6-digit PIN code string (e.g. "582914").
 * @returns {string} 6-digit PIN.
 */
export function generate6DigitPin() {
    let pin = '';
    for (let i = 0; i < 6; i++) {
        pin += Math.floor(Math.random() * 10).toString();
    }
    return pin;
}

/**
 * Generates a random 32-byte secret key as a hex string (64 characters) - kept for compatibility.
 * @returns {string} Hex string of 32 random bytes.
 */
export function generateSecretKey() {
    return generate6DigitPin();
}

/**
 * Encrypts data using Pure JS XOR algorithm with 6-digit PIN / key.
 * Adds `createdAt: Date.now()` timestamp to payload object before encryption.
 * @param {any} data - Object to encrypt.
 * @param {string} pinOrKey - 6-digit PIN or secret key string.
 * @returns {Promise<{data: string}>} Object containing Base64 encoded encrypted data string.
 */
export async function encryptPayload(data, pinOrKey) {
    const payload = {
        createdAt: Date.now(),
        settings: data,
    };
    const jsonStr = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(jsonStr);
    const keyBytes = encoder.encode(String(pinOrKey));

    const encryptedBytes = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
        encryptedBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 13) & 0xff);
    }

    let binaryStr = '';
    for (let i = 0; i < encryptedBytes.length; i++) {
        binaryStr += String.fromCharCode(encryptedBytes[i]);
    }
    const dataBase64 = btoa(binaryStr);

    return {
        data: dataBase64,
    };
}

/**
 * Decrypts data using Pure JS XOR algorithm.
 * @param {{data: string}} encryptedObj - Object containing Base64 encoded data string.
 * @param {string} pinOrKey - 6-digit PIN or secret key string.
 * @returns {Promise<{createdAt: number, settings: any}>} Decrypted payload object with timestamp and settings.
 */
export async function decryptPayload(encryptedObj, pinOrKey) {
    if (!encryptedObj || !encryptedObj.data) {
        throw new Error('Invalid encrypted payload structure');
    }

    const binaryStr = atob(encryptedObj.data);
    const encryptedBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        encryptedBytes[i] = binaryStr.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(String(pinOrKey));
    const decryptedBytes = new Uint8Array(encryptedBytes.length);

    for (let i = 0; i < encryptedBytes.length; i++) {
        decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 13) & 0xff);
    }

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBytes);
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
                    isResolved = true;
                    clearTimeout(timeoutId);
                    if (typeof onStatusChange === 'function') {
                        onStatusChange('データ受信完了・復号中...');
                    }
                    const eventData = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
                    const encryptedPayload = eventData.payload;
                    const decryptedPayload = await decryptPayload(encryptedPayload, pinOrKey);
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
