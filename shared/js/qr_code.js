/**
 * QuickLog-Solo QR Code Encoder
 * Pure Vanilla JS - zero external OSS dependencies.
 * Used exclusively for rendering the PWA launch URL QR code.
 */

/**
 * Utility to encode string to UTF-8 Uint8Array with environment fallbacks.
 */
function encodeUTF8(str) {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(str);
    }
    if (typeof globalThis !== 'undefined' && globalThis.TextEncoder) {
        return new globalThis.TextEncoder().encode(str);
    }
    const utf8 = [];
    for (let i = 0; i < str.length; i++) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        } else {
            i++;
            charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
            utf8.push(
                0xf0 | (charcode >> 18),
                0x80 | ((charcode >> 12) & 0x3f),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f)
            );
        }
    }
    return new Uint8Array(utf8);
}

// Galois Field GF(2^8) math tables
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        GF_EXP[i] = x;
        GF_LOG[x] = i;
        x <<= 1;
        if (x & 0x100) {
            x ^= 0x11d; // Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
        }
    }
    for (let i = 255; i < 512; i++) {
        GF_EXP[i] = GF_EXP[i - 255];
    }
})();

function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

// Reed-Solomon generator polynomial
function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
        const next = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
            next[j] ^= poly[j];
            next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
        }
        poly = next;
    }
    return poly;
}

// Compute RS error correction codewords
function rsComputeRemainder(data, ecCount) {
    const gen = rsGeneratorPoly(ecCount);
    const res = new Array(ecCount).fill(0);
    for (let i = 0; i < data.length; i++) {
        const factor = data[i] ^ res[0];
        res.shift();
        res.push(0);
        if (factor !== 0) {
            for (let j = 0; j < ecCount; j++) {
                res[j] ^= gfMul(gen[j + 1], factor);
            }
        }
    }
    return res;
}

// QR Code Specifications per Version (Error Correction Level L)
const VERSION_SPECS_L = [
    null,
    [1, 19, 7, 1],
    [2, 34, 10, 1],
    [3, 55, 15, 1],
    [4, 80, 20, 1],
    [5, 108, 26, 1],
    [6, 136, 18, 2],
    [7, 156, 20, 2],
    [8, 194, 24, 2],
    [9, 232, 30, 2],
    [10, 274, 18, 4],
    [11, 324, 20, 4],
    [12, 370, 24, 4],
    [13, 428, 26, 4],
    [14, 461, 30, 4],
    [15, 523, 22, 6],
    [16, 589, 24, 6],
    [17, 647, 28, 6],
    [18, 721, 30, 6],
    [19, 795, 28, 7],
    [20, 861, 28, 8],
    [21, 932, 28, 8],
    [22, 1006, 28, 9],
    [23, 1094, 30, 9],
    [24, 1174, 30, 10],
    [25, 1276, 26, 12],
    [26, 1370, 28, 12],
    [27, 1468, 30, 12],
    [28, 1531, 30, 13],
    [29, 1631, 30, 14],
    [30, 1735, 30, 15],
    [31, 1843, 30, 16],
    [32, 1955, 30, 17],
    [33, 2071, 30, 18],
    [34, 2191, 30, 19],
    [35, 2306, 30, 19],
    [36, 2434, 30, 20],
    [37, 2566, 30, 21],
    [38, 2702, 30, 22],
    [39, 2812, 30, 24],
    [40, 2956, 30, 25],
];

// Alignment pattern center locations by version
const ALIGNMENT_LOCATIONS = [
    [],
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170],
];

// Format info bit strings for EC Level L (01), masks 0 to 7
const FORMAT_INFO_L = [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6956];

/**
 * Creates QR Code Matrix (boolean 2D array) for given string.
 */
