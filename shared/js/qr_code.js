/**
 * QuickLog-Solo QR Code Encoder, Decoder & Payload Shortener Library
 * Pure Vanilla JS - zero external OSS dependencies.
 */

// Standard built-in animation IDs
const STANDARD_ANIMATIONS = new Set([
    'aura_charge',
    'car_drive',
    'cats',
    'clock',
    'coffee_drip',
    'contour_lines',
    'crab_alien',
    'digital_rain',
    'dot_typing',
    'dune_formation',
    'elastic_alert',
    'forest_fire',
    'heart_beat',
    'hero_pot',
    'hexagonal_hud',
    'left_to_right',
    'liesegang_rings',
    'm3_symbols_with_kb',
    'magic_ribbons',
    'migrating_birds',
    'newtons_cradle',
    'night_sky',
    'open_reel',
    'physarum_mold',
    'plasma_discharge',
    'red_cap_jumper',
    'repelling_digital_rain',
    'right_to_left',
    'ripple',
    'rising_menacing',
    'rotational_bbq',
    'rpg_grid',
    'sand_clock',
    'smoke',
    'snoring_zzz',
    'spectrum',
    'spotlight_evasion',
    'suminagashi',
    'target_reticle',
    'test_pattern',
    'tetris_building',
    'trophy_celebration',
    'wind_tunnel',
    'yellow_pizza',
]);

/**
 * Ensures an animation ID is standard; falls back to 'digital_rain' for custom/unknown animations.
 */
function sanitizeAnimationId(animId) {
    if (!animId || typeof animId !== 'string') return 'digital_rain';
    if (animId === 'none' || animId === 'default') return animId;
    if (animId.startsWith('custom_') || animId.startsWith('qlanim_')) return 'digital_rain';
    if (STANDARD_ANIMATIONS.has(animId)) return animId;
    return 'digital_rain';
}

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

/**
 * Serializes application settings, categories, and alarms into a shortened JSON payload string.
 * Omits custom animation metadata, Session Sync IDs/state, and Backup handles.
 * Converts custom category animations to default background animation.
 */
export function serializeSettingsPayload({ settings = {}, categories = [], alarms = [] }) {
    const minSettings = {};

    if (settings.theme) minSettings.t = settings.theme;
    if (settings.font) minSettings.f = settings.font;
    if (settings.fontWeight) minSettings.fw = settings.fontWeight;
    if (settings.animation) minSettings.a = sanitizeAnimationId(settings.animation);
    if (settings.pauseAnimation) minSettings.pa = sanitizeAnimationId(settings.pauseAnimation);
    if (settings.pauseTheme) minSettings.pt = settings.pauseTheme;
    if (settings.timerHeight) minSettings.th = settings.timerHeight;
    if (settings.categoryLayout) minSettings.cl = settings.categoryLayout;
    if (Array.isArray(settings.businessDays)) minSettings.bd = settings.businessDays;
    if (settings.language) minSettings.l = settings.language;
    if (settings.reportSettings) minSettings.r = settings.reportSettings;

    // Filter out internal system categories (IDLE) and page breaks (__PAGE_BREAK__)
    const validCategories = (categories || []).filter(
        (cat) => cat && cat.name !== 'IDLE' && !(cat.name || '').startsWith('__PAGE_BREAK__')
    );

    const minCategories = validCategories.map((cat, idx) => {
        const item = { i: cat.id, n: cat.name };
        if (cat.color && cat.color !== 'primary') item.c = cat.color;
        const cAnim = sanitizeAnimationId(cat.animation);
        if (cAnim && cAnim !== 'digital_rain') item.a = cAnim;
        if (cat.tags) item.tg = cat.tags;
        const order = cat.order ?? idx;
        if (order !== idx) item.o = order;
        return item;
    });

    const minAlarms = (alarms || []).map((alm, idx) => {
        const item = { i: alm.id };
        if (alm.name) item.n = alm.name;
        if (alm.type && alm.type !== 'time') item.t = alm.type;
        if (alm.time) item.ti = alm.time;
        if (alm.actionCategory) item.ac = alm.actionCategory;
        if (alm.action && alm.action !== 'start') item.a = alm.action;
        if (Array.isArray(alm.daysOfWeek) && alm.daysOfWeek.length > 0) item.w = alm.daysOfWeek;
        if (alm.message) item.m = alm.message;
        if (alm.enabled === false) item.e = 0;
        if (alm.holidayAdjustment && alm.holidayAdjustment !== 'none') item.ha = alm.holidayAdjustment;
        if (alm.dayOfMonth && alm.dayOfMonth !== 1) item.dm = alm.dayOfMonth;
        if (alm.daysBeforeEnd) item.dbe = alm.daysBeforeEnd;
        if (alm.requireConfirmation) item.rc = 1;
        const order = alm.order ?? idx;
        if (order !== idx) item.o = order;
        return item;
    });

    const payload = { v: 1 };
    if (Object.keys(minSettings).length > 0) payload.s = minSettings;
    if (minCategories.length > 0) payload.c = minCategories;
    if (minAlarms.length > 0) payload.a = minAlarms;

    return JSON.stringify(payload);
}

