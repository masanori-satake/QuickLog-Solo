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
 * Preserves empty category/alarm groups; omitted groups leave destination stores unchanged.
 */
export function serializeSettingsPayload({ settings = {}, categories, alarms }) {
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
    if (categories !== undefined) payload.c = minCategories;
    if (alarms !== undefined) payload.a = minAlarms;

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

    return {
        settings,
        categories: parsed.c === undefined ? undefined : categories,
        alarms: parsed.a === undefined ? undefined : alarms,
    };
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
 * Reed-Solomon Error Correction Decoder for GF(2^8) blocks.
 */
function rsDecodeBlock(data, ec) {
    const n = data.length + ec.length;
    const ecCount = ec.length;
    const c = new Uint8Array(n);
    c.set(data, 0);
    c.set(ec, data.length);

    const syndromes = new Uint8Array(ecCount);
    let hasError = false;
    for (let i = 0; i < ecCount; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) {
            s = s ^ gfMul(c[j], GF_EXP[(i * (n - 1 - j)) % 255]);
        }
        syndromes[i] = s;
        if (s !== 0) hasError = true;
    }

    if (!hasError) return data;

    let C = [1];
    let B = [1];
    let L = 0;
    let m = 1;
    let b = 1;

    for (let r = 0; r < ecCount; r++) {
        let d = syndromes[r];
        for (let i = 1; i <= L; i++) {
            d ^= gfMul(C[i], syndromes[r - i]);
        }
        if (d === 0) {
            m++;
        } else {
            const T = new Array(Math.max(C.length, B.length + m)).fill(0);
            for (let i = 0; i < C.length; i++) T[i] ^= C[i];
            const scale = gfMul(d, GF_EXP[255 - GF_LOG[b]]);
            for (let i = 0; i < B.length; i++) T[i + m] ^= gfMul(scale, B[i]);

            if (2 * L <= r) {
                L = r + 1 - L;
                B = C;
                b = d;
                m = 1;
            } else {
                m++;
            }
            C = T;
        }
    }

    const errPos = [];
    for (let j = 0; j < n; j++) {
        let val = 1;
        const alphaInv = GF_EXP[(255 - ((n - 1 - j) % 255)) % 255];
        let alphaInvPow = 1;
        for (let i = 1; i < C.length; i++) {
            alphaInvPow = gfMul(alphaInvPow, alphaInv);
            val ^= gfMul(C[i], alphaInvPow);
        }
        if (val === 0) {
            errPos.push(j);
        }
    }

    if (errPos.length !== L) {
        return null;
    }

    const Omega = new Array(ecCount).fill(0);
    for (let i = 0; i < ecCount; i++) {
        for (let j = 0; j <= i && j < C.length; j++) {
            Omega[i] ^= gfMul(syndromes[i - j], C[j]);
        }
    }

    for (const pos of errPos) {
        const Xi = GF_EXP[(n - 1 - pos) % 255];
        const XiInv = GF_EXP[255 - GF_LOG[Xi]];

        let num = 0;
        let p = 1;
        for (let i = 0; i < ecCount; i++) {
            num ^= gfMul(Omega[i], p);
            p = gfMul(p, XiInv);
        }

        let den = 0;
        let p2 = 1;
        for (let i = 1; i < C.length; i += 2) {
            den ^= gfMul(C[i], p2);
            p2 = gfMul(p2, gfMul(XiInv, XiInv));
        }

        if (den === 0) return null;
        const errVal = gfMul(num, GF_EXP[255 - GF_LOG[den]]);
        c[pos] ^= errVal;
    }

    return c.subarray(0, data.length);
}