export function generateQRCodeMatrix(text) {
    const utf8Bytes = encodeUTF8(text);
    const dataLen = utf8Bytes.length;

    let version = 1;
    while (version <= 40) {
        const countBits = version < 10 ? 8 : 16;
        const totalBits = 4 + countBits + dataLen * 8;
        if (totalBits <= VERSION_SPECS_L[version][1] * 8) {
            break;
        }
        version++;
    }
    if (version > 40) {
        throw new Error('Payload too large for QR Code');
    }

    const [, maxDataBytes, ecCount, numBlocks] = VERSION_SPECS_L[version];

    const bitBuf = [];
    const pushBits = (val, count) => {
        for (let i = count - 1; i >= 0; i--) {
            bitBuf.push((val >> i) & 1);
        }
    };

    pushBits(0b0100, 4);
    const countBits = version < 10 ? 8 : 16;
    pushBits(dataLen, countBits);

    for (let i = 0; i < dataLen; i++) {
        pushBits(utf8Bytes[i], 8);
    }

    const totalDataBits = maxDataBytes * 8;
    const termLen = Math.min(4, totalDataBits - bitBuf.length);
    for (let i = 0; i < termLen; i++) bitBuf.push(0);

    while (bitBuf.length % 8 !== 0) bitBuf.push(0);

    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (bitBuf.length < totalDataBits) {
        pushBits(padBytes[padIdx], 8);
        padIdx = (padIdx + 1) % 2;
    }

    const dataBytes = new Uint8Array(maxDataBytes);
    for (let i = 0; i < maxDataBytes; i++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
            b = (b << 1) | bitBuf[i * 8 + bit];
        }
        dataBytes[i] = b;
    }

    const blockSize = Math.floor(maxDataBytes / numBlocks);
    const shortBlocksCount = numBlocks - (maxDataBytes % numBlocks);
    const blocks = [];
    const ecBlocks = [];

    let offset = 0;
    for (let b = 0; b < numBlocks; b++) {
        const len = b < shortBlocksCount ? blockSize : blockSize + 1;
        const blockData = dataBytes.subarray(offset, offset + len);
        offset += len;
        blocks.push(blockData);
        ecBlocks.push(rsComputeRemainder(blockData, ecCount));
    }

    const interleaved = [];
    const maxBlockLen = blockSize + (maxDataBytes % numBlocks > 0 ? 1 : 0);
    for (let i = 0; i < maxBlockLen; i++) {
        for (let b = 0; b < numBlocks; b++) {
            if (i < blocks[b].length) interleaved.push(blocks[b][i]);
        }
    }
    for (let i = 0; i < ecCount; i++) {
        for (let b = 0; b < numBlocks; b++) {
            interleaved.push(ecBlocks[b][i]);
        }
    }

    const size = 17 + version * 4;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
    const isReserved = Array.from({ length: size }, () => new Array(size).fill(false));

    const setModule = (r, c, val, reserved = true) => {
        matrix[r][c] = val;
        if (reserved) isReserved[r][c] = true;
    };

    const placeFinder = (r0, c0) => {
        for (let r = -1; r <= 7; r++) {
            for (let c = -1; c <= 7; c++) {
                const rPos = r0 + r;
                const cPos = c0 + c;
                if (rPos < 0 || rPos >= size || cPos < 0 || cPos >= size) continue;
                if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
                    const isDark = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                    setModule(rPos, cPos, isDark);
                } else {
                    setModule(rPos, cPos, false);
                }
            }
        }
    };

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    const locs = ALIGNMENT_LOCATIONS[version] || [];
    for (let i = 0; i < locs.length; i++) {
        for (let j = 0; j < locs.length; j++) {
            const r0 = locs[i];
            const c0 = locs[j];
            if ((i === 0 && j === 0) || (i === 0 && j === locs.length - 1) || (i === locs.length - 1 && j === 0))
                continue;
            for (let r = -2; r <= 2; r++) {
                for (let c = -2; c <= 2; c++) {
                    const isDark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
                    setModule(r0 + r, c0 + c, isDark);
                }
            }
        }
    }

    for (let i = 8; i < size - 8; i++) {
        if (!isReserved[6][i]) setModule(6, i, i % 2 === 0);
        if (!isReserved[i][6]) setModule(i, 6, i % 2 === 0);
    }

    setModule(size - 8, 8, true);

    for (let i = 0; i < 9; i++) {
        if (!isReserved[8][i]) isReserved[8][i] = true;
        if (!isReserved[i][8]) isReserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
        if (!isReserved[8][size - 1 - i]) isReserved[8][size - 1 - i] = true;
        if (!isReserved[size - 1 - i][8]) isReserved[size - 1 - i][8] = true;
    }

    if (version >= 7) {
        let rem = version << 12;
        for (let i = 17; i >= 12; i--) {
            if ((rem >> i) & 1) {
                rem ^= 0x1f25 << (i - 12);
            }
        }
        const versionInfo = (version << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const bit = ((versionInfo >> i) & 1) === 1;
            setModule(size - 11 + (i % 3), Math.floor(i / 3), bit, true);
            setModule(Math.floor(i / 3), size - 11 + (i % 3), bit, true);
        }
    }

    const allBits = [];
    for (let i = 0; i < interleaved.length; i++) {
        for (let b = 7; b >= 0; b--) {
            allBits.push((interleaved[i] >> b) & 1);
        }
    }

    let bitIdx = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (let rowStep = 0; rowStep < size; rowStep++) {
            const r = upward ? size - 1 - rowStep : rowStep;
            for (let cStep = 0; cStep < 2; cStep++) {
                const c = col - cStep;
                if (!isReserved[r][c]) {
                    const val = bitIdx < allBits.length ? allBits[bitIdx++] === 1 : false;
                    setModule(r, c, val, false);
                }
            }
        }
        upward = !upward;
    }

    const mask = 0;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (!isReserved[r][c]) {
                const maskCondition = (r + c) % 2 === 0;
                if (maskCondition) {
                    matrix[r][c] = !matrix[r][c];
                }
            }
        }
    }

    const formatBits = FORMAT_INFO_L[mask];
    const getBit = (n) => ((formatBits >> n) & 1) === 1;

    setModule(8, 0, getBit(14));
    setModule(8, 1, getBit(13));
    setModule(8, 2, getBit(12));
    setModule(8, 3, getBit(11));
    setModule(8, 4, getBit(10));
    setModule(8, 5, getBit(9));
    setModule(8, 7, getBit(8));
    setModule(8, 8, getBit(7));
    setModule(7, 8, getBit(6));
    setModule(5, 8, getBit(5));
    setModule(4, 8, getBit(4));
    setModule(3, 8, getBit(3));
    setModule(2, 8, getBit(2));
    setModule(1, 8, getBit(1));
    setModule(0, 8, getBit(0));

    for (let i = 0; i < 8; i++) {
        setModule(8, size - 1 - i, getBit(i));
    }
    for (let i = 8; i <= 14; i++) {
        setModule(size - 1 - (i - 8), 8, getBit(i));
    }

    return matrix;
}

/**
 * Renders QR Code string onto an HTML Canvas element.
 */
export function renderQRCodeToCanvas(text, canvas, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    const matrix = generateQRCodeMatrix(text);
    const size = matrix.length;
    const margin = options.margin ?? 4;
    const totalModules = size + margin * 2;

    const targetWidth = options.width || canvas.width || 200;
    canvas.width = targetWidth;
    canvas.height = targetWidth;

    if (!ctx) return;

    const scale = targetWidth / totalModules;

    ctx.fillStyle = options.bgColor || '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetWidth);

    ctx.fillStyle = options.fgColor || '#000000';
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (matrix[r][c]) {
                const x = Math.round((c + margin) * scale);
                const y = Math.round((r + margin) * scale);
                const x2 = Math.round((c + margin + 1) * scale);
                const y2 = Math.round((r + margin + 1) * scale);
                ctx.fillRect(x, y, x2 - x, y2 - y);
            }
        }
    }
}