/** Validates compact records before any imported data can reach storage. */
function validatePayloadRecords(records, kind) {
    if (!Array.isArray(records)) throw new Error(`Invalid ${kind} records`);
    const ids = new Set();
    const stringFields = kind === 'category' ? ['n', 'c', 'a', 'tg'] : ['n', 't', 'ti', 'ac', 'a', 'm', 'ha'];
    const numberFields = kind === 'category' ? ['o'] : ['o', 'dm', 'dbe'];
    for (const record of records) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            throw new Error(`Invalid ${kind} record`);
        }
        const id = record.i;
        if (
            !((typeof id === 'string' && id.trim() !== '') || (typeof id === 'number' && Number.isFinite(id))) ||
            ids.has(id)
        ) {
            throw new Error(`Invalid or duplicate ${kind} ID`);
        }
        ids.add(id);
        if (kind === 'category' && typeof record.n !== 'string') {
            throw new Error('Invalid category name');
        }
        if (
            stringFields.some((key) => record[key] !== undefined && typeof record[key] !== 'string') ||
            numberFields.some((key) => record[key] !== undefined && !Number.isFinite(record[key]))
        ) {
            throw new Error(`Invalid ${kind} field`);
        }
        if (kind === 'alarm') {
            if (record.e !== undefined && ![0, 1, false, true].includes(record.e)) {
                throw new Error('Invalid alarm enabled flag');
            }
            if (
                record.w !== undefined &&
                (!Array.isArray(record.w) || record.w.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
            ) {
                throw new Error('Invalid alarm weekdays');
            }
        }
    }
}

/**
 * Deserializes shortened JSON payload back into standard app settings, categories, and alarms objects.
 */