function crossCheckVertical(startX, startY, maxCount, isDark, height, checkRatio) {
    let topY = startY;
    while (topY >= 0 && isDark(startX, topY)) topY--;
    topY++;

    let bottomY = startY;
    while (bottomY < height && isDark(startX, bottomY)) bottomY++;
    bottomY--;

    const centerLength = bottomY - topY + 1;
    if (centerLength === 0) return null;

    let y = topY - 1;
    let count1 = 0;
    while (y >= 0 && !isDark(startX, y) && count1 < maxCount) { count1++; y--; }
    let count0 = 0;
    while (y >= 0 && isDark(startX, y) && count0 < maxCount) { count0++; y--; }

    y = bottomY + 1;
    let count3 = 0;
    while (y < height && !isDark(startX, y) && count3 < maxCount) { count3++; y++; }
    let count4 = 0;
    while (y < height && isDark(startX, y) && count4 < maxCount) { count4++; y++; }

    const counts = [count0, count1, centerLength, count3, count4];
    if (checkRatio(counts)) {
        return (topY + bottomY) / 2;
    }
    return null;
}

function crossCheckHorizontal(startX, startY, maxCount, isDark, width, checkRatio) {
    let leftX = startX;
    while (leftX >= 0 && isDark(leftX, startY)) leftX--;
    leftX++;

    let rightX = startX;
    while (rightX < width && isDark(rightX, startY)) rightX++;
    rightX--;

    const centerLength = rightX - leftX + 1;
    if (centerLength === 0) return null;

    let x = leftX - 1;
    let count1 = 0;
    while (x >= 0 && !isDark(x, startY) && count1 < maxCount) { count1++; x--; }
    let count0 = 0;
    while (x >= 0 && isDark(x, startY) && count0 < maxCount) { count0++; x--; }

    x = rightX + 1;
    let count3 = 0;
    while (x < width && !isDark(x, startY) && count3 < maxCount) { count3++; x++; }
    let count4 = 0;
    while (x < width && isDark(x, startY) && count4 < maxCount) { count4++; x++; }

    const counts = [count0, count1, centerLength, count3, count4];
    if (checkRatio(counts)) {
        return (leftX + rightX) / 2;
    }
    return null;
}

function addCandidate(candidates, x, y, ms) {
    for (const c of candidates) {
        if (Math.hypot(c.x - x, c.y - y) < ms * 2) {
            c.x = (c.x + x) / 2;
            c.y = (c.y + y) / 2;
            c.ms = (c.ms + ms) / 2;
            return;
        }
    }
    candidates.push({ x, y, ms });
}

function findBestTriangle(candidates) {
    if (candidates.length < 3) return null;
    let bestScore = Infinity;
    let bestTriple = null;

    for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
            for (let k = j + 1; k < candidates.length; k++) {
                const p0 = candidates[i], p1 = candidates[j], p2 = candidates[k];
                const d01 = Math.hypot(p0.x - p1.x, p0.y - p1.y);
                const d12 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                const d20 = Math.hypot(p2.x - p0.x, p2.y - p0.y);

                let tl, tr, bl, d1, d2;
                if (d01 >= d12 && d01 >= d20) {
                    tl = p2; tr = p0; bl = p1; d1 = d20; d2 = d12;
                } else if (d12 >= d01 && d12 >= d20) {
                    tl = p0; tr = p1; bl = p2; d1 = d01; d2 = d20;
                } else {
                    tl = p1; tr = p2; bl = p0; d1 = d12; d2 = d01;
                }

                const cross = (tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x);
                if (cross === 0) continue;

                if (cross < 0) {
                    const tmp = tr; tr = bl; bl = tmp;
                }

                const sideDiff = Math.abs(d1 - d2) / Math.max(d1, d2);
                if (sideDiff > 0.4) continue;

                const score = sideDiff;
                if (score < bestScore) {
                    bestScore = score;
                    bestTriple = { tl, tr, bl };
                }
            }
        }
    }
    return bestTriple;
}

/**
 * Fallback scanner when native BarcodeDetector is unavailable.
 */