export function deserializeSettingsPayload(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        throw new Error('Invalid QR payload format');
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    } catch {
        throw new Error('JSON parse failed');
    }

    if (!parsed || parsed.v !== 1) {
        throw new Error('Unsupported or invalid payload version');
    }

    const categoryRecords = parsed.c === undefined ? [] : parsed.c;
    const alarmRecords = parsed.a === undefined ? [] : parsed.a;
    validatePayloadRecords(categoryRecords, 'category');
    validatePayloadRecords(alarmRecords, 'alarm');

    const minSettings = parsed.s || {};
    const settings = {};
    if (minSettings.t !== undefined) settings.theme = minSettings.t;
    if (minSettings.f !== undefined) settings.font = minSettings.f;
    if (minSettings.fw !== undefined) settings.fontWeight = minSettings.fw;
    if (minSettings.a !== undefined) settings.animation = sanitizeAnimationId(minSettings.a);
    if (minSettings.pa !== undefined) settings.pauseAnimation = sanitizeAnimationId(minSettings.pa);
    if (minSettings.pt !== undefined) settings.pauseTheme = minSettings.pt;
    if (minSettings.th !== undefined) settings.timerHeight = minSettings.th;
    if (minSettings.cl !== undefined) settings.categoryLayout = minSettings.cl;
    if (minSettings.bd !== undefined) {
        settings.businessDays = Array.isArray(minSettings.bd) ? minSettings.bd : [1, 2, 3, 4, 5];
    }
    if (minSettings.l !== undefined) settings.language = minSettings.l;
    if (minSettings.r !== undefined) settings.reportSettings = minSettings.r;

    const categories = categoryRecords.map((c, index) => ({
        id: c.i,
        name: c.n,
        color: c.c ?? 'primary',
        animation: sanitizeAnimationId(c.a),
        tags: c.tg || '',
        order: c.o ?? index,
    }));

    const alarms = alarmRecords.map((a, index) => ({
        id: a.i,
        name: a.n ?? '',
        type: a.t ?? 'time',
        time: a.ti,
        actionCategory: a.ac || '',
        action: a.a ?? 'start',
        daysOfWeek: Array.isArray(a.w) ? a.w : [],
        message: a.m || '',
        enabled: a.e !== 0 && a.e !== false,
        holidayAdjustment: a.ha || 'none',
        dayOfMonth: a.dm || 1,
        daysBeforeEnd: a.dbe || 0,
        requireConfirmation: a.rc === 1 || a.rc === true,
        order: a.o ?? index,
    }));

    return { settings, categories, alarms };
}

// --- 2. Pure Vanilla JS QR Code Encoder ---

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
// Format: [version, totalDataBytes, ecCodewordsPerBlock, numBlocks]
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

    // Find smallest version that fits dataLen including mode (4 bits) and character count indicators
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

    // Build Bit Stream (Mode Byte: 0100 + Count + Data + Terminator + Pad)
    const bitBuf = [];
    const pushBits = (val, count) => {
        for (let i = count - 1; i >= 0; i--) {
            bitBuf.push((val >> i) & 1);
        }
    };

    // Mode: Byte (0100)
    pushBits(0b0100, 4);
    // Character count indicator length (8 bits for v1-9, 16 bits for v10+)
    const countBits = version < 10 ? 8 : 16;
    pushBits(dataLen, countBits);

    // Data bytes
    for (let i = 0; i < dataLen; i++) {
        pushBits(utf8Bytes[i], 8);
    }

    // Terminator (up to 4 zero bits)
    const totalDataBits = maxDataBytes * 8;
    const termLen = Math.min(4, totalDataBits - bitBuf.length);
    for (let i = 0; i < termLen; i++) bitBuf.push(0);

    // Pad to byte boundary
    while (bitBuf.length % 8 !== 0) bitBuf.push(0);

    // Pad bytes (0xEC, 0x11 alternating)
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (bitBuf.length < totalDataBits) {
        pushBits(padBytes[padIdx], 8);
        padIdx = (padIdx + 1) % 2;
    }

    // Convert bit stream to data bytes
    const dataBytes = new Uint8Array(maxDataBytes);
    for (let i = 0; i < maxDataBytes; i++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
            b = (b << 1) | bitBuf[i * 8 + bit];
        }
        dataBytes[i] = b;
    }

    // Split into blocks and compute Reed-Solomon EC
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

    // Interleave data bytes and EC bytes
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

    // Create Matrix
    const size = 17 + version * 4;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
    const isReserved = Array.from({ length: size }, () => new Array(size).fill(false));

    const setModule = (r, c, val, reserved = true) => {
        matrix[r][c] = val;
        if (reserved) isReserved[r][c] = true;
    };

    // 1. Finder Patterns (7x7)
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
                    setModule(rPos, cPos, false); // Separator
                }
            }
        }
    };

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // 2. Alignment Patterns
    const locs = ALIGNMENT_LOCATIONS[version] || [];
    for (let i = 0; i < locs.length; i++) {
        for (let j = 0; j < locs.length; j++) {
            const r0 = locs[i];
            const c0 = locs[j];
            // Skip overlaps with finder patterns
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

    // 3. Timing Patterns
    for (let i = 8; i < size - 8; i++) {
        if (!isReserved[6][i]) setModule(6, i, i % 2 === 0);
        if (!isReserved[i][6]) setModule(i, 6, i % 2 === 0);
    }

    // 4. Dark Module
    setModule(size - 8, 8, true);

    // Reserve Format Info Areas
    for (let i = 0; i < 9; i++) {
        if (!isReserved[8][i]) isReserved[8][i] = true;
        if (!isReserved[i][8]) isReserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
        if (!isReserved[8][size - 1 - i]) isReserved[8][size - 1 - i] = true;
        if (!isReserved[size - 1 - i][8]) isReserved[size - 1 - i][8] = true;
    }

    // Place Version Information (Version >= 7)
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
            // Bottom-left (3 rows x 6 cols)
            setModule(size - 11 + (i % 3), Math.floor(i / 3), bit, true);
            // Top-right (6 rows x 3 cols)
            setModule(Math.floor(i / 3), size - 11 + (i % 3), bit, true);
        }
    }

    // Place Data Bits
    const allBits = [];
    for (let i = 0; i < interleaved.length; i++) {
        for (let b = 7; b >= 0; b--) {
            allBits.push((interleaved[i] >> b) & 1);
        }
    }

    let bitIdx = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--; // Skip vertical timing pattern
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

    // Mask Pattern (Fixed Mask 0 for deterministic output)
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

    // Apply Format Information (Level L, Mask 0)
    const formatBits = FORMAT_INFO_L[mask];
    const getBit = (n) => ((formatBits >> n) & 1) === 1;

    // Top-left
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

    // Bottom-left / Top-right
    for (let i = 0; i < 8; i++) {
        setModule(8, size - 1 - i, getBit(i));
    }
    for (let i = 8; i <= 14; i++) {
        setModule(size - 15 + i, 8, getBit(i));
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
    const margin = options.margin ?? 2;
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
                const w = Math.ceil(scale);
                const h = Math.ceil(scale);
                ctx.fillRect(x, y, w, h);
            }
        }
    }
}