function scanImageDataPureJS(canvasOrImageData) {
    if (!canvasOrImageData) return null;
    let imageData = null;
    if (typeof HTMLCanvasElement !== 'undefined' && canvasOrImageData instanceof HTMLCanvasElement) {
        const ctx = canvasOrImageData.getContext('2d');
        if (!ctx) return null;
        try {
            imageData = ctx.getImageData(0, 0, canvasOrImageData.width, canvasOrImageData.height);
        } catch {
            return null;
        }
    } else if (canvasOrImageData && typeof canvasOrImageData.width === 'number' && canvasOrImageData.data) {
        imageData = canvasOrImageData;
    }
    if (!imageData || !imageData.width || !imageData.height) return null;

    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const gray = new Uint8Array(width * height);
    const hist = new Int32Array(256);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const g = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
        gray[j] = g;
        hist[g]++;
    }

    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
    const totalPixels = width * height;
    for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = totalPixels - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const varBetween = wB * wF * (mB - mF) * (mB - mF);
        if (varBetween > maxVar) {
            maxVar = varBetween;
            threshold = t;
        }
    }

    const isDark = (x, y) => {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        return gray[y * width + x] < threshold;
    };

    const checkRatio = (counts) => {
        const total = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
        if (total < 7) return false;
        const moduleSize = total / 7;
        const maxVariance = moduleSize * 0.75;
        return (
            Math.abs(moduleSize - counts[0]) < maxVariance &&
            Math.abs(moduleSize - counts[1]) < maxVariance &&
            Math.abs(moduleSize * 3 - counts[2]) < maxVariance * 3 &&
            Math.abs(moduleSize - counts[3]) < maxVariance &&
            Math.abs(moduleSize - counts[4]) < maxVariance
        );
    };

    const patternCandidates = [];
    const step = Math.max(1, Math.floor(height / 200));

    for (let y = 0; y < height; y += step) {
        const counts = [0, 0, 0, 0, 0];
        let state = 0; // 0: quiet zone (light), 1: D1, 2: L1, 3: D3, 4: L2, 5: D2

        for (let x = 0; x < width; x++) {
            const dark = isDark(x, y);
            if (state === 0) {
                if (dark) {
                    state = 1;
                    counts[0] = 1;
                }
            } else if (state === 1) {
                if (dark) counts[0]++;
                else { state = 2; counts[1] = 1; }
            } else if (state === 2) {
                if (!dark) counts[1]++;
                else { state = 3; counts[2] = 1; }
            } else if (state === 3) {
                if (dark) counts[2]++;
                else { state = 4; counts[3] = 1; }
            } else if (state === 4) {
                if (!dark) counts[3]++;
                else { state = 5; counts[4] = 1; }
            } else if (state === 5) {
                if (dark) {
                    counts[4]++;
                } else {
                    if (checkRatio(counts)) {
                        const centerX = x - counts[4] - counts[3] - counts[2] / 2;
                        const vCenterY = crossCheckVertical(centerX, y, counts[2] * 2, isDark, height, checkRatio);
                        if (vCenterY !== null) {
                            const hCenterX = crossCheckHorizontal(centerX, vCenterY, counts[2] * 2, isDark, width, checkRatio);
                            if (hCenterX !== null) {
                                const total = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
                                const ms = total / 7;
                                addCandidate(patternCandidates, hCenterX, vCenterY, ms);
                            }
                        }
                    }
                    counts[0] = counts[2];
                    counts[1] = counts[3];
                    counts[2] = counts[4];
                    counts[3] = 1;
                    counts[4] = 0;
                    state = 4;
                }
            }
        }

        if (state === 5 && checkRatio(counts)) {
            const centerX = width - counts[4] - counts[3] - counts[2] / 2;
            const vCenterY = crossCheckVertical(centerX, y, counts[2] * 2, isDark, height, checkRatio);
            if (vCenterY !== null) {
                const hCenterX = crossCheckHorizontal(centerX, vCenterY, counts[2] * 2, isDark, width, checkRatio);
                if (hCenterX !== null) {
                    const total = counts[0] + counts[1] + counts[2] + counts[3] + counts[4];
                    const ms = total / 7;
                    addCandidate(patternCandidates, hCenterX, vCenterY, ms);
                }
            }
        }
    }

    if (patternCandidates.length < 3) return null;

    const bestTriple = findBestTriangle(patternCandidates);
    if (!bestTriple) return null;

    const { tl, tr, bl } = bestTriple;

    const distTR = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const distBL = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const avgMs = (tl.ms + tr.ms + bl.ms) / 3;

    const modulesBetweenCenters = Math.round(((distTR + distBL) / 2) / avgMs);
    let version = Math.round((modulesBetweenCenters - 10) / 4);
    if (version < 1) version = 1;
    if (version > 40) version = 40;

    const matrixSize = 17 + version * 4;

    const br = {
        x: tr.x + bl.x - tl.x,
        y: tr.y + bl.y - tl.y,
    };

    const matrix = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(false));

    for (let row = 0; row < matrixSize; row++) {
        for (let col = 0; col < matrixSize; col++) {
            const u = (col + 0.5 - 3.5) / (matrixSize - 7);
            const v = (row + 0.5 - 3.5) / (matrixSize - 7);

            const px = Math.round((1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + (1 - u) * v * bl.x + u * v * br.x);
            const py = Math.round((1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + (1 - u) * v * bl.y + u * v * br.y);

            matrix[row][col] = isDark(px, py);
        }
    }

    const fmtCoordsTopLeft = [
        [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
        [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    let fmtVal = 0;
    for (let i = 0; i < 15; i++) {
        const [r, c] = fmtCoordsTopLeft[i];
        fmtVal = (fmtVal << 1) | (matrix[r][c] ? 1 : 0);
    }

    let bestMask = 0;
    let minDist = 16;
    for (let m = 0; m < 8; m++) {
        const target = FORMAT_INFO_L[m];
        const diff = fmtVal ^ target;
        let dist = 0;
        for (let b = 0; b < 15; b++) if ((diff >> b) & 1) dist++;
        if (dist < minDist) {
            minDist = dist;
            bestMask = m;
        }
    }

    const isReserved = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(false));
    const setRes = (r, c) => {
        if (r >= 0 && r < matrixSize && c >= 0 && c < matrixSize) isReserved[r][c] = true;
    };

    const placeFinderRes = (r0, c0) => {
        for (let r = -1; r <= 7; r++) {
            for (let c = -1; c <= 7; c++) setRes(r0 + r, c0 + c);
        }
    };
    placeFinderRes(0, 0);
    placeFinderRes(0, matrixSize - 7);
    placeFinderRes(matrixSize - 7, 0);

    setRes(matrixSize - 8, 8); // Dark module

    for (let i = 0; i < 9; i++) {
        setRes(8, i);
        setRes(i, 8);
    }
    for (let i = 0; i < 8; i++) {
        setRes(8, matrixSize - 1 - i);
        setRes(matrixSize - 1 - i, 8);
    }
    for (let i = 0; i < matrixSize; i++) {
        setRes(6, i);
        setRes(i, 6);
    }
    const locs = ALIGNMENT_LOCATIONS[version] || [];
    for (let i = 0; i < locs.length; i++) {
        for (let j = 0; j < locs.length; j++) {
            const r0 = locs[i];
            const c0 = locs[j];
            if ((i === 0 && j === 0) || (i === 0 && j === locs.length - 1) || (i === locs.length - 1 && j === 0))
                continue;
            for (let r = -2; r <= 2; r++) {
                for (let c = -2; c <= 2; c++) setRes(r0 + r, c0 + c);
            }
        }
    }
    if (version >= 7) {
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 3; c++) {
                setRes(matrixSize - 11 + c, r);
                setRes(r, matrixSize - 11 + c);
            }
        }
    }

    const isMasked = (r, c, mask) => {
        switch (mask) {
            case 0: return (r + c) % 2 === 0;
            case 1: return r % 2 === 0;
            case 2: return c % 3 === 0;
            case 3: return (r + c) % 3 === 0;
            case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
            case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
            case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
            case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
            default: return false;
        }
    };

    const unmaskedMatrix = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(false));
    for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
            if (isReserved[r][c]) {
                unmaskedMatrix[r][c] = matrix[r][c];
            } else {
                unmaskedMatrix[r][c] = isMasked(r, c, bestMask) ? !matrix[r][c] : matrix[r][c];
            }
        }
    }

    const rawBits = [];
    let upward = true;
    for (let col = matrixSize - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (let rowStep = 0; rowStep < matrixSize; rowStep++) {
            const r = upward ? matrixSize - 1 - rowStep : rowStep;
            for (let cStep = 0; cStep < 2; cStep++) {
                const c = col - cStep;
                if (!isReserved[r][c]) {
                    rawBits.push(unmaskedMatrix[r][c] ? 1 : 0);
                }
            }
        }
        upward = !upward;
    }

    const interleavedBytes = new Uint8Array(Math.floor(rawBits.length / 8));
    for (let i = 0; i < interleavedBytes.length; i++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
            b = (b << 1) | rawBits[i * 8 + bit];
        }
        interleavedBytes[i] = b;
    }

    const spec = VERSION_SPECS_L[version];
    if (!spec) return null;
    const [, maxDataBytes, ecCount, numBlocks] = spec;
    const blockSize = Math.floor(maxDataBytes / numBlocks);
    const shortBlocksCount = numBlocks - (maxDataBytes % numBlocks);
    const maxBlockLen = blockSize + (maxDataBytes % numBlocks > 0 ? 1 : 0);

    const blocks = Array.from({ length: numBlocks }, (_, b) =>
        new Uint8Array(b < shortBlocksCount ? blockSize : blockSize + 1)
    );
    const ecBlocks = Array.from({ length: numBlocks }, () => new Uint8Array(ecCount));

    let ptr = 0;
    for (let i = 0; i < maxBlockLen; i++) {
        for (let b = 0; b < numBlocks; b++) {
            if (i < blocks[b].length && ptr < interleavedBytes.length) {
                blocks[b][i] = interleavedBytes[ptr++];
            }
        }
    }
    for (let i = 0; i < ecCount; i++) {
        for (let b = 0; b < numBlocks; b++) {
            if (ptr < interleavedBytes.length) {
                ecBlocks[b][i] = interleavedBytes[ptr++];
            }
        }
    }

    const correctedData = new Uint8Array(maxDataBytes);
    let dataOffset = 0;
    for (let b = 0; b < numBlocks; b++) {
        const decoded = rsDecodeBlock(blocks[b], ecBlocks[b]);
        if (!decoded) return null;
        correctedData.set(decoded, dataOffset);
        dataOffset += decoded.length;
    }

    let bitPtr = 0;
    const readBits = (count) => {
        let val = 0;
        for (let i = 0; i < count; i++) {
            const byteIdx = Math.floor(bitPtr / 8);
            const bitOffset = 7 - (bitPtr % 8);
            if (byteIdx >= correctedData.length) return 0;
            val = (val << 1) | ((correctedData[byteIdx] >> bitOffset) & 1);
            bitPtr++;
        }
        return val;
    };

    const mode = readBits(4);
    if (mode !== 4) {
        return null;
    }

    const countBits = version < 10 ? 8 : 16;
    const charCount = readBits(countBits);
    if (charCount <= 0 || charCount > maxDataBytes) return null;

    const payloadBytes = new Uint8Array(charCount);
    for (let i = 0; i < charCount; i++) {
        payloadBytes[i] = readBits(8);
    }

    try {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder('utf-8').decode(payloadBytes);
        }
    } catch {
        // Fallback
    }

    let str = '';
    for (let i = 0; i < payloadBytes.length; i++) {
        str += String.fromCharCode(payloadBytes[i]);
    }
    return str;
}