// --- 3. Pure Vanilla JS QR Code Decoder ---

/**
 * Checks if QR code scanning via native BarcodeDetector API is supported in the current environment.
 */
export function isQRCodeScanSupported() {
    return typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis;
}

/**
 * Decodes QR Code from Canvas or ImageData.
 * Uses native BarcodeDetector API when available.
 */
export async function decodeQRCodeFromCanvas(canvasOrImageData) {
    if (!canvasOrImageData) return null;

    if (isQRCodeScanSupported()) {
        try {
            const detector = new globalThis.BarcodeDetector({ formats: ['qr_code'] });
            let results = [];
            if (
                canvasOrImageData instanceof HTMLCanvasElement ||
                (typeof ImageBitmap !== 'undefined' && canvasOrImageData instanceof ImageBitmap)
            ) {
                results = await detector.detect(canvasOrImageData);
            } else if (typeof ImageData !== 'undefined' && canvasOrImageData instanceof ImageData) {
                const tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = canvasOrImageData.width;
                tmpCanvas.height = canvasOrImageData.height;
                const tmpCtx = tmpCanvas.getContext('2d');
                if (tmpCtx) {
                    tmpCtx.putImageData(canvasOrImageData, 0, 0);
                    results = await detector.detect(tmpCanvas);
                }
            }
            if (results && results.length > 0) {
                return results[0].rawValue;
            }
        } catch (err) {
            console.warn('Native BarcodeDetector failed:', err);
        }
    }

    return scanImageDataPureJS(canvasOrImageData);
}

/**
 * Fallback scanner when native BarcodeDetector is unavailable.
 * Returns null as pure JS QR decoding is disabled when BarcodeDetector is unsupported.
 */
function scanImageDataPureJS() {
    return null;
}
